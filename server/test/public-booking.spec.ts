import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const integration = process.env.RUN_POSTGRES_TESTS === '1' ? describe : describe.skip;

integration('Public guest bookings with PostgreSQL and Mailpit', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let browsId: string;
  let makeupId: string;
  let laminationId: string;
  let shortId: string;
  let tintedId: string;
  let makeupServiceId: string;
  const bookingIds = new Set<string>();
  const userIds: string[] = [];

  async function createApp() {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const application = module.createNestApplication();
    await application.init();
    return application;
  }

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const [brows, makeup, services] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'ioana@beautystudio.local' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'ana@beautystudio.local' } }),
      prisma.service.findMany(),
    ]);
    browsId = brows.id;
    makeupId = makeup.id;
    laminationId = services.find(service => service.isSplit)!.id;
    shortId = services.find(service => service.category === 'BROWS' && service.totalDurationMinutes === 20)!.id;
    tintedId = services.find(service => service.category === 'BROWS' && service.totalDurationMinutes === 30)!.id;
    makeupServiceId = services.find(service => service.category === 'MAKEUP' && service.totalDurationMinutes === 75)!.id;
  });

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-25T10:02:00Z'));
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    try {
      await prisma?.appointment.deleteMany({ where: { id: { in: [...bookingIds] } } });
      await prisma?.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
    }
  });

  function guestBooking(start: string, serviceId = shortId, specialistId = browsId) {
    return {
      serviceId,
      specialistId,
      slotUtcMs: Date.parse(start),
      firstName: 'Test',
      lastName: 'Vizitatoare',
      phone: '+40 700 000 000',
      email: `${randomUUID()}@example.test`,
    };
  }

  async function book(payload: object, application = app) {
    const response = await request(application.getHttpServer()).post('/api/bookings').send(payload);
    if (response.status === 201 && response.body.id) bookingIds.add(response.body.id);
    return response;
  }

  async function mailFor(email: string) {
    const origin = process.env.MAILPIT_API_URL || 'http://mailpit:8025';
    const url = new URL('/api/v1/search', origin);
    url.searchParams.set('query', `to:${email}`);
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    const result = await response.json() as { messages: { ID: string; Subject: string }[] | null };
    return result.messages ?? [];
  }

  it('blocks the slot while pending and confirms only with the token delivered by Mailpit', async () => {
    const date = '2099-01-17';
    const payload = guestBooking(`${date}T07:00:00Z`, makeupServiceId, makeupId);
    const http = () => request(app.getHttpServer());
    const query = { date, serviceId: payload.serviceId, specialistId: payload.specialistId };
    const { body } = await book(payload);
    expect(body).toMatchObject({ status: 'PENDING_CONFIRMATION', emailStatus: 'sent' });
    expect(body).not.toHaveProperty('confirmationToken');
    expect(body).not.toHaveProperty('managementToken');
    expect((await http().get('/api/availability').query(query).expect(200)).body.slots)
      .not.toContainEqual(expect.objectContaining({ utcMs: payload.slotUtcMs }));
    expect((await http().get('/api/availability/days').query(query).expect(200)).body.days[0].choices)
      .toContainEqual(expect.objectContaining({ utcMs: payload.slotUtcMs, available: false }));
    expect((await book({ ...payload, email: `${randomUUID()}@example.test` })).status).toBe(409);
    await expect(prisma.appointmentStage.create({
      data: { appointmentId: body.id, specialistId: payload.specialistId, stageOrder: 99, status: 'CONFIRMED',
        startTime: new Date(payload.slotUtcMs), endTime: new Date(payload.slotUtcMs + 60_000) },
    })).rejects.toThrow('no_specialist_busy_overlap');
    const receipt = `/api/bookings/${body.id}/resend-confirmation`;
    await http().post(receipt).send({ resendToken: '0'.repeat(64) }).expect(404);
    await http().post(receipt).send({ resendToken: body.resendToken }).expect(200, { emailStatus: 'sent' });
    const messages = await mailFor(payload.email);
    expect(messages).toHaveLength(2);
    const origin = process.env.MAILPIT_API_URL || 'http://mailpit:8025';
    const mail = await fetch(new URL(`/api/v1/message/${messages[0].ID}`, origin));
    const { Text } = await mail.json() as { Text: string };
    const token = Text.match(/\/confirmare#token=([\w-]+)/)?.[1];
    const managementToken = Text.match(/\/programare\?token=([\w-]+)/)?.[1];
    expect(token).toBeDefined();
    expect(managementToken).toBeDefined();
    await http().post('/api/bookings/confirm').send({ token: managementToken }).expect(404);
    expect((await http().get('/api/appointments/by-token').query({ token: managementToken }).expect(200)).body.status)
      .toBe('PENDING_CONFIRMATION');
    for (let attempt = 0; attempt < 2; attempt++) {
      await http().post('/api/bookings/confirm').send({ token }).expect(200, { status: 'CONFIRMED', managementToken });
    }
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: body.id }, include: { stages: true } })))
      .toMatchObject({ status: 'CONFIRMED', stages: [{ status: 'CONFIRMED' }] });
    await http().post('/api/appointments/by-token/resend-confirmation').send({ token: managementToken }).expect(409);
  });

  it('lists no slots for yesterday and only upcoming slots for today in Bucharest', async () => {
    const slotsFor = (date: string) => request(app.getHttpServer()).get('/api/availability')
      .query({ date, serviceId: shortId, specialistId: browsId }).expect(200);

    expect((await slotsFor('2026-11-24')).body.slots).toEqual([]);
    const { body } = await slotsFor('2026-11-25');
    expect(body.slots[0]).toEqual({
      utcMs: Date.parse('2026-11-25T10:05:00Z'),
      localIso: '2026-11-25T12:05:00+02:00',
    });
    expect(body.slots.every((slot: { utcMs: number }) => slot.utcMs >= Date.now())).toBe(true);
  });

  it.each(['2026-11-24T08:00:00Z', '2026-11-25T10:00:00Z'])(
    'returns 400 for elapsed slot %s without saving or sending mail',
    async (start) => {
      const payload = guestBooking(start);
      expect((await book(payload)).status).toBe(400);
      expect(await prisma.appointment.count({
        where: { specialistId: browsId, startTime: new Date(payload.slotUtcMs) },
      })).toBe(0);
      expect(await mailFor(payload.email)).toHaveLength(0);
    },
  );

  it('stores the guest contact and pending UTC stages without modifying or linking an existing account', async () => {
    const payload = guestBooking('2099-01-10T07:00:00Z');
    const account = await prisma.user.create({
      data: { email: payload.email, firstName: 'Cont', lastName: 'Test', phone: '0700000001', passwordHash: 'fixture' },
    });
    userIds.push(account.id);

    const result = await book(payload);
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      status: 'PENDING_CONFIRMATION', startsAtLocal: '2099-01-10T09:00:00+02:00', totalPriceRon: '50', emailStatus: 'sent',
    });
    expect(result.body).not.toHaveProperty('cancellationToken');
    expect(result.body).not.toHaveProperty('guestEmail');
    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: result.body.id }, include: { stages: true } });
    expect(saved).toMatchObject({
      clientId: null, guestFirstName: payload.firstName, guestLastName: payload.lastName,
      guestPhone: payload.phone, guestEmail: payload.email, startTime: new Date(payload.slotUtcMs),
      status: 'PENDING_CONFIRMATION',
      stages: [{
        startTime: new Date(payload.slotUtcMs), endTime: new Date(payload.slotUtcMs + 20 * 60_000),
        status: 'PENDING_CONFIRMATION', isBusy: true,
      }],
    });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).toEqual(account);
    expect(await mailFor(payload.email)).toEqual([expect.objectContaining({ Subject: 'Confirmă programarea la Beauty Studio' })]);
  });

  it('rejects malformed contacts, mismatched categories and unavailable times without saving or sending mail', async () => {
    const payload = guestBooking('2099-01-15T07:00:00Z');
    for (const invalid of [
      { firstName: '   ' }, { lastName: 123 }, { phone: 'abc' }, { email: 'invalid' },
      { slotUtcMs: '2099-01-15' }, { specialistId: makeupId },
    ]) {
      expect((await book({ ...payload, ...invalid })).status).toBe(400);
    }
    expect((await book({ ...payload, serviceId: randomUUID() })).status).toBe(404);
    expect((await book({ ...payload, slotUtcMs: payload.slotUtcMs + 60_000 })).status).toBe(409);
    expect((await book({ ...payload, slotUtcMs: Date.parse('2099-01-11T07:00:00Z') })).status).toBe(409);
    expect(await prisma.appointment.count({ where: { startTime: new Date(payload.slotUtcMs) } })).toBe(0);
    expect(await mailFor(payload.email)).toHaveLength(0);
  });

  it('allows short services in both lamination windows and rejects a 30-minute overlap', async () => {
    expect((await book(guestBooking('2099-01-12T08:00:00Z', laminationId))).status).toBe(201);
    for (const time of ['08:15', '08:50']) {
      const start = `2099-01-12T${time}:00Z`;
      expect((await book(guestBooking(start, tintedId))).status).toBe(409);
      expect((await book(guestBooking(start))).status).toBe(201);
    }
  });

  it('allows lamination after short bookings are already in its free stages', async () => {
    expect((await book(guestBooking('2099-01-13T08:15:00Z'))).status).toBe(201);
    expect((await book(guestBooking('2099-01-13T08:55:00Z'))).status).toBe(201);
    expect((await book(guestBooking('2099-01-13T08:00:00Z', laminationId))).status).toBe(201);
  });

  it('accepts exactly one of two simultaneous requests and emails only the winner', async () => {
    const first = guestBooking('2099-01-14T07:00:00Z');
    const second = guestBooking('2099-01-14T07:00:00Z');
    const results = await Promise.all([book(first), book(second)]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    expect(await prisma.appointment.count({ where: { startTime: new Date(first.slotUtcMs), specialistId: browsId } })).toBe(1);
    const winner = results.findIndex(result => result.status === 201);
    const emails = await Promise.all([mailFor(first.email), mailFor(second.email)]);
    expect(emails.map(messages => messages.length)).toEqual(winner === 0 ? [1, 0] : [0, 1]);
  });

  it.each([
    ['2027-03-27', '07:00', '+02:00'],
    ['2027-03-28', '06:00', '+03:00'],
    ['2027-10-30', '06:00', '+03:00'],
    ['2027-10-31', '07:00', '+02:00'],
  ])('keeps the salon slot at 09:00 around a clock change on %s', async (date, utcTime, offset) => {
    const payload = guestBooking(`${date}T${utcTime}:00Z`, makeupServiceId, makeupId);
    const availability = await request(app.getHttpServer()).get('/api/availability')
      .query({ date, serviceId: makeupServiceId, specialistId: makeupId }).expect(200);
    expect(availability.body.slots[0]).toEqual({ utcMs: payload.slotUtcMs, localIso: `${date}T09:00:00${offset}` });
    const result = await book(payload);
    expect(result.status).toBe(201);
    expect(result.body.startsAtLocal).toBe(`${date}T09:00:00${offset}`);
    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: result.body.id } });
    expect(saved.startTime).toEqual(new Date(payload.slotUtcMs));
  });

  it('keeps the pending booking and its hold when SMTP is unreachable', async () => {
    const previousHost = process.env.SMTP_HOST;
    const previousPort = process.env.SMTP_PORT;
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    let withoutSmtp: INestApplication | undefined;
    try {
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = '1';
      withoutSmtp = await createApp();
      const payload = guestBooking('2099-01-16T07:00:00Z', makeupServiceId, makeupId);
      const result = await book(payload, withoutSmtp);
      expect(result.status).toBe(201);
      expect(result.body).toMatchObject({ status: 'PENDING_CONFIRMATION', emailStatus: 'failed' });
      expect(await prisma.appointment.findUniqueOrThrow({ where: { id: result.body.id } }))
        .toMatchObject({ status: 'PENDING_CONFIRMATION' });
      expect((await book({ ...payload, email: `${randomUUID()}@example.test` })).status).toBe(409);
      expect(log).toHaveBeenCalled();
      expect(await mailFor(payload.email)).toHaveLength(0);
      await request(app.getHttpServer()).post(`/api/bookings/${result.body.id}/resend-confirmation`)
        .send({ resendToken: result.body.resendToken }).expect(200, { emailStatus: 'sent' });
      expect(await mailFor(payload.email)).toHaveLength(1);
    } finally {
      await withoutSmtp?.close();
      if (previousHost === undefined) delete process.env.SMTP_HOST;
      else process.env.SMTP_HOST = previousHost;
      if (previousPort === undefined) delete process.env.SMTP_PORT;
      else process.env.SMTP_PORT = previousPort;
      log.mockRestore();
    }
  });
});
