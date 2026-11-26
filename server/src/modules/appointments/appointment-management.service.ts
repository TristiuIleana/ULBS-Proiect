import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Appointment, Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { allocateLoyalty, assertNotBlocked, guestProfile, lockClient, lockEmail } from '../client-access/client-records';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { AppointmentsService, lockSpecialist, summaryRelations } from './appointments.service';
import { BookingConfirmationService } from './booking-confirmation.service';

const dayMs = 24 * 60 * 60_000;
type Access = { token: string } | { id: string; clientId?: string };
type Action = 'cancel' | 'reschedule' | 'complete';

@Injectable()
export class AppointmentManagementService {
  constructor(private readonly db: PrismaService, private readonly availability: AvailabilityService,
    private readonly appointments: AppointmentsService, private readonly waitlist: WaitlistService,
    private readonly confirmation: BookingConfirmationService) {}

  private where(access: Access): Prisma.AppointmentWhereInput {
    return 'token' in access ? { cancellationToken: access.token } : { id: access.id, clientId: access.clientId };
  }

  private async canManage(tx: Prisma.TransactionClient, booking: Appointment) {
    const date = this.availability.toLocalIso(booking.startTime.getTime()).slice(0, 10);
    const day = await tx.scheduleOverride.findUnique({
      where: { specialistId_date: { specialistId: booking.specialistId, date } }, select: { isFullDayPolicy: true },
    });
    const isFullDay = day?.isFullDayPolicy ?? false;
    return {
      isFullDay, date,
      canManage: booking.status === 'CONFIRMED' && !isFullDay && booking.startTime.getTime() - Date.now() >= dayMs,
    };
  }

  async get(access: Access) {
    const booking = await this.db.appointment.findFirst({
      where: this.where(access),
      include: { ...summaryRelations, client: { select: { firstName: true, lastName: true, phone: true, email: true } } },
    });
    if (!booking) throw new NotFoundException('Programarea nu este disponibilă.');
    const { canManage, isFullDay, date } = await this.canManage(this.db, booking);
    return {
      id: booking.id, serviceId: booking.serviceId, specialistId: booking.specialistId,
      serviceName: booking.service.name, specialistName: booking.specialist.firstName, status: booking.status,
      category: booking.service.category,
      contact: booking.client ?? {
        firstName: booking.guestFirstName, lastName: booking.guestLastName,
        phone: booking.guestPhone, email: booking.guestEmail,
      },
      startsAtLocal: this.availability.toLocalIso(booking.startTime.getTime()),
      endsAtLocal: this.availability.toLocalIso(booking.endTime.getTime()),
      totalPriceRon: booking.totalPriceRon, loyaltyDiscountRon: booking.loyaltyDiscountRon,
      canManage, isFullDay, date,
    };
  }

  async change(access: Access, action: Action, admin: boolean, slotUtcMs?: number) {
    const result = await this.appointments.transaction(async tx => {
      const where = this.where(access);
      const snapshot = await tx.appointment.findFirst({ where, select: { specialistId: true } });
      if (!snapshot) throw new NotFoundException('Programarea nu este disponibilă.');
      const specialist = await lockSpecialist(tx, snapshot.specialistId);
      let booking = await tx.appointment.findFirst({
        where, include: { stages: true, ...summaryRelations },
      });
      if (!booking) throw new NotFoundException('Programarea nu este disponibilă.');
      const guestEmail = booking.guestEmail;
      if (!booking.clientId && guestEmail) {
        await lockEmail(tx, guestEmail);
        booking = await tx.appointment.findFirstOrThrow({ where, include: { stages: true, ...summaryRelations } });
      }
      const client = booking.clientId ? await lockClient(tx, booking.clientId) :
        guestEmail ? await guestProfile(tx, guestEmail) : null;

      const targetStatus = action === 'complete' ? 'COMPLETED' : 'CANCELLED';
      if (action !== 'reschedule' && booking.status === targetStatus) return { offerId: undefined };
      if (booking.status !== 'CONFIRMED') throw new ConflictException('Starea programării nu permite această acțiune.');
      const { canManage, date } = await this.canManage(tx, booking);
      if (!admin && !canManage) {
        throw new ForbiddenException('Modificarea nu mai este permisă online. Contactează salonul.');
      }
      const released = booking.stages.filter(stage => stage.isBusy).map(stage => ({
        startMs: stage.startTime.getTime(), endMs: stage.endTime.getTime(),
      }));

      if (action === 'reschedule' && slotUtcMs !== undefined) {
        if (booking.startTime.getTime() === slotUtcMs) return { offerId: undefined };
        assertNotBlocked(client);
        const { stages } = await this.appointments.fit(tx, {
          serviceId: booking.serviceId, specialistId: booking.specialistId, slotUtcMs,
        }, specialist?.category, { appointmentId: booking.id });
        await tx.appointmentStage.deleteMany({ where: { appointmentId: booking.id } });
        await tx.appointment.update({
          where: { id: booking.id },
          data: {
            startTime: stages[0].startTime, endTime: stages[stages.length - 1].endTime,
            stages: { create: stages },
          },
        });
      } else if (action === 'complete') {
        if (booking.endTime.getTime() > Date.now()) throw new ConflictException('Vizita este încă în desfășurare sau viitoare.');
        await tx.appointment.update({ where: { id: booking.id }, data: { status: targetStatus } });
        await tx.appointmentStage.updateMany({ where: { appointmentId: booking.id }, data: { status: targetStatus } });
      } else {
        const lateCancellation = booking.startTime.getTime() - Date.now() < dayMs;
        await tx.appointment.update({ where: { id: booking.id }, data: { status: targetStatus, lateCancellation } });
        await tx.appointmentStage.updateMany({ where: { appointmentId: booking.id }, data: { status: targetStatus } });
        if (lateCancellation && client) {
          await tx.user.update({ where: { id: client.id }, data: { lateCancellationCount: { increment: 1 } } });
        }
      }
      if (booking.clientId) await allocateLoyalty(tx, booking.clientId);

      const offerId = action === 'complete' ? undefined :
        await this.waitlist.offer(tx, booking.specialistId, date, released);
      const address = action === 'reschedule' ? client?.email ?? guestEmail : null;
      return { offerId, address, cancellationToken: booking.cancellationToken };
    });
    const resultView = await this.get(access);
    if (result.offerId) await this.waitlist.notifyPending(result.offerId);
    if (result.address) {
      const emailStatus = await this.confirmation.send(result.address, {
        ...resultView, totalPriceRon: resultView.totalPriceRon.toString(), cancellationToken: result.cancellationToken,
      });
      return { ...resultView, emailStatus, waitlistOffered: Boolean(result.offerId) };
    }
    return { ...resultView, waitlistOffered: Boolean(result.offerId) };
  }

  async unblock(id: string) {
    return this.db.$transaction(async tx => {
      if (!await lockClient(tx, id)) throw new NotFoundException('Contul nu există.');
      await tx.user.update({ where: { id }, data: { lateCancellationCount: 0 } });
      return { blocked: false };
    });
  }
}
