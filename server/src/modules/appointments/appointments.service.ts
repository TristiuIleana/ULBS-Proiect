import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { Prisma } from '@prisma/client';

export interface BookingRequest {
  specialistId: string;
  serviceId: string;
  clientId: string;
  /** Local date string in Europe/Bucharest, e.g. "2026-11-20" */
  date: string;
  /** Local start time, e.g. "10:15" */
  startTimeLocal: string;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /**
   * Creates an appointment with its decomposed stages inside a serializable
   * transaction.  Uses pg_advisory_xact_lock to serialise per-specialist
   * booking attempts, with the btree_gist exclusion constraint as a final
   * engine-level fallback.
   */
  async bookAppointment(req: BookingRequest) {
    const service = await this.prisma.service.findUnique({
      where: { id: req.serviceId, isActive: true },
      include: { stages: { orderBy: { stageOrder: 'asc' } } },
    });
    if (!service) throw new NotFoundException('Service not found.');

    // Build UTC start time from local date + startTimeLocal
    const { startMs, endMs: shiftEnd } =
      await this.availabilityService.resolveShiftWindow(
        req.specialistId,
        req.date,
      ).then((w) => {
        if (!w) throw new BadRequestException('Specialist is not working on this date.');
        return w;
      });

    // Find the actual requested start in UTC by scanning available slots
    const slots = await this.availabilityService.getAvailableSlots(
      req.specialistId,
      req.serviceId,
      req.date,
    );

    const target = `${req.date}T${req.startTimeLocal}`;
    const requested = slots.find((s) => s.localIso.startsWith(target));
    if (!requested) {
      throw new ConflictException('Requested time slot is not available.');
    }

    const apptStartMs = requested.utcMs;
    const totalDurationMs = service.stages.reduce(
      (sum, s) => sum + s.durationMinutes * 60_000,
      0,
    );
    const apptEndMs = apptStartMs + totalDurationMs;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Specialist-scoped advisory lock — prevents parallel transactions from
          // both passing the availability check before either commits stages.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('specialist_' || ${req.specialistId}::text))`;

          // Re-verify availability inside the lock
          const conflicts = await tx.appointmentStage.count({
            where: {
              specialistId: req.specialistId,
              isBusy: true,
              status: 'CONFIRMED',
              startTime: { lt: new Date(apptEndMs) },
              endTime: { gt: new Date(apptStartMs) },
            },
          });
          if (conflicts > 0) {
            throw new ConflictException(
              'This slot was just taken. Please choose another time.',
            );
          }

          // Insert appointment
          const appointment = await tx.appointment.create({
            data: {
              clientId: req.clientId,
              specialistId: req.specialistId,
              serviceId: req.serviceId,
              startTime: new Date(apptStartMs),
              endTime: new Date(apptEndMs),
              totalPriceRon: service.priceRon,
              status: 'CONFIRMED',
            },
          });

          // Insert decomposed stages
          let cursor = apptStartMs;
          for (const stage of service.stages) {
            const stageStart = cursor;
            const stageEnd = cursor + stage.durationMinutes * 60_000;

            await tx.appointmentStage.create({
              data: {
                appointmentId: appointment.id,
                specialistId: req.specialistId,
                stageOrder: stage.stageOrder,
                startTime: new Date(stageStart),
                endTime: new Date(stageEnd),
                isBusy: stage.isBusy,
                status: 'CONFIRMED',
              },
            });

            cursor = stageEnd;
          }

          return appointment;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err: any) {
      // PostgreSQL exclusion constraint violation → 23P01
      if (err?.code === '23P01' || err?.meta?.code === '23P01') {
        throw new ConflictException(
          'Booking conflict detected at database level. Please retry.',
        );
      }
      throw err;
    }
  }
}
