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

integration('Sprint 5 Admin', () => {
  let app: INestApplication;
  let db: PrismaService;
  let staff: Awaited<ReturnType<PrismaService['user']['findMany']>>;
  const password = randomUUID();
  const serviceIds: string[] = [];
  const api = () => request(app.getHttpServer());

  async function login(role: 'ADMIN' | 'SPECIALIST') {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/staff/login').set('Origin', origin)
      .send({ email: staff.find(user => user.role === role)!.email, password }).expect(200);
    return agent;
  }

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    await app.init();
    for (const job of app.get(SchedulerRegistry).getCronJobs().values()) job.stop();
    db = app.get(PrismaService);
    staff = await db.user.findMany({ where: { role: { in: ['ADMIN', 'SPECIALIST'] } } });
    await db.user.updateMany({ where: { id: { in: staff.map(user => user.id) } },
      data: { passwordHash: await hashPassword(password) } });
  });

  afterAll(async () => {
    try {
      if (db && staff) {
        for (const { id, passwordHash } of staff) await db.user.update({ where: { id }, data: { passwordHash } });
        await db.waitlistEntry.deleteMany({ where: { serviceId: { in: serviceIds } } });
        await db.appointment.deleteMany({ where: { serviceId: { in: serviceIds } } });
        await db.service.deleteMany({ where: { id: { in: serviceIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  it('protects management documents through their APIs', async () => {
    const ana = await login('SPECIALIST');
    for (const path of ['/api/staff/reports', '/api/staff/services']) {
      await api().get(path).expect(401);
      await ana.get(path).expect(403);
    }
    await ana.post(`/api/staff/reception/waitlist/${randomUUID()}/convert`).set('Origin', origin).expect(403);
  });

  it('validates a service and controls its public visibility', async () => {
    const admin = await login('ADMIN');
    const draft = { name: 'Serviciu test', category: 'MAKEUP', priceRon: '99.50', totalDurationMinutes: 30,
      stages: [{ name: 'Aplicare', durationMinutes: 30, isBusy: true }] };
    await admin.post('/api/staff/services').set('Origin', origin)
      .send({ ...draft, totalDurationMinutes: 25 }).expect(400);
    const created = await admin.post('/api/staff/services').set('Origin', origin).send(draft).expect(201);
    serviceIds.push(created.body.id);
    const active = await api().get('/api/services').expect(200);
    expect(active.body.services).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id })]));
    await admin.patch(`/api/staff/services/${created.body.id}`).set('Origin', origin).send({ isActive: false }).expect(200);
    const inactive = await api().get('/api/services').expect(200);
    expect(inactive.body.services).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id })]));
    await admin.patch(`/api/staff/services/${created.body.id}`).set('Origin', origin).send({ isActive: true }).expect(200);
  });

  it('reports persisted net figures and ignores expired confirmations', async () => {
    const admin = await login('ADMIN');
    const ana = staff.find(user => user.role === 'SPECIALIST')!;
    const service = await db.service.create({ data: { name: 'Raport test', category: 'MAKEUP',
      priceRon: 200, totalDurationMinutes: 30 } });
    serviceIds.push(service.id);
    const startTime = new Date();
    for (const [status, cancellationReason] of [
      ['COMPLETED', null], ['NO_SHOW', null], ['CANCELLED', null], ['CANCELLED', 'CONFIRMATION_EXPIRED'],
    ] as const) {
      await db.appointment.create({ data: { specialistId: ana.id, serviceId: service.id,
        startTime, endTime: new Date(startTime.getTime() + 30 * 60_000), totalPriceRon: 90,
        loyaltyDiscountRon: 10, status, cancellationReason, guestFirstName: 'Test',
        guestLastName: 'Raport', guestPhone: '0700000000' } });
    }
    const result = await admin.get('/api/staff/reports').query({ specialistId: ana.id }).expect(200);
    expect(result.body.kpis).toMatchObject({ netBani: 9000, completed: 1, noShows: 1, cancelled: 1,
      discounted: 1, discountBani: 1000 });
  });

  it('converts an active offer and rejects later reuse of its link or entry', async () => {
    const admin = await login('ADMIN');
    const ana = staff.find(user => user.role === 'SPECIALIST')!;
    const service = await db.service.create({ data: { name: 'Ofertă test', category: 'MAKEUP',
      priceRon: 100, totalDurationMinutes: 30,
      stages: { create: { name: 'Execuție', durationMinutes: 30, stageOrder: 1 } } } });
    serviceIds.push(service.id);
    const startTime = new Date('2099-06-15T10:00:00Z');
    const entry = await db.waitlistEntry.create({ data: {
      specialistId: ana.id, serviceId: service.id, desiredDate: '2099-06-15', status: 'NOTIFIED',
      guestFirstName: 'Test', guestLastName: 'Waitlist', guestPhone: '0700000000',
      guestEmail: `${randomUUID()}@example.test`, priorityToken: randomUUID(),
      offeredStartAt: startTime, expiresAt: new Date(Date.now() + 60_000),
      offerStages: { create: { startTime, endTime: new Date(startTime.getTime() + 30 * 60_000) } },
    } });
    await admin.patch(`/api/staff/services/${service.id}`).set('Origin', origin).send({ isActive: false }).expect(409);
    await admin.patch(`/api/staff/services/${service.id}`).set('Origin', origin).send({ priceRon: '120' }).expect(200);
    const converted = await admin.post(`/api/staff/reception/waitlist/${entry.id}/convert`)
      .set('Origin', origin).expect(201);
    expect(converted.body).toMatchObject({ status: 'CONFIRMED', serviceId: service.id });
    const repeats = await Promise.all([
      api().post('/api/waitlist/claim').send({ token: entry.priorityToken }),
      admin.post(`/api/staff/reception/waitlist/${entry.id}/convert`).set('Origin', origin),
    ]);
    expect(repeats.map(response => response.status)).toEqual([409, 409]);
    expect(await db.appointment.count({ where: { serviceId: service.id } })).toBe(1);
    await admin.patch(`/api/staff/services/${service.id}`).set('Origin', origin).send({
      totalDurationMinutes: 45, stages: [{ name: 'Execuție', durationMinutes: 45, isBusy: true }],
    }).expect(409);

    const anotherStart = new Date('2099-06-16T10:00:00Z');
    const contested = await db.waitlistEntry.create({ data: {
      specialistId: ana.id, serviceId: service.id, desiredDate: '2099-06-16', status: 'NOTIFIED',
      guestFirstName: 'Test', guestLastName: 'Concurență', guestPhone: '0700000000',
      guestEmail: `${randomUUID()}@example.test`, priorityToken: randomUUID(),
      offeredStartAt: anotherStart, expiresAt: new Date(Date.now() + 60_000),
      offerStages: { create: { startTime: anotherStart, endTime: new Date(anotherStart.getTime() + 30 * 60_000) } },
    } });
    const contenders = await Promise.all([
      api().post('/api/waitlist/claim').send({ token: contested.priorityToken }),
      admin.post(`/api/staff/reception/waitlist/${contested.id}/convert`).set('Origin', origin),
    ]);
    expect(contenders.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await db.appointment.count({ where: { serviceId: service.id, startTime: anotherStart } })).toBe(1);
  });
});
