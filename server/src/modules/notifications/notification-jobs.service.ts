import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { deliveryFailedBeforeAcceptance, MailService } from './mail.service';

const hour = 60 * 60_000;

function dueReminder(now: number): Prisma.AppointmentWhereInput {
  return {
    status: 'CONFIRMED', reminderSentAt: null,
    startTime: { gte: new Date(now + 2 * hour), lte: new Date(now + 24 * hour) },
  };
}

@Injectable()
export class NotificationJobsService {
  private readonly logger = new Logger(NotificationJobsService.name);
  // Keep known-unsent claims retryable while PostgreSQL is temporarily unavailable.
  private readonly claimsToRelease = new Map<string, Date>();

  constructor(private readonly db: PrismaService, private readonly mail: MailService,
    private readonly availability: AvailabilityService, private readonly waitlist: WaitlistService) {}

  @Cron('*/15 * * * * *', { name: 'appointment-reminders' })
  async reminders() {
    for (const [id, claimedAt] of [...this.claimsToRelease]) {
      await this.releaseClaim(id, claimedAt);
    }
    const due = { ...dueReminder(Date.now()), reminderClaimedAt: null };
    const pending = await this.db.appointment.findMany({ where: due, select: { id: true } });
    for (const { id } of pending) {
      const claimedAt = new Date();
      let claimAcquired = false;
      let smtpStarted = false;
      let smtpAccepted = false;
      try {
        const claim = await this.db.appointment.updateMany({
          where: { ...due, id }, data: { reminderClaimedAt: claimedAt },
        });
        if (claim.count !== 1) continue;
        claimAcquired = true;
        await this.db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${id}::uuid FOR UPDATE`;
          const booking = await tx.appointment.findFirst({
            where: { id, ...dueReminder(Date.now()) },
            include: { client: { select: { email: true } }, service: { select: { name: true } } },
          });
          const email = booking?.client?.email ?? booking?.guestEmail;
          if (!booking || !email) {
            await tx.appointment.updateMany({ where: { id }, data: { reminderClaimedAt: null } });
            return;
          }
          const when = this.availability.toLocalIso(booking.startTime.getTime());
          const body = [
            `Serviciu: ${booking.service.name}`,
            `Data și ora: ${when.slice(0, 10)} ${when.slice(11, 16)} (Europe/Bucharest)`,
            `Detaliile programării: ${this.mail.link('/programare', booking.cancellationToken)}`,
          ].join('\n');
          smtpStarted = true;
          await this.mail.send(email, 'Reminder pentru programarea la Beauty Studio', body, `<reminder-${id}@beautystudio.local>`);
          smtpAccepted = true;
          await tx.appointment.update({ where: { id }, data: { reminderSentAt: new Date(Date.now()), reminderClaimedAt: null } });
        }, { timeout: 15_000 });
      } catch (error) {
        if (claimAcquired && (!smtpStarted || (!smtpAccepted && deliveryFailedBeforeAcceptance(error)))) {
          await this.releaseClaim(id, claimedAt);
        }
        this.logger.warn(`Reminderul pentru programarea ${id} nu are livrarea confirmată.`);
      }
    }
  }

  private async releaseClaim(id: string, claimedAt: Date) {
    try {
      await this.db.appointment.updateMany({
        where: { id, reminderSentAt: null, reminderClaimedAt: claimedAt },
        data: { reminderClaimedAt: null },
      });
      if (this.claimsToRelease.get(id) === claimedAt) this.claimsToRelease.delete(id);
    } catch {
      this.claimsToRelease.set(id, claimedAt);
      this.logger.warn(`Marcajul reminderului pentru programarea ${id} va fi reîncercat la următoarea rulare.`);
    }
  }

  @Cron('*/15 * * * * *', { name: 'waitlist-offers' })
  async waitlistOffers() {
    await this.waitlist.expire();
    await this.waitlist.notifyPending();
  }
}
