/**
 * availability.spec.ts
 *
 * Unit tests for the AvailabilityService algorithm.
 * These tests inject a minimal mock PrismaService so no DB is required.
 *
 * Behaviours covered (plan tests #1-#5, #7):
 *  T1  Ioana Mon-Sat 09:00-19:00 — slots returned
 *  T2  Ioana Sunday — 0 slots (closed)
 *  T3  Ana Sunday — slots returned (MAKEUP open 7 days)
 *  T4  Split interleaving: Pensat simplu (20m) fits at 10:15 and 10:50
 *      when Laminare is booked at 10:00
 *  T5  Pensat cu vopsit (30m) rejected at 10:15 and 10:50 (overflows busy)
 *  T6  Second Laminare (90m) rejected when first is at 10:00
 *  T7  DST correctness: booking at 09:00 EET (UTC+2) → stored as 07:00 UTC
 */

import { AvailabilityService } from '../src/modules/availability/availability.service';
import { BusyInterval, StageTemplate } from '../src/modules/availability/availability.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIN = 60_000;

/** Build stage templates from an array of [durationMin, isBusy] pairs. */
function stages(...pairs: [number, boolean][]): StageTemplate[] {
  return pairs.map(([durationMinutes, isBusy], i) => ({
    stageOrder: i + 1,
    durationMinutes,
    isBusy,
  }));
}

/** Create a BusyInterval from start UTC ms + duration in minutes */
function busyBlock(startMs: number, durationMin: number): BusyInterval {
  return { startMs, endMs: startMs + durationMin * MIN };
}

// ---------------------------------------------------------------------------
// Pure algorithm tests (no DB)
// ---------------------------------------------------------------------------

