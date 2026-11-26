import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { AvailabilityService } from '../availability/availability.service';
import { MailService } from '../notifications/mail.service';
import type { AppointmentsService } from './appointments.service';

export function bookingResendToken(managementToken: string) {
  return createHmac('sha256', managementToken).update('resend-booking-confirmation').digest('hex');
}

@Injectable()
export class BookingConfirmationService {
  private readonly logger = new Logger(BookingConfirmationService.name);
  constructor(private readonly mail: MailService, private readonly availability: AvailabilityService) {}

  async notifyCreated(booking: Awaited<ReturnType<AppointmentsService['reserve']>>, email: string) {
    const summary = {
      id: booking.id, status: booking.status,
      serviceName: booking.service.name, specialistName: booking.specialist.firstName,
      startsAtLocal: this.availability.toLocalIso(booking.startTime.getTime()),
      endsAtLocal: this.availability.toLocalIso(booking.endTime.getTime()),
      totalPriceRon: booking.totalPriceRon.toString(), loyaltyDiscountRon: booking.loyaltyDiscountRon.toString(),
    };
    const emailStatus = await this.send(email, {
      ...summary, cancellationToken: booking.cancellationToken, confirmationToken: booking.confirmationToken,
    });
    return { ...summary, emailStatus, resendToken: bookingResendToken(booking.cancellationToken) };
  }

  async send(email: string, booking: {
    id: string;
    serviceName: string;
    specialistName: string;
    startsAtLocal: string;
    totalPriceRon: string;
    cancellationToken?: string;
    confirmationToken?: string | null;
  }): Promise<'sent' | 'failed'> {
    const dateTime = new Intl.DateTimeFormat('ro-RO', {
      timeZone: 'Europe/Bucharest',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(booking.startsAtLocal));
    try {
      const confirmationLink = booking.confirmationToken
        ? this.mail.link('/confirmare', booking.confirmationToken, 'fragment') : null;
      await this.mail.send(email, confirmationLink ? 'Confirmă programarea la Beauty Studio' : 'Programare confirmată la Beauty Studio', [
          confirmationLink ? 'Intervalul este rezervat. Accesează linkul de mai jos pentru a confirma programarea.'
            : 'Programarea ta la Beauty Studio este confirmată.',
          `Serviciu: ${booking.serviceName}`,
          `Specialistă: ${booking.specialistName}`,
          `Data și ora: ${dateTime} (Europe/Bucharest)`,
          `Preț: ${booking.totalPriceRon} RON`,
          ...(confirmationLink ? [`Confirmă programarea: ${confirmationLink}`] : []),
          ...(booking.cancellationToken ? [
            `Consultă sau gestionează programarea: ${this.mail.link('/programare', booking.cancellationToken)}`,
          ] : []),
        ].join('\n'));
      return 'sent';
    } catch {
      this.logger.error(`Trimiterea confirmării SMTP a eșuat pentru programarea ${booking.id}.`);
      return 'failed';
    }
  }
}
