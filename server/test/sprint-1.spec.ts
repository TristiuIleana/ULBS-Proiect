import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const integration = process.env.RUN_POSTGRES_TESTS === '1' ? describe : describe.skip;

integration('Sprint 1 API with migrated and seeded PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clientId: string | undefined;
  let appointmentId: string | undefined;
  let browsId: string;
  let makeupId: string;
  let laminationId: string;
  let shortId: string;
  let tintedId: string;
  let makeupServiceId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    const [brows, makeup, services] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'ioana@beautystudio.local' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'ana@beautystudio.local' } }),
      prisma.service.findMany({ include: { stages: { orderBy: { stageOrder: 'asc' } } } }),
    ]);
    browsId = brows.id;
    makeupId = makeup.id;
    const lamination = services.find(service => service.isSplit)!;
    laminationId = lamination.id;
    shortId = services.find(service => service.category === 'BROWS' && service.totalDurationMinutes === 20)!.id;
    tintedId = services.find(service => service.category === 'BROWS' && service.totalDurationMinutes === 30)!.id;
    makeupServiceId = services.find(service => service.category === 'MAKEUP')!.id;
    const client = await prisma.user.create({
      data: { email: `${randomUUID()}@example.test`, phone: '0700000000', firstName: 'Test', lastName: 'Sprint' },
    });
    clientId = client.id;
    let cursor = Date.parse('2099-01-05T08:00:00Z');
    const startTime = new Date(cursor);
    const stages = lamination.stages.map(stage => {
      const startTime = new Date(cursor);
      cursor += stage.durationMinutes * 60_000;
      return { stageOrder: stage.stageOrder, isBusy: stage.isBusy, specialistId: browsId, startTime, endTime: new Date(cursor) };
    });
    const appointment = await prisma.appointment.create({
      data: {
        clientId, specialistId: browsId, serviceId: laminationId,
        startTime, endTime: new Date(cursor), totalPriceRon: lamination.priceRon,
        stages: { create: stages },
      },
    });
    appointmentId = appointment.id;
  });

  afterAll(async () => {
    try {
      if (appointmentId) await prisma.appointment.delete({ where: { id: appointmentId } });
      if (clientId) await prisma.user.delete({ where: { id: clientId } });
    } finally {
      await app?.close();
    }
  });

  const slots = (specialistId: string, serviceId: string, date: string) =>
    request(app.getHttpServer()).get('/api/availability').query({ specialistId, serviceId, date });

  it('exposes the seeded active catalog, ordered split stages and public specialist categories', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/services').expect(200);
    expect(body.services).toHaveLength(6);
    const lamination = body.services.find((service: { id: string }) => service.id === laminationId);
    expect(lamination).toMatchObject({ totalDurationMinutes: 90, priceRon: '180', isSplit: true });
    expect(lamination.stages.map((stage: { durationMinutes: number; isBusy: boolean }) =>
      [stage.durationMinutes, stage.isBusy])).toEqual([[15, true], [20, false], [15, true], [25, false], [15, true]]);
    expect(body.specialists).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: browsId, category: 'BROWS' }),
      expect.objectContaining({ id: makeupId, category: 'MAKEUP' }),
    ]));
    expect(body.specialists.every((specialist: object) =>
      Object.keys(specialist).sort().join(',') === 'category,firstName,id')).toBe(true);
  });

  it('exposes both interleaving windows for 20 minutes and rejects 30 minutes in either window', async () => {
    const starts = (rows: { localIso: string }[]) => rows.map(row => row.localIso.slice(11, 16));
    const short = await slots(browsId, shortId, '2099-01-05').expect(200);
    const tinted = await slots(browsId, tintedId, '2099-01-05').expect(200);
    expect(starts(short.body.slots)).toEqual(expect.arrayContaining(['10:15', '10:50', '10:55']));
    expect(starts(short.body.slots)).not.toContain('10:20');
    expect(starts(tinted.body.slots)).not.toContain('10:15');
    expect(starts(tinted.body.slots)).not.toContain('10:50');
  });

  it('enforces Sunday schedules, specialization and valid calendar dates', async () => {
    const brows = await slots(browsId, shortId, '2099-01-04').expect(200);
    expect(brows.body.slots).toEqual([]);
    const makeup = await slots(makeupId, makeupServiceId, '2099-01-04').expect(200);
    expect(makeup.body.slots.length).toBeGreaterThan(0);
    await slots(makeupId, shortId, '2099-01-05').expect(400);
    await slots(browsId, shortId, '2099-02-30').expect(400);
  });
});
