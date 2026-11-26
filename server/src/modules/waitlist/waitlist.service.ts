import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WaitlistWindow } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { bookingStages, lockSpecialist } from '../appointments/appointments.service';
import { ContactDto } from '../appointments/public-booking.dto';
import { AvailabilityService } from '../availability/availability.service';
import { BusyInterval } from '../availability/availability.types';
import { assertNotBlocked, emailKey, guestProfile, lockClient, lockEmail } from '../client-access/client-records';
import { deliveryFailedBeforeAcceptance, MailService } from '../notifications/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const priorityMs = 30 * 60_000;
export const matchesWindow = (window: WaitlistWindow, time: string) =>
  window === 'ANY' || (window === 'MORNING' ? time < '13:00' : time >= '13:00');

export type WaitlistRequest = ContactDto & {
  specialistId: string; serviceId: string; date: string; window: WaitlistWindow;
};

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(private readonly db: PrismaService, private readonly availability: AvailabilityService,
    private readonly mail: MailService) {}

  async enroll(data: WaitlistRequest, userId?: string) {
    const day = new Date(`${data.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(day.getTime()) ||
      day.toISOString().slice(0, 10) !== data.date || day.getUTCFullYear() === 0) {
      throw new BadRequestException('Data nu este validă.');
    }
    return this.db.$transaction(async tx => {
      const specialist = await lockSpecialist(tx, data.specialistId);
      const service = await tx.service.findUnique({
        where: { id: data.serviceId, isActive: true },
        include: { stages: { orderBy: { stageOrder: 'asc' } } },
      });
      if (!specialist || !service) throw new NotFoundException('Serviciul sau specialista nu este disponibilă.');
      if (service.category !== specialist.category) throw new BadRequestException('Specialista nu oferă acest serviciu.');
      const shift = await this.availability.resolveShiftWindow(data.specialistId, data.date, tx);
      const choices = shift ? await this.availability.getSlotChoices(data.specialistId, shift, service.stages, tx) : [];
      const inWindow = choices.filter(slot => matchesWindow(data.window, slot.localIso.slice(11, 16)));
      if (!inWindow.length) throw new ConflictException('Intervalul solicitat este în afara programului disponibil.');
      if (inWindow.some(slot => slot.available)) throw new ConflictException('Există ore disponibile pentru acest interval.');
      const email = emailKey(data.email);
      if (!userId) await lockEmail(tx, email);
      assertNotBlocked(userId ? await lockClient(tx, userId) : await guestProfile(tx, email));
      const identity = userId ? { clientId: userId } : {
        guestFirstName: data.firstName, guestLastName: data.lastName, guestPhone: data.phone, guestEmail: email,
      };
      const scope = {
        specialistId: data.specialistId, serviceId: data.serviceId, desiredDate: data.date, window: data.window,
      };
      const existing = await tx.waitlistEntry.findFirst({
        where: { ...scope, ...(userId ? { clientId: userId } : { guestEmail: email }), status: { in: ['WAITING', 'NOTIFIED'] } },
        select: { id: true },
      });
      return existing ?? tx.waitlistEntry.create({ data: { ...scope, ...identity }, select: { id: true } });
    });
  }

  async offer(tx: Prisma.TransactionClient, specialistId: string, date: string, released: BusyInterval[]) {
    if (released.length === 0) return;
    const shift = await this.availability.resolveShiftWindow(specialistId, date, tx);
    if (!shift) return;
    const entries = await tx.waitlistEntry.findMany({
      where: { specialistId, desiredDate: date, status: 'WAITING', service: { isActive: true } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        client: { select: { email: true, lateCancellationCount: true } },
        service: { include: { stages: { orderBy: { stageOrder: 'asc' } } } },
      },
    });
    for (const entry of entries) {
      if (!entry.client?.email && !entry.guestEmail) continue;
      if ((entry.client?.lateCancellationCount ?? 0) >= 3) continue;
      if (!entry.client && entry.guestEmail && await tx.user.findFirst({
        where: { email: { equals: entry.guestEmail, mode: 'insensitive' }, role: 'CLIENT', lateCancellationCount: { gte: 3 } },
        select: { id: true },
      })) continue;
      const slots = await this.availability.getSlotsForShift(specialistId, shift, entry.service.stages, tx);
      const slot = slots.find(candidate => matchesWindow(entry.window, candidate.localIso.slice(11, 16)) &&
        !this.availability.candidateFits(candidate.utcMs, entry.service.stages, released));
      if (!slot) continue;
      const offerStages = bookingStages(slot.utcMs, specialistId, entry.service.stages)
        .filter(stage => stage.isBusy).map(({ startTime, endTime }) => ({ startTime, endTime }));
      const now = Date.now();
      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: 'NOTIFIED', priorityToken: randomUUID(), offeredStartAt: new Date(slot.utcMs),
          expiresAt: new Date(Math.min(now + priorityMs, slot.utcMs)),
          offerStages: { create: offerStages },
        },
      });
      return entry.id;
    }
  }

  async expire() {
    const now = new Date(Date.now());
    const expired = await this.db.waitlistEntry.findMany({
      where: { status: 'NOTIFIED', expiresAt: { lte: now } }, select: { id: true, specialistId: true },
    });
    for (const { id, specialistId } of expired) {
      await this.db.$transaction(async tx => {
        await lockSpecialist(tx, specialistId);
        const entry = await tx.waitlistEntry.findFirst({
          where: { id, status: 'NOTIFIED', expiresAt: { lte: now } }, include: { offerStages: true },
        });
        if (!entry) return;
        await tx.waitlistEntry.update({ where: { id }, data: { status: 'EXPIRED' } });
        await this.offer(tx, specialistId, entry.desiredDate, entry.offerStages.map(stage => ({
          startMs: stage.startTime.getTime(), endMs: stage.endTime.getTime(),
        })));
      });
    }
  }

  async notifyPending(id?: string) {
    const pending = {
      id, status: 'NOTIFIED' as const, notifiedAt: null, emailClaimedAt: null,
      expiresAt: { gt: new Date(Date.now()) },
    };
    const entries = await this.db.waitlistEntry.findMany({
      where: pending,
      include: { service: { select: { name: true } }, client: { select: { email: true } } },
    });
    for (const entry of entries) {
      const address = entry.client?.email ?? entry.guestEmail;
      if (!address || !entry.priorityToken || !entry.offeredStartAt || !entry.expiresAt) continue;
      const claimed = await this.db.waitlistEntry.updateMany({
        where: { ...pending, id: entry.id }, data: { emailClaimedAt: new Date(Date.now()) },
      });
      if (claimed.count !== 1) continue;
      try {
        const when = this.availability.toLocalIso(entry.offeredStartAt.getTime());
        const link = this.mail.link('/oferta', entry.priorityToken);
        await this.mail.send(address, 'Un interval s-a eliberat la Beauty Studio',
          `Serviciu: ${entry.service.name}\nData și ora: ${when.slice(0, 10)} ${when.slice(11, 16)}\n` +
          `Oferta este prioritară timp de până la 30 de minute. Confirmă aici:\n${link}`,
          `<waitlist-${entry.id}@beautystudio.local>`);
        await this.db.waitlistEntry.update({ where: { id: entry.id }, data: { notifiedAt: new Date(Date.now()) } });
      } catch (error) {
        if (deliveryFailedBeforeAcceptance(error)) {
          await this.db.waitlistEntry.update({ where: { id: entry.id }, data: { emailClaimedAt: null } });
        }
        this.logger.warn(`Oferta Waitlist ${entry.id} nu are livrarea confirmată.`);
      }
    }
  }
}
