/**
 * concurrency.spec.ts
 *
 * Integration test proving no double-booking under simultaneous booking attempts.
 * Does NOT require a running DB — it validates the in-memory row-lock logic by
 * verifying that our AppointmentsService correctly serialises concurrent calls
 * through lock acquisition and re-verification.
 *
 * Plan test #6:
 *   Fire N concurrent booking attempts for the exact same slot.
 *   Exactly 1 must succeed; the rest must throw ConflictException.
 */

import { ConflictException } from '@nestjs/common';
import { AppointmentsService } from '../src/modules/appointments/appointments.service';
import { AvailabilityService } from '../src/modules/availability/availability.service';

// ---------------------------------------------------------------------------
// Deterministic concurrency mock
// ---------------------------------------------------------------------------

/**
 * Simulates the row lock with a queue and the re-check with a shared
 * "booked" flag.
 */
function buildSerialService(): AppointmentsService {
  let booked = false; // shared state across concurrent calls, like a DB flag
  let lockReleased = Promise.resolve();

  const mockAvailability = {
    resolveShiftWindow: jest.fn().mockResolvedValue({
      startMs: Date.UTC(2026, 10, 23, 7, 0, 0),
      endMs: Date.UTC(2026, 10, 23, 17, 0, 0),
    }),
    getSlotsForShift: jest.fn().mockImplementation(async () => booked ? [] : [
      { localIso: '2026-11-23T10:15:00+02:00', utcMs: Date.UTC(2026, 10, 23, 8, 15, 0) },
    ]),
  } as unknown as AvailabilityService;

  const service = {
    findUnique: jest.fn().mockResolvedValue({
      category: 'BROWS',
      priceRon: 180,
      stages: [
        { stageOrder: 1, durationMinutes: 15, isBusy: true },
        { stageOrder: 2, durationMinutes: 20, isBusy: false },
        { stageOrder: 3, durationMinutes: 15, isBusy: true },
        { stageOrder: 4, durationMinutes: 25, isBusy: false },
        { stageOrder: 5, durationMinutes: 15, isBusy: true },
      ],
    }),
  };
  const mockPrisma = {
    $transaction: jest.fn().mockImplementation(async (fn) => {
      let releaseLock: (() => void) | undefined;
      const tx = {
        service,
        $queryRaw: jest.fn().mockImplementation(async () => {
          const previousLock = lockReleased;
          lockReleased = new Promise<void>((resolve) => {
            releaseLock = resolve;
          });
          await previousLock;
          return [{ category: 'BROWS' }];
        }),
        appointment: {
          create: jest.fn().mockImplementation(async (data) => {
            booked = true; // mark as taken
            return { id: 'appt-created', ...data.data };
          }),
        },
      };
      try {
        return await fn(tx);
      } finally {
        releaseLock?.();
      }
    }),
  } as any;

  return new AppointmentsService(mockPrisma, mockAvailability);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppointmentsService — concurrency (plan test #6)', () => {
  const baseRequest = {
    specialistId: 'ioana-id',
    serviceId: 'svc-laminare',
    clientId: 'client-1',
    date: '2026-11-23',
    startTimeLocal: '10:15',
  };

  it('T6: exactly 1 of 5 concurrent booking attempts succeeds; 4 receive ConflictException', async () => {
    const svc = buildSerialService();

    const attempts = Array.from({ length: 5 }, () =>
      svc.bookAppointment({ ...baseRequest }).catch((e) => e),
    );

    const results = await Promise.all(attempts);

    const successes = results.filter((r) => !(r instanceof Error));
    const conflicts = results.filter(
      (r) => r instanceof ConflictException,
    );

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(4);
  });

  it('T6b: a single booking with no contention always succeeds', async () => {
    const svc = buildSerialService();
    const result = await svc.bookAppointment({ ...baseRequest });
    expect(result).toHaveProperty('id');
  });
});
