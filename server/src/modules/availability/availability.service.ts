import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AvailableSlot,
  BusyInterval,
  ShiftWindow,
  StageTemplate,
} from './availability.types';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

/** IANA timezone for the salon. All local times (schedules, display) use this. */
const SALON_TZ = 'Europe/Bucharest';

/** Candidate slot resolution in milliseconds (5-minute grid). */
const SLOT_STEP_MS = 5 * 60 * 1000;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns available start times (in SALON_TZ) for a given service, date and
   * specialist.
   *
   * Algorithm:
   * 1. Resolve the specialist's working shift for the given date in SALON_TZ → UTC
   *    bounds [W_start, W_end).
   * 2. Fetch all CONFIRMED busy AppointmentStage intervals for the specialist
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

    const stages: StageTemplate[] = service.stages.map((s) => ({
      stageOrder: s.stageOrder,
      durationMinutes: s.durationMinutes,
      isBusy: s.isBusy,
    }));

    const totalMs = stages.reduce((s, st) => s + st.durationMinutes * 60_000, 0);

    // 3. Fetch busy intervals for the specialist during this shift window
    const bookedStages = await this.prisma.appointmentStage.findMany({
      where: {
        specialistId,
        isBusy: true,
        status: 'CONFIRMED',
        startTime: { lt: new Date(shift.endMs) },
        endTime: { gt: new Date(shift.startMs) },
      },
      select: { startTime: true, endTime: true },
    });

    const busyIntervals: BusyInterval[] = bookedStages.map((s) => ({
      startMs: s.startTime.getTime(),
      endMs: s.endTime.getTime(),
    }));

    // 4. Walk candidate slots
    const slots: AvailableSlot[] = [];

    for (
      let candMs = shift.startMs;
      candMs + totalMs <= shift.endMs;
      candMs += SLOT_STEP_MS
    ) {
      if (this.candidateFits(candMs, stages, busyIntervals)) {
        slots.push({
          utcMs: candMs,
          localIso: this.toLocalIso(candMs),
        });
      }
    }

    return slots;
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
  ): Promise<ShiftWindow | null> {
    // Check date-specific override first
    const override = await this.prisma.scheduleOverride.findUnique({
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

    const schedule = await this.prisma.specialistSchedule.findUnique({
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
      new Date(`${date}T${startLocal}:00`),
      SALON_TZ,
    ).getTime();
    const endMs = fromZonedTime(
      new Date(`${date}T${endLocal}:00`),
      SALON_TZ,
    ).getTime();
    return { startMs, endMs };
  }

  /** Formats a UTC ms timestamp as a local ISO string in SALON_TZ. */
  toLocalIso(utcMs: number): string {
    const zonedDate = toZonedTime(new Date(utcMs), SALON_TZ);
    return format(zonedDate, "yyyy-MM-dd'T'HH:mm:ssxxx", { timeZone: SALON_TZ });
  }
}
