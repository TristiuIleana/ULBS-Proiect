import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Appointment, AppointmentStatus, Prisma, ServiceCategory } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { StageTemplate } from '../availability/availability.types';
import { allocateLoyalty, assertNotBlocked, emailKey, guestProfile, lockClient, lockEmail } from '../client-access/client-records';
import { ContactDto, SlotBookingDto } from './public-booking.dto';
import { confirmationExpiredReason, pendingConfirmationExpired, pendingPastDeadline } from './confirmation-deadline';

export interface BookingRequest {
  specialistId: string;
  serviceId: string;
  clientId: string;
  date: string;
  startTimeLocal: string;
}

type BookingInput = BookingRequest | (SlotBookingDto & Partial<ContactDto>);

export function bookingStages(startMs: number, specialistId: string, templates: StageTemplate[]) {
  let cursor = startMs;
  return templates.map(stage => {
    const startTime = new Date(cursor);
    cursor += stage.durationMinutes * 60_000;
    return {
      specialistId, stageOrder: stage.stageOrder, isBusy: stage.isBusy,
      startTime, endTime: new Date(cursor),
    };
  });
}

export async function lockSpecialist(tx: Prisma.TransactionClient, specialistId: string) {
  const [specialist] = await tx.$queryRaw<{ category: ServiceCategory | null }[]>`
    SELECT specialist_category AS category FROM users
    WHERE id = ${specialistId}::uuid AND role IN ('ADMIN', 'SPECIALIST')
    FOR UPDATE
  `;
  return specialist;
}

function assertNotPast(ms: number) {
  if (ms < Date.now()) throw new BadRequestException('Ora de început a intervalului a trecut.');
}

