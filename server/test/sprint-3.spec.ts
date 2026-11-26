import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const integration = process.env.RUN_POSTGRES_TESTS === '1' ? describe : describe.skip;
const password = 'integration-test-password';

integration('Sprint 3 client portal', () => {
  let app: INestApplication;
  let db: PrismaService;
  let specialistId: string;
  let serviceId: string;
  const api = () => request(app.getHttpServer());
  const contact = () => ({
    firstName: 'Test', lastName: 'Client', phone: '0700000000', email: `${randomUUID()}@example.test`,
  });

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
  afterAll(() => app?.close());

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
});
