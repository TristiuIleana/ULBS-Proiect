import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { hashPassword } from '../src/modules/client-access/password';
import { NotificationJobsService } from '../src/modules/notifications/notification-jobs.service';

const integration = process.env.RUN_POSTGRES_TESTS === '1' ? describe : describe.skip;
const password = 'integration-test-password';

integration('Sprint 3 client portal', () => {
  let app: INestApplication;
  let db: PrismaService;
  let specialistId: string;
  let serviceId: string;
  const api = () => request(app.getHttpServer());
  const emails: string[] = [];
  const contact = () => {
    const email = `${randomUUID()}@example.test`;
    emails.push(email);
    return { firstName: 'Test', lastName: 'Client', phone: '0700000000', email };
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    db = app.get(PrismaService);
    specialistId = (await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } })).id;
    serviceId = (await db.service.findFirstOrThrow({
      where: { category: 'BROWS', totalDurationMinutes: 20 },
    })).id;
  });

  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2097-01-10T10:00:00Z')));
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    try {
      if (!db) return;
      const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const clientId = { in: users.map(user => user.id) };
      const guestEmail = { in: emails };
      await db.waitlistEntry.deleteMany({ where: { OR: [{ clientId }, { guestEmail }] } });
      await db.appointment.deleteMany({ where: { OR: [{ clientId }, { guestEmail }] } });
      await db.user.deleteMany({ where: { id: clientId } });
    } finally {
      await app?.close();
    }
  });

  function guest(slot: string, details = contact()) {
    return { specialistId, serviceId, slotUtcMs: Date.parse(slot), ...details };
  }

  async function emailLink(address: string, fragment: string) {
    const origin = process.env.MAILPIT_API_URL || 'http://mailpit:8025';
    const search = new URL('/api/v1/search', origin);
    search.searchParams.set('query', `to:${address}`);
    const result = await (await fetch(search)).json() as { messages: { ID: string }[] | null };
    for (const { ID } of result.messages ?? []) {
      const message = await (await fetch(`${origin}/api/v1/message/${ID}`)).json() as { Text: string };
      const link = message.Text.split(/\s+/).find(word => word.includes(fragment));
      if (link) return new URL(link).searchParams.get('token');
    }
    throw new Error(`No mail link for ${fragment}`);
  }

  async function register(details = contact()) {
    await api().post('/api/client/register').send({ ...details, password }).expect(201);
    const token = await emailLink(details.email, '/cont?token=');
    const client = request.agent(app.getHttpServer());
    await client.post('/api/client/verify').send({ token }).expect(200);
    return client;
  }

  it('returns a bounded date strip and separate morning and afternoon counts', async () => {
    const { body } = await api().get('/api/availability/days')
      .query({ specialistId, serviceId, date: '2097-01-10' }).expect(200);
    expect(body.days).toHaveLength(6);
    expect(body.days[0]).toMatchObject({
      date: '2097-01-10', isFullDay: false,
      morning: { free: 12, total: 12 }, afternoon: { free: 69, total: 69 },
    });
    expect(body.days.some((day: { status: string }) => day.status === 'closed')).toBe(true);
  });

  it('associates old guest bookings by verified email and protects account history', async () => {
    const details = contact();
    const booking = await api().post('/api/bookings').send(guest('2097-01-14T09:00:00Z', details)).expect(201);
    await api().post('/api/client/register').send({ ...details, password }).expect(201);
    await api().post('/api/client/login').send({ email: details.email, password }).expect(403);
    const token = await emailLink(details.email, '/cont?token=');
    const client = request.agent(app.getHttpServer());
    await client.post('/api/client/verify').send({ token }).expect(200);
    const { body } = await client.get('/api/client/account').expect(200);
    expect(body.upcoming.map((row: { id: string }) => row.id)).toContain(booking.body.id);
    await api().get('/api/client/account').expect(401);
    await client.post('/api/client/logout').expect(200);
    await client.get('/api/client/account').expect(401);
  });

  it('blocks online changes within 24 hours, including guest token access', async () => {
    const details = contact();
    const booking = await api().post('/api/bookings').send(guest('2097-01-11T08:00:00Z', details)).expect(201);
    const token = await emailLink(details.email, '/programare?token=');
    const { body } = await api().get('/api/appointments/by-token').query({ token }).expect(200);
    expect(body.canManage).toBe(false);
    await api().post('/api/appointments/by-token/cancel').send({ token }).expect(403);
    await api().post('/api/appointments/by-token/reschedule')
      .send({ token, slotUtcMs: Date.parse('2097-01-16T08:00:00Z') }).expect(403);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: booking.body.id } })).status).toBe('CONFIRMED');
  });

  it('protects Admin actions and allows public entry to a filled waitlist window', async () => {
    const details = contact();
    const booking = await api().post('/api/bookings').send(guest('2097-01-15T08:00:00Z', details)).expect(201);
    await api().post(`/api/admin/appointments/${booking.body.id}/complete`).expect(401);
    await api().post(`/api/admin/clients/${randomUUID()}/unblock`).expect(401);
    const day = '2097-01-15';
    await db.scheduleOverride.create({
      data: { specialistId, date: day, isWorking: true, startTime: '10:00', endTime: '10:20' },
    });
    try {
      const wait = contact();
      await api().post('/api/waitlist').send({
        ...wait, serviceId, specialistId, date: day, window: 'MORNING',
      }).expect(201);
      await register(wait);
      const enrolledUser = await db.user.findUniqueOrThrow({ where: { email: wait.email } });
      expect(await db.waitlistEntry.count({ where: { clientId: enrolledUser.id, desiredDate: day } })).toBe(1);
      const token = await emailLink(details.email, '/programare?token=');
      await api().post('/api/appointments/by-token/cancel').send({ token }).expect(200);
      await api().post('/api/bookings').send(guest('2097-01-15T08:00:00Z')).expect(409);
      const offer = await emailLink(wait.email, '/oferta?token=');
      await api().post('/api/waitlist/claim').send({ token: offer }).expect(201);
      await api().post('/api/waitlist/claim').send({ token: offer }).expect(409);
    } finally {
      await db.scheduleOverride.delete({ where: { specialistId_date: { specialistId, date: day } } });
    }
  });

  it('moves loyalty to the next chronological booking and resets only through Admin', async () => {
    const original = await db.user.findUniqueOrThrow({ where: { id: specialistId } });
    await db.user.update({ where: { id: specialistId }, data: { passwordHash: await hashPassword(password) } });
    const admin = request.agent(app.getHttpServer());
    try {
      await admin.post('/api/client/login').send({ email: original.email, password }).expect(200);
      const details = contact();
      const client = await register(details);
      const user = await db.user.findUniqueOrThrow({ where: { email: details.email } });
      const book = (value: string) => client.post('/api/bookings/account').send({
        specialistId, serviceId, slotUtcMs: Date.parse(value),
      });
      const prior = [];
      for (const hour of [7, 8, 9, 10]) {
        prior.push((await book(`2097-01-12T${String(hour).padStart(2, '0')}:00:00Z`).expect(201)).body.id);
      }
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2097-01-12T11:00:00Z'));
      await client.post(`/api/admin/appointments/${prior[0]}/complete`).expect(403);
      for (const id of prior) await admin.post(`/api/admin/appointments/${id}/complete`).expect(200);
      expect((await client.get('/api/client/account').expect(200)).body.progress).toBe(4);

      const later = await book('2097-01-18T10:00:00Z').expect(201);
      const sooner = await book('2097-01-17T10:00:00Z').expect(201);
      expect(sooner.body.totalPriceRon).toBe('45');
      expect((await db.appointment.findUniqueOrThrow({ where: { id: later.body.id } })).totalPriceRon.toString()).toBe('50');
      await client.post(`/api/appointments/${sooner.body.id}/cancel`).expect(200);
      expect((await db.appointment.findUniqueOrThrow({ where: { id: later.body.id } })).totalPriceRon.toString()).toBe('45');

      const near = [];
      for (const hour of [12, 13, 14]) near.push((await book(`2097-01-12T${hour}:00:00Z`).expect(201)).body.id);
      for (const id of near) await admin.post(`/api/admin/appointments/${id}/cancel`).expect(200);
      await admin.post(`/api/admin/appointments/${near[0]}/cancel`).expect(200);
      expect((await client.get('/api/client/account').expect(200)).body.lateCancellationCount).toBe(3);
      await book('2097-01-19T10:00:00Z').expect(403);
      await client.post(`/api/admin/clients/${user.id}/unblock`).expect(403);
      await admin.post(`/api/admin/clients/${user.id}/unblock`).expect(200);
      await book('2097-01-19T10:00:00Z').expect(201);
    } finally {
      await admin.post('/api/client/logout');
      await db.user.update({ where: { id: specialistId }, data: { passwordHash: original.passwordHash } });
    }
  });

  it('blocks an otherwise early online change on Zi Full', async () => {
    const date = '2097-01-16';
    await db.scheduleOverride.create({
      data: { specialistId, date, isWorking: true, startTime: '09:00', endTime: '19:00', isFullDayPolicy: true },
    });
    try {
      const details = contact();
      await api().post('/api/bookings').send(guest('2097-01-16T12:00:00Z', details)).expect(201);
      const token = await emailLink(details.email, '/programare?token=');
      expect((await api().get('/api/appointments/by-token').query({ token }).expect(200)).body)
        .toMatchObject({ canManage: false, isFullDay: true });
      await api().post('/api/appointments/by-token/cancel').send({ token }).expect(403);
    } finally {
      await db.scheduleOverride.delete({ where: { specialistId_date: { specialistId, date } } });
    }
  });

  it('offers the slot after a successful move and rolls expired priority to the next guest', async () => {
    const date = '2097-01-21';
    await db.scheduleOverride.create({
      data: { specialistId, date, isWorking: true, startTime: '10:00', endTime: '10:20' },
    });
    try {
      const owner = contact();
      const occupied = guest(`${date}T08:00:00Z`, owner);
      const booking = await api().post('/api/bookings').send(occupied).expect(201);
      const first = contact();
      const second = contact();
      for (const details of [first, second]) {
        await api().post('/api/waitlist').send({
          ...details, specialistId, serviceId, date, window: 'MORNING',
        }).expect(201);
      }
      const token = await emailLink(owner.email, '/programare?token=');
      const collision = Date.parse('2097-01-23T08:00:00Z');
      await api().post('/api/bookings').send(guest('2097-01-23T08:00:00Z')).expect(201);
      await api().post('/api/appointments/by-token/reschedule').send({ token, slotUtcMs: collision }).expect(409);
      expect((await db.appointment.findUniqueOrThrow({ where: { id: booking.body.id } })).startTime.getTime())
        .toBe(occupied.slotUtcMs);
      expect(await db.waitlistEntry.count({ where: { desiredDate: date, status: 'NOTIFIED' } })).toBe(0);
      await api().post('/api/appointments/by-token/reschedule')
        .send({ token, slotUtcMs: Date.parse('2097-01-23T10:00:00Z') }).expect(200);
      const firstToken = await emailLink(first.email, '/oferta?token=');
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2097-01-10T10:30:00Z'));
      await app.get(NotificationJobsService).waitlistOffers();
      await api().post('/api/waitlist/claim').send({ token: firstToken }).expect(409);
      await api().post('/api/bookings').send(guest(`${date}T08:00:00Z`)).expect(409);
      const secondToken = await emailLink(second.email, '/oferta?token=');
      await api().post('/api/waitlist/claim').send({ token: secondToken }).expect(201);
    } finally {
      await db.scheduleOverride.delete({ where: { specialistId_date: { specialistId, date } } });
    }
  });

  it('registers the reminder cron and sends once at both edges of the two-to-24-hour window', async () => {
    const scheduler = app.get(SchedulerRegistry);
    expect(scheduler.getCronJob('appointment-reminders')).toBeDefined();
    const jobs = app.get(NotificationJobsService);
    const fixtures = await Promise.all([
      '2097-01-10T11:35:00Z', '2097-01-10T12:00:00Z', '2097-01-11T10:00:00Z', '2097-01-11T10:25:00Z',
    ].map(async value => {
      const details = contact();
      const response = await api().post('/api/bookings').send(guest(value, details)).expect(201);
      return { id: response.body.id as string, email: details.email };
    }));
    await Promise.all([jobs.reminders(), jobs.reminders()]);
    await jobs.reminders();
    const sent = await Promise.all(fixtures.map(async ({ id, email }) => {
      const origin = process.env.MAILPIT_API_URL || 'http://mailpit:8025';
      const search = new URL('/api/v1/search', origin);
      search.searchParams.set('query', `to:${email}`);
      const result = await (await fetch(search)).json() as { messages: { Subject: string }[] };
      const count = result.messages.filter(message => message.Subject.startsWith('Reminder')).length;
      return { count, recorded: !!(await db.appointment.findUniqueOrThrow({ where: { id } })).reminderSentAt };
    }));
    expect(sent).toEqual([
      { count: 0, recorded: false }, { count: 1, recorded: true },
      { count: 1, recorded: true }, { count: 0, recorded: false },
    ]);
    const token = await emailLink(fixtures[2].email, '/programare?token=');
    await api().post('/api/appointments/by-token/reschedule')
      .send({ token, slotUtcMs: Date.parse('2097-01-10T15:00:00Z') }).expect(200);
    const sentAt = (await db.appointment.findUniqueOrThrow({ where: { id: fixtures[2].id } })).reminderSentAt;
    await jobs.reminders();
    expect((await db.appointment.findUniqueOrThrow({ where: { id: fixtures[2].id } })).reminderSentAt).toEqual(sentAt);
  });
});
