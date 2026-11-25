import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { PublicBookingDto } from './public-booking.dto';

export interface BookingRequest {
  specialistId: string;
  serviceId: string;
  clientId: string;
  date: string;
  startTimeLocal: string;
}

function assertSlotIsNotPast(slotUtcMs: number): void {
  if (slotUtcMs < Date.now()) {
    throw new BadRequestException('Ora de început a intervalului a trecut.');
  }
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async bookAppointment(req: BookingRequest | PublicBookingDto) {
    const isPublicBooking = 'slotUtcMs' in req;
    if (isPublicBooking) assertSlotIsNotPast(req.slotUtcMs);
    const date = isPublicBooking
      ? this.availabilityService.toLocalIso(req.slotUtcMs).slice(0, 10)
      : req.date;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // READ COMMITTED gives the recheck a fresh snapshot after the lock is acquired.
        const [specialist] = await tx.$queryRaw<{ category: ServiceCategory | null }[]>`
          SELECT specialist_category AS category
          FROM users
          WHERE id = ${req.specialistId}::uuid AND role IN ('ADMIN', 'SPECIALIST')
          FOR UPDATE
        `;
        const service = await tx.service.findUnique({
          where: { id: req.serviceId, isActive: true },
          include: { stages: { orderBy: { stageOrder: 'asc' } } },
        });
        if (!specialist || !service) {
          throw new NotFoundException('Serviciul sau specialista nu este disponibilă.');
        }
        if (service.category !== specialist.category) {
          throw new BadRequestException('Specialista nu oferă acest serviciu.');
        }

        const shift = await this.availabilityService.resolveShiftWindow(req.specialistId, date, tx);
        const slots = shift
          ? await this.availabilityService.getSlotsForShift(req.specialistId, shift, service.stages, tx)
          : [];
        const slot = slots.find(({ localIso, utcMs }) => isPublicBooking
          ? utcMs === req.slotUtcMs
          : localIso.startsWith(`${date}T${req.startTimeLocal}`));
        if (isPublicBooking) assertSlotIsNotPast(req.slotUtcMs);
        if (!slot) throw new ConflictException('Intervalul nu mai este disponibil.');

        let cursor = slot.utcMs;
        const stages = service.stages.map((stage) => {
          const startTime = new Date(cursor);
          cursor += stage.durationMinutes * 60_000;
          return {
            specialistId: req.specialistId,
            stageOrder: stage.stageOrder,
            startTime,
            endTime: new Date(cursor),
            isBusy: stage.isBusy,
            status: 'CONFIRMED' as const,
          };
        });

        const client = 'clientId' in req
          ? { clientId: req.clientId }
          : {
            guestFirstName: req.firstName,
            guestLastName: req.lastName,
            guestPhone: req.phone,
            guestEmail: req.email,
          };

        return tx.appointment.create({
          data: {
            ...client,
            specialistId: req.specialistId,
            serviceId: req.serviceId,
            startTime: new Date(slot.utcMs),
            endTime: new Date(cursor),
            totalPriceRon: service.priceRon,
            status: 'CONFIRMED',
            stages: { create: stages },
          },
          include: {
            service: { select: { name: true } },
            specialist: { select: { firstName: true } },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (error instanceof Error &&
        /no_specialist_busy_overlap|\b23P01\b/.test(error.message)) {
        throw new ConflictException('Intervalul nu mai este disponibil.');
      }
      throw error;
    }
  }
}