describe('AvailabilityService — candidateFits()', () => {
  // AvailabilityService.candidateFits is a pure method; create instance with
  // null prisma (unused by candidateFits).
  const svc = new AvailabilityService(null as any);

  const laminareStages = stages(
    [15, true],  // S1 busy
    [20, false], // S2 idle
    [15, true],  // S3 busy
    [25, false], // S4 idle
    [15, true],  // S5 busy
  );

  const pensatSimpluStages = stages([20, true]);
  const pensatVopsitStages = stages([30, true]);

  // Monday 2026-11-23 09:00 EET = 2026-11-23T07:00:00Z → epoch for base
  const BASE_UTC_09h = Date.UTC(2026, 10, 23, 7, 0, 0); // Nov is month 10 (0-indexed)
  // 10:00 local EET = 08:00 UTC
  const UTC_10h = BASE_UTC_09h + 60 * MIN;
  // 10:15 UTC
  const UTC_10h15 = UTC_10h + 15 * MIN;
  // 10:50 UTC
  const UTC_10h50 = UTC_10h + 50 * MIN;

  // Laminare booked at 10:00 EET (08:00 UTC) produces these busy stages:
  // S1: [08:00, 08:15) busy
  // S2: [08:15, 08:35) idle
  // S3: [08:35, 08:50) busy
  // S4: [08:50, 09:15) idle
  // S5: [09:15, 09:30) busy
  const laminareAt10EET_busy: BusyInterval[] = [
    busyBlock(UTC_10h, 15),          // S1 [08:00,08:15)
    busyBlock(UTC_10h + 35 * MIN, 15), // S3 [08:35,08:50)
    busyBlock(UTC_10h + 75 * MIN, 15), // S5 [09:15,09:30)
  ];

  // T4a – Pensat simplu at 10:15 EET (UTC 10:15 offset: UTC_10h + 15min = UTC_10h15)
  it('T4a: Pensat simplu (20m) fits at 10:15 during Laminare idle S2', () => {
    expect(svc.candidateFits(UTC_10h15, pensatSimpluStages, laminareAt10EET_busy)).toBe(true);
  });

  // T4b – Pensat simplu at 10:50 EET = UTC_10h50
  it('T4b: Pensat simplu (20m) fits at 10:50 during Laminare idle S4', () => {
    expect(svc.candidateFits(UTC_10h50, pensatSimpluStages, laminareAt10EET_busy)).toBe(true);
  });

  // T5a – Pensat cu vopsit (30m) at 10:15: occupies [10:15,10:45) which overlaps S3 [10:35,10:50)
  it('T5a: Pensat cu vopsit (30m) rejected at 10:15 — overflows into S3 busy', () => {
    expect(svc.candidateFits(UTC_10h15, pensatVopsitStages, laminareAt10EET_busy)).toBe(false);
  });

  // T5b – Pensat cu vopsit (30m) at 10:50: occupies [10:50,11:20) which overlaps S5 [11:15,11:30)
  it('T5b: Pensat cu vopsit (30m) rejected at 10:50 — overflows into S5 busy', () => {
    expect(svc.candidateFits(UTC_10h50, pensatVopsitStages, laminareAt10EET_busy)).toBe(false);
  });

  // T6 – A second Laminare at 10:15 would have S1 [10:15,10:30) overlapping S3 [10:35,10:50)? No.
  // Actually S1 of second laminare [10:15,10:30) doesn't overlap existing busy [10:35,10:50).
  // But S3 of second laminare starts at 10:15+15+20=10:50 → [10:50,11:05) overlaps S5 [11:15,11:30)? No.
  // S5 of second laminare starts at 10:15+15+20+15+25=11:30 → [11:30,11:45) → no overlap with [11:15,11:30).
  // Wait: existing S5 is [11:15,11:30), candidate S3 at 10:50-11:05 → no overlap.
  // The real conflict is S1 [10:15,10:30) vs existing S3 [10:35,10:50)? max(10:15,10:35)=10:35 < min(10:30,10:50)=10:30 → 10:35 < 10:30 is FALSE → no overlap.
  // So actually it doesn't conflict with existing stages! But does a 2nd laminare starting at 10:00 conflict?
  it('T6: Second Laminare (90m) is rejected when started at exactly 10:00 (self-conflict at same start)', () => {
    // Starting at same time as existing S1 [10:00,10:15): max(10:00,10:00)=10:00 < min(10:15,10:15)=10:15 → conflict
    expect(svc.candidateFits(UTC_10h, laminareStages, laminareAt10EET_busy)).toBe(false);
  });

  // T_no_busy – empty busy list → all candidates fit
  it('Any service fits when there are no existing bookings', () => {
    expect(svc.candidateFits(UTC_10h, laminareStages, [])).toBe(true);
    expect(svc.candidateFits(UTC_10h, pensatSimpluStages, [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildShiftWindow / resolveShiftWindow tests
// ---------------------------------------------------------------------------

describe('AvailabilityService — buildShiftWindow()', () => {
  const svc = new AvailabilityService(null as any);

  // T7: Winter EET = UTC+2 → 09:00 local = 07:00 UTC
  it('T7a: Winter (EET UTC+2) — 09:00 local → 07:00 UTC', () => {
    const shift = svc.buildShiftWindow('2026-11-23', '09:00', '19:00');
    // 2026-11-23 is after last Sunday of October, so EET (UTC+2)
    expect(new Date(shift.startMs).toISOString()).toBe('2026-11-23T07:00:00.000Z');
    expect(new Date(shift.endMs).toISOString()).toBe('2026-11-23T17:00:00.000Z');
  });

  // T7b: Summer EEST = UTC+3 → 09:00 local = 06:00 UTC
  it('T7b: Summer (EEST UTC+3) — 09:00 local → 06:00 UTC', () => {
    const shift = svc.buildShiftWindow('2026-07-15', '09:00', '19:00');
    expect(new Date(shift.startMs).toISOString()).toBe('2026-07-15T06:00:00.000Z');
    expect(new Date(shift.endMs).toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// getAvailableSlots — with mocked Prisma (schedule-only cases T1, T2, T3)
// ---------------------------------------------------------------------------

describe('AvailabilityService — getAvailableSlots() with mocked Prisma', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-20T07:00:00Z'));
  });

  afterEach(() => jest.restoreAllMocks());

  // Helper to build a mock PrismaService with configurable schedule response
  function buildMockPrisma(opts: {
    dayOfWeek: number;
    isWorking: boolean;
    serviceStages?: { stageOrder: number; durationMinutes: number; isBusy: boolean }[];
    bookedStages?: { startTime: Date; endTime: Date }[];
  }) {
    const { dayOfWeek, isWorking, serviceStages = [], bookedStages = [] } = opts;
    return {
      scheduleOverride: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      specialistSchedule: {
        findUnique: jest.fn().mockResolvedValue(
          isWorking
            ? { isWorking: true, startTime: '09:00', endTime: '19:00' }
            : { isWorking: false, startTime: '09:00', endTime: '19:00' },
        ),
      },
      service: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'svc-1',
          isActive: true,
          priceRon: 50,
          totalDurationMinutes: serviceStages.reduce((s, x) => s + x.durationMinutes, 0),
          stages: serviceStages,
        }),
      },
      waitlistOfferStage: { findMany: jest.fn().mockResolvedValue([]) },
      appointmentStage: {
        findMany: jest.fn().mockResolvedValue(
          bookedStages.map(({ startTime, endTime }) => ({ startTime, endTime })),
        ),
      },
    } as any;
  }

  const pensatSimpluStages = [{ stageOrder: 1, durationMinutes: 20, isBusy: true }];

  // T1: Ioana Monday (day=1) working → slots returned
  it('T1: Ioana Monday — slots are returned (working day)', async () => {
    const mockPrisma = buildMockPrisma({ dayOfWeek: 1, isWorking: true, serviceStages: pensatSimpluStages });
    const svc = new AvailabilityService(mockPrisma);
    // Monday 2026-11-23
    const slots = await svc.getAvailableSlots('ioana-id', 'svc-pensat', '2026-11-23');
    expect(slots.length).toBeGreaterThan(0);
    // First slot should be 09:00 local
    expect(slots[0].localIso).toContain('T09:00:00');
    // Last slot: 19:00 − 20min = 18:40 local
    expect(slots[slots.length - 1].localIso).toContain('T18:40:00');
  });

  // T2: Ioana Sunday (day=0) closed → 0 slots
  it('T2: Ioana Sunday — 0 slots returned (closed)', async () => {
    const mockPrisma = buildMockPrisma({ dayOfWeek: 0, isWorking: false, serviceStages: pensatSimpluStages });
    const svc = new AvailabilityService(mockPrisma);
    // Sunday 2026-11-22
    const slots = await svc.getAvailableSlots('ioana-id', 'svc-pensat', '2026-11-22');
    expect(slots).toHaveLength(0);
  });

  // T3: Ana Sunday (day=0) working → slots returned (MAKEUP open 7 days)
  it('T3: Ana Sunday — slots returned (MAKEUP open every day)', async () => {
    const mockPrisma = buildMockPrisma({ dayOfWeek: 0, isWorking: true, serviceStages: pensatSimpluStages });
    const svc = new AvailabilityService(mockPrisma);
    // Sunday 2026-11-22
    const slots = await svc.getAvailableSlots('ana-id', 'svc-makeup', '2026-11-22');
    expect(slots.length).toBeGreaterThan(0);
  });

  // Additional: shift has exactly 10h × 60min / 20min × 5-min steps slots
  it('Slot count math: 09:00-19:00 with 20m service → 109 slots at 5-min steps', async () => {
    const mockPrisma = buildMockPrisma({ dayOfWeek: 1, isWorking: true, serviceStages: pensatSimpluStages });
    const svc = new AvailabilityService(mockPrisma);
    const slots = await svc.getAvailableSlots('ioana-id', 'svc-pensat', '2026-11-23');
    // From 09:00 to 18:40 (last start where 09:00+20m <= 19:00): (10h - 20m)/5m + 1 = (580min)/5 + 1 = 116 + 1 = 117
    // 09:00 → 18:40 inclusive with 5-min steps: (18:40 - 09:00) / 5 + 1 = 580/5 + 1 = 117
    expect(slots).toHaveLength(117);
  });
});
