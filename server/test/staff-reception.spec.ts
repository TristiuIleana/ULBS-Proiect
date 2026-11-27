import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/modules/client-access/password';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const integration = process.env.RUN_POSTGRES_TESTS === '1' ? describe : describe.skip;
const origin = process.env.PUBLIC_WEB_ORIGIN || 'http://localhost:17173';

integration('Sprint 4 staff and reception', () => {
  let app: INestApplication;
  let db: PrismaService;
  let ioana: Awaited<ReturnType<PrismaService['user']['findFirstOrThrow']>>;
  let ana: typeof ioana;
  let brows: string;
  let makeup: string;
  let ioanaId: string;
  let anaId: string;
  let anaFinished: string;
  const created: string[] = [];
  const password = randomUUID();
  const api = () => request(app.getHttpServer());
  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/api/staff/login').set('Origin', origin).send({ email, password }).expect(200);
    expect(response.headers['set-cookie'][0]).toMatch(/httponly/i);
    return agent;
  };

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
    for (const job of app.get(SchedulerRegistry).getCronJobs().values()) job.stop();
    db = app.get(PrismaService);
    ioana = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', specialistCategory: 'BROWS' } });
    ana = await db.user.findFirstOrThrow({ where: { role: 'SPECIALIST', specialistCategory: 'MAKEUP' } });
    const passwordHash = await hashPassword(password);
    await db.user.updateMany({ where: { id: { in: [ioana.id, ana.id] } }, data: { passwordHash } });
    brows = (await db.service.findFirstOrThrow({ where: { category: 'BROWS', totalDurationMinutes: 20 } })).id;
    makeup = (await db.service.findFirstOrThrow({ where: { category: 'MAKEUP', totalDurationMinutes: 75 } })).id;
    async function create(specialistId: string, serviceId: string, start: string, end: string) {
      const row = await db.appointment.create({ data: {
        specialistId, serviceId, startTime: new Date(start), endTime: new Date(end), status: 'CONFIRMED',
        totalPriceRon: 50, guestFirstName: 'Test', guestLastName: 'Calendar', guestPhone: '0700000000',
        guestEmail: `${randomUUID()}@example.test`,
      } });
      created.push(row.id);
      return row.id;
    }
    ioanaId = await create(ioana.id, brows, '2098-04-14T10:00Z', '2098-04-14T10:20Z');
    anaId = await create(ana.id, makeup, '2098-04-14T10:00Z', '2098-04-14T11:15Z');
    anaFinished = await create(ana.id, makeup, '2020-04-14T10:00Z', '2020-04-14T11:15Z');
  });

  afterAll(async () => {
    try {
      if (db) {
        await db.appointment.deleteMany({ where: { id: { in: created } } });
        for (const user of [ioana, ana].filter(Boolean)) {
          await db.user.update({ where: { id: user.id }, data: { passwordHash: user.passwordHash } });
        }
      }
    } finally {
      await app?.close();
    }
  });

  it('uses a dedicated session for only the two fixed staff identities', async () => {
    const staff = await login('ana@admin.com');
    await staff.get('/api/staff/session').expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ id: ana.id, role: 'SPECIALIST' });
    });
    await api().post('/api/staff/login').set('Origin', origin).send({ email: 'unknown@example.test', password }).expect(401);
    await api().post('/api/client/login').send({ email: 'ana@admin.com', password }).expect(401);
    await staff.post('/api/staff/logout').set('Origin', origin).expect(200);
    await staff.get('/api/staff/session').expect(401);
  });

  it('keeps all global reads and writes away from Ana, including direct IDs and export', async () => {
    const staff = await login('ana@admin.com');
    const day = { date: '2098-04-14', view: 'day' };
    await staff.get('/api/staff/appointments').query({ ...day, specialistId: ioana.id }).expect(400);
    const list = await staff.get('/api/staff/appointments').query(day).expect(200);
    expect(list.body.appointments.map((row: { id: string }) => row.id)).toEqual([anaId]);
    await staff.get(`/api/staff/appointments/${ioanaId}`).expect(404);
    await staff.post(`/api/staff/appointments/${ioanaId}/complete`).set('Origin', origin).expect(404);
    for (const route of ['/appointments', '/calendar.ics', '/waitlist', '/slots']) {
      await staff.get(`/api/staff/reception${route}`).query(day).expect(403);
    }
    await staff.post('/api/staff/reception/appointments').set('Origin', origin).send({}).expect(403);
    await staff.post(`/api/admin/appointments/${anaId}/cancel`).set('Origin', origin).expect(403);
    const exported = await staff.get('/api/staff/calendar.ics').query(day).expect(200);
    expect(exported.text).toContain(anaId);
    expect(exported.text).not.toContain(ioanaId);
    expect(exported.text).not.toContain('0700000000');
  });

  it('marks ended visits, rejects premature status changes, and lets Ioana read both calendars', async () => {
    const employee = await login('ana@admin.com');
    await employee.post(`/api/staff/appointments/${anaId}/complete`).set('Origin', origin).expect(409);
    await employee.post(`/api/staff/appointments/${anaFinished}/no-show`).set('Origin', origin)
      .expect(200).expect(({ body }) => expect(body.status).toBe('NO_SHOW'));
    await employee.post(`/api/staff/appointments/${anaFinished}/no-show`).set('Origin', origin).expect(200);
    const admin = await login('ioana@admin.com');
    const day = { date: '2098-04-14', view: 'day' };
    const list = await admin.get('/api/staff/reception/appointments').query(day).expect(200);
    expect(list.body.appointments.map((row: { id: string }) => row.id).sort()).toEqual([ioanaId, anaId].sort());
    const exported = await admin.get('/api/staff/reception/calendar.ics').query({ ...day, specialistId: ioana.id }).expect(200);
    expect(exported.text).toContain(ioanaId);
    expect(exported.text).not.toContain(anaId);
  });

  it('lets Ioana book directly with a name and phone', async () => {
    const admin = await login('ioana@admin.com');
    const booked = await admin.post('/api/staff/reception/appointments').set('Origin', origin).send({
      specialistId: ana.id, serviceId: makeup, slotUtcMs: Date.parse('2098-04-15T10:00Z'),
      firstName: 'Test', lastName: 'Recepție', phone: '0700000001',
    }).expect(201);
    created.push(booked.body.id);
    expect(booked.body.status).toBe('CONFIRMED');
    expect(await db.appointmentStage.count({ where: { appointmentId: booked.body.id, status: 'CONFIRMED' } })).toBe(1);
  });
});
