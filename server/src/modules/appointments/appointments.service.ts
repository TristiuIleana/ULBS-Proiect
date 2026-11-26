import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma, ServiceCategory } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { StageTemplate } from '../availability/availability.types';
import { allocateLoyalty, assertNotBlocked, emailKey, guestProfile, lockClient, lockEmail } from '../client-access/client-records';
import { ContactDto, SlotBookingDto } from './public-booking.dto';

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

  async reserve(tx: Prisma.TransactionClient, req: BookingInput, sessionClientId?: string, offerId?: string) {
    if ('slotUtcMs' in req) assertNotPast(req.slotUtcMs);
    const specialist = await lockSpecialist(tx, req.specialistId);
    const { service, stages } = await this.fit(tx, req, specialist?.category, { offerId });
    const data: Prisma.AppointmentUncheckedCreateInput = {
      specialistId: req.specialistId, serviceId: req.serviceId, startTime: stages[0].startTime,
      endTime: stages[stages.length - 1].endTime, totalPriceRon: service.priceRon, basePriceRon: service.priceRon,
      status: AppointmentStatus.PENDING_CONFIRMATION, confirmationToken: randomUUID(),
      stages: { create: stages.map(stage => ({ ...stage, status: AppointmentStatus.PENDING_CONFIRMATION })) },
    };
    if ('clientId' in req) {
      data.clientId = req.clientId;
    } else if (sessionClientId) {
      const user = await lockClient(tx, sessionClientId);
      if (!user) throw new NotFoundException('Contul nu există.');
      assertNotBlocked(user);
      data.clientId = user.id;
    } else if (req.email) {
      const email = emailKey(req.email);
      await lockEmail(tx, email);
      assertNotBlocked(await guestProfile(tx, email));
      Object.assign(data, {
        guestFirstName: req.firstName, guestLastName: req.lastName,
        guestPhone: req.phone, guestEmail: req.email,
      });
    } else {
      throw new BadRequestException('Datele de contact sunt obligatorii.');
    }
    if ('slotUtcMs' in req) assertNotPast(req.slotUtcMs);
    const booking = await tx.appointment.create({ data, include: summaryRelations });
    if (!sessionClientId) return booking;
    await allocateLoyalty(tx, sessionClientId);
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
    const slots = shift
      ? await this.availability.getSlotsForShift(req.specialistId, shift, service.stages, tx, omit)
      : [];
    const slot = slots.find(({ localIso, utcMs }) => 'slotUtcMs' in req
      ? utcMs === req.slotUtcMs : localIso.startsWith(`${date}T${req.startTimeLocal}`));
    if (!slot) throw new ConflictException('Intervalul nu mai este disponibil.');
    return { service, stages: bookingStages(slot.utcMs, req.specialistId, service.stages) };
  }
}
