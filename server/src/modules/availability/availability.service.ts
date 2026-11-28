import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { Subject, filter } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { occupyingAppointment } from '../appointments/confirmation-deadline';
import {
  AvailableSlot,
  BusyInterval,
  ShiftWindow,
  StageTemplate,
} from './availability.types';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/** IANA timezone for the salon. All local times (schedules, display) use this. */
export const SALON_TZ = 'Europe/Bucharest';

/** Candidate slot resolution in milliseconds (5-minute grid). */
const SLOT_STEP_MS = 5 * 60 * 1000;

export const activeAppointmentStatuses: AppointmentStatus[] = ['PENDING_CONFIRMATION', 'CONFIRMED'];

@Injectable()
export class AvailabilityService {
  private readonly updates = new Subject<{ specialistId: string; date: string }>();

  constructor(private readonly prisma: PrismaService) {}

  changes(specialistId: string) {
    return this.updates.pipe(filter(update => update.specialistId === specialistId));
  }

  invalidate(specialistId: string, startTime: Date) {
    this.updates.next({ specialistId, date: this.toLocalIso(startTime.getTime()).slice(0, 10) });
  }

  async getDays(specialistId: string, date: string, stages: StageTemplate[], appointmentId?: string) {
    const start = Date.parse(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start) ||
        date < '0001-01-01' || new Date(start).toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('Data nu este validă.');
    }
    const dayMs = 86_400_000;
    const count = Math.min(6, 1 + (Date.UTC(9999, 11, 30) - start) / dayMs);
    const days = await Promise.all(Array.from({ length: count }, async (_, index) => {
      const day = new Date(start + index * dayMs).toISOString().slice(0, 10);
      const [shift, override] = await Promise.all([
        this.resolveShiftWindow(specialistId, day),
        this.prisma.scheduleOverride.findUnique({
          where: { specialistId_date: { specialistId, date: day } }, select: { isFullDayPolicy: true },
        }),
      ]);
      const choices = shift ? await this.getSlotChoices(specialistId, shift, stages, this.prisma, { appointmentId }) : [];
      const morning = choices.filter(slot => slot.localIso.slice(11, 16) < '13:00');
      const afternoon = choices.filter(slot => slot.localIso.slice(11, 16) >= '13:00');
      const group = (slots: typeof choices) => ({
        total: slots.length, free: slots.filter(slot => slot.available).length,
      });
      const status = !shift || !choices.length ? 'closed' : choices.some(slot => slot.available) ? 'available' : 'full';
      return { date: day, status, isFullDay: override?.isFullDayPolicy ?? false, morning: group(morning),
        afternoon: group(afternoon), choices };
    }));
    return { days };
  }

  /**
   * Returns available start times (in SALON_TZ) for a given service, date and
   * specialist.
   *
   * Algorithm:
   * 1. Resolve the specialist's working shift for the given date in SALON_TZ → UTC
   *    bounds [W_start, W_end).
   * 2. Fetch pending and confirmed busy AppointmentStage intervals for the specialist
   *    within the shift window.
   * 3. Walk candidate start times in 5-minute steps from W_start to
   *    W_end − totalDuration. For each candidate T₀:
   *    a. Simulate stage intervals [T_{j-1}, T_j) for each stage j.
   *    b. For every busy stage, check for overlap with any booked busy interval.
   *    c. If no busy stage overlaps → T₀ is available.
   */
  async getAvailableSlots(
    specialistId: string,
    serviceId: string,
    date: string, // "YYYY-MM-DD"
  ): Promise<AvailableSlot[]> {
    // 1. Resolve shift window in UTC
    const shift = await this.resolveShiftWindow(specialistId, date);
    if (!shift) return [];

    // 2. Fetch service stages
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId, isActive: true },
      include: { stages: { orderBy: { stageOrder: 'asc' } } },
    });
    if (!service) throw new NotFoundException(`Service ${serviceId} not found`);

    return this.getSlotsForShift(specialistId, shift, service.stages, this.prisma);
  }

  async getSlotsForShift(
    specialistId: string,
    shift: ShiftWindow,
    stages: StageTemplate[],
    db: Prisma.TransactionClient,
    omit: { appointmentId?: string; offerId?: string } = {},
    now = Date.now(),
  ): Promise<AvailableSlot[]> {
    const choices = await this.getSlotChoices(specialistId, shift, stages, db, omit, now);
    return choices.filter(slot => slot.available).map(({ utcMs, localIso }) => ({ utcMs, localIso }));
  }

  async getSlotChoices(
    specialistId: string,
    shift: ShiftWindow,
    stages: StageTemplate[],
    db: Prisma.TransactionClient,
    omit: { appointmentId?: string; offerId?: string } = {},
    now = Date.now(),
  ) {
    const latestStartMs = shift.endMs - stages.reduce((sum, stage) => sum + stage.durationMinutes * 60_000, 0);
    if (!stages.length || latestStartMs < now) return [];
    const busyIntervals = await this.busyIntervals(specialistId, shift, db, omit, now);
    const slots: (AvailableSlot & { available: boolean })[] = [];

    for (
      let candMs = shift.startMs;
      candMs <= latestStartMs;
      candMs += SLOT_STEP_MS
    ) {
      if (candMs >= now) {
        slots.push({
          utcMs: candMs,
          localIso: this.toLocalIso(candMs),
          available: this.candidateFits(candMs, stages, busyIntervals),
        });
      }
    }

    return slots;
  }

  private async busyIntervals(
    specialistId: string,
    shift: ShiftWindow,
    db: Prisma.TransactionClient,
    omit: { appointmentId?: string; offerId?: string },
    now: number,
  ): Promise<BusyInterval[]> {
    const range = { startTime: { lt: new Date(shift.endMs) }, endTime: { gt: new Date(shift.startMs) } };
    const select = { startTime: true, endTime: true } as const;
    const [booked, held] = await Promise.all([
      db.appointmentStage.findMany({
        where: {
          ...range, specialistId, isBusy: true, status: { in: activeAppointmentStatuses },
          appointment: occupyingAppointment(now),
          appointmentId: omit.appointmentId ? { not: omit.appointmentId } : undefined,
        },
        select,
      }),
      db.waitlistOfferStage.findMany({
        where: {
          ...range,
          entry: {
            specialistId, status: 'NOTIFIED',
            id: omit.offerId ? { not: omit.offerId } : undefined,
          },
        },
        select,
      }),
    ]);
    return [...booked, ...held].map(stage => ({
      startMs: stage.startTime.getTime(), endMs: stage.endTime.getTime(),
    }));
  }

  /**
   * Checks whether a candidate start time (UTC ms) fits without any busy-stage
   * collision against already-booked busy intervals.
   */
  candidateFits(
    candMs: number,
    stages: StageTemplate[],
    busyIntervals: BusyInterval[],
  ): boolean {
    let cursor = candMs;
    for (const stage of stages) {
      const stageStart = cursor;
      const stageEnd = cursor + stage.durationMinutes * 60_000;

      if (stage.isBusy) {
        for (const busy of busyIntervals) {
          // Half-open overlap: max(start1,start2) < min(end1,end2)
          if (Math.max(stageStart, busy.startMs) < Math.min(stageEnd, busy.endMs)) {
            return false;
          }
        }
      }

      cursor = stageEnd;
    }
    return true;
  }

  /**
   * Resolves the specialist's shift window for a given local date string.
   * Override → weekly schedule → null (closed).
   * Returns UTC ms bounds [startMs, endMs) or null if closed.
   */
  async resolveShiftWindow(
    specialistId: string,
    date: string, // "YYYY-MM-DD"
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<ShiftWindow | null> {
    // Check date-specific override first
    const override = await db.scheduleOverride.findUnique({
      where: { specialistId_date: { specialistId, date } },
    });

    if (override) {
      if (!override.isWorking || !override.startTime || !override.endTime) {
        return null; // closed
      }
      return this.buildShiftWindow(date, override.startTime, override.endTime);
    }

    // Fall back to weekly schedule
    // date = "YYYY-MM-DD"; determine day-of-week in SALON_TZ
    const localDate = toZonedTime(new Date(`${date}T12:00:00Z`), SALON_TZ);
    const dayOfWeek = localDate.getDay(); // 0 = Sunday

    const schedule = await db.specialistSchedule.findUnique({
      where: { specialistId_dayOfWeek: { specialistId, dayOfWeek } },
    });

    if (!schedule || !schedule.isWorking) return null;

    return this.buildShiftWindow(date, schedule.startTime, schedule.endTime);
  }

  /**
   * Given a local date string ("YYYY-MM-DD") and local time strings ("09:00"),
   * builds a ShiftWindow with UTC ms bounds.
   */
  buildShiftWindow(
    date: string,
    startLocal: string,
    endLocal: string,
  ): ShiftWindow {
    // fromZonedTime converts "2026-11-20T09:00:00" interpreted in SALON_TZ to UTC
    const startMs = fromZonedTime(
      `${date}T${startLocal}:00`,
      SALON_TZ,
    ).getTime();
    const endMs = fromZonedTime(
      `${date}T${endLocal}:00`,
      SALON_TZ,
    ).getTime();
    return { startMs, endMs };
  }

  /** Formats a UTC ms timestamp as a local ISO string in SALON_TZ. */
  toLocalIso(utcMs: number): string {
    return formatInTimeZone(new Date(utcMs), SALON_TZ, "yyyy-MM-dd'T'HH:mm:ssxxx");
  }
}