export const summaryRelations = {
  service: { select: { name: true, category: true } },
  specialist: { select: { firstName: true } },
} satisfies Prisma.AppointmentInclude;

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(private readonly prisma: PrismaService, private readonly availability: AvailabilityService) {}

  async transaction<T>(change: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      return await this.prisma.$transaction(change, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (error instanceof Error && /no_specialist_busy_overlap|\b23P01\b/.test(error.message)) {
        throw new ConflictException('Intervalul nu mai este disponibil.');
      }
      throw error;
    }
  }

  async bookAppointment(req: BookingInput, sessionClientId?: string) {
    const booking = await this.transaction(tx => this.reserve(tx, req, sessionClientId));
    this.availability.invalidate(booking.specialistId, booking.startTime);
    return booking;
  }

  @Cron('*/15 * * * * *', { name: 'booking-confirmation-expiry' })
  async expirePendingConfirmations() {
    const now = Date.now();
    const due = await this.prisma.appointment.findMany({
      where: pendingPastDeadline(now), select: { id: true, specialistId: true },
    });
    for (const { id, specialistId } of due) {
      try {
        const expired = await this.transaction(async tx => {
          await lockSpecialist(tx, specialistId);
          const booking = await tx.appointment.findUnique({ where: { id } });
          if (!booking || !pendingConfirmationExpired(booking, now)) return;
          await this.cancelExpiredConfirmation(tx, booking);
          return booking;
        });
        if (expired) this.availability.invalidate(specialistId, expired.startTime);
      } catch {
        this.logger.warn(`Expirarea programării ${id} va fi reîncercată la următoarea rulare.`);
      }
    }
  }

  async cancelExpiredConfirmation(tx: Prisma.TransactionClient, booking: Appointment) {
    let { clientId } = booking;
    if (!clientId && booking.guestEmail) {
      await lockEmail(tx, booking.guestEmail);
      ({ clientId } = await tx.appointment.findUniqueOrThrow({
        where: { id: booking.id }, select: { clientId: true },
      }));
    }
    if (clientId) await lockClient(tx, clientId);
    await tx.appointment.update({
      where: { id: booking.id }, data: { status: 'CANCELLED', cancellationReason: confirmationExpiredReason },
    });
    await tx.appointmentStage.updateMany({
      where: { appointmentId: booking.id, status: 'PENDING_CONFIRMATION' }, data: { status: 'CANCELLED' },
    });
    if (clientId) await allocateLoyalty(tx, clientId);
  }

  async reserve(tx: Prisma.TransactionClient, req: BookingInput, sessionClientId?: string, offerId?: string,
    channel: 'public' | 'reception' = 'public') {
    if ('slotUtcMs' in req) assertNotPast(req.slotUtcMs);
    const specialist = await lockSpecialist(tx, req.specialistId);
    const { service, stages } = await this.fit(tx, req, specialist?.category, { offerId });
    const status = channel === 'reception' ? AppointmentStatus.CONFIRMED : AppointmentStatus.PENDING_CONFIRMATION;
    const data: Prisma.AppointmentUncheckedCreateInput = {
      specialistId: req.specialistId, serviceId: req.serviceId, startTime: stages[0].startTime,
      endTime: stages[stages.length - 1].endTime, totalPriceRon: service.priceRon, basePriceRon: service.priceRon,
      status, confirmationToken: channel === 'public' ? randomUUID() : null,
      stages: { create: stages.map(stage => ({ ...stage, status })) },
    };
    if ('clientId' in req) {
      data.clientId = req.clientId;
    } else if (sessionClientId) {
      const user = await lockClient(tx, sessionClientId);
      if (!user) throw new NotFoundException('Contul nu există.');
      assertNotBlocked(user);
      data.clientId = user.id;
    } else if (req.email || channel === 'reception') {
      if (req.email) {
        const email = emailKey(req.email);
        await lockEmail(tx, email);
        const client = await guestProfile(tx, email);
        if (channel === 'public') assertNotBlocked(client);
        else if (client?.emailVerifiedAt) data.clientId = client.id;
      }
      Object.assign(data, {
        guestFirstName: req.firstName, guestLastName: req.lastName,
        guestPhone: req.phone, guestEmail: req.email,
      });
    } else {
      throw new BadRequestException('Datele de contact sunt obligatorii.');
    }
    if ('slotUtcMs' in req) assertNotPast(req.slotUtcMs);
    data.createdAt = new Date(Date.now());
    const booking = await tx.appointment.create({ data, include: summaryRelations });
    const loyaltyClientId = sessionClientId ?? (channel === 'reception' ? data.clientId : undefined);
    if (!loyaltyClientId) return booking;
    await allocateLoyalty(tx, loyaltyClientId);
    return tx.appointment.findUniqueOrThrow({ where: { id: booking.id }, include: summaryRelations });
  }

  async fit(tx: Prisma.TransactionClient, req: BookingInput, category: ServiceCategory | null | undefined,
    omit: { appointmentId?: string; offerId?: string } = {}) {
    const service = await tx.service.findUnique({
      where: { id: req.serviceId, isActive: true },
      include: { stages: { orderBy: { stageOrder: 'asc' } } },
    });
    if (!category || !service) throw new NotFoundException('Serviciul sau specialista nu este disponibilă.');
    if (service.category !== category) throw new BadRequestException('Specialista nu oferă acest serviciu.');
    const date = 'slotUtcMs' in req ? this.availability.toLocalIso(req.slotUtcMs).slice(0, 10) : req.date;
    const shift = await this.availability.resolveShiftWindow(req.specialistId, date, tx);
    const now = Date.now();
    const slots = shift
      ? await this.availability.getSlotsForShift(req.specialistId, shift, service.stages, tx, omit, now)
      : [];
    const slot = slots.find(({ localIso, utcMs }) => 'slotUtcMs' in req
      ? utcMs === req.slotUtcMs : localIso.startsWith(`${date}T${req.startTimeLocal}`));
    if (!slot) throw new ConflictException('Intervalul nu mai este disponibil.');
    const stages = bookingStages(slot.utcMs, req.specialistId, service.stages);
    // Release expired constraints in this transaction even if the sweep has not run yet.
    await tx.appointmentStage.updateMany({
      where: {
        specialistId: req.specialistId, status: 'PENDING_CONFIRMATION',
        appointment: pendingPastDeadline(now),
        startTime: { lt: stages[stages.length - 1].endTime }, endTime: { gt: stages[0].startTime },
      },
      data: { status: 'CANCELLED' },
    });
    return { service, stages };
  }
}
