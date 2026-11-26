import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../notifications/mail.service';

@Injectable()
export class BookingConfirmationService {
  private readonly logger = new Logger(BookingConfirmationService.name);
  constructor(private readonly mail: MailService) {}

  async send(email: string, booking: {
    id: string;
    serviceName: string;
    specialistName: string;
    startsAtLocal: string;
    totalPriceRon: string;
    cancellationToken?: string;
  }): Promise<'sent' | 'failed'> {
    const dateTime = new Intl.DateTimeFormat('ro-RO', {
      timeZone: 'Europe/Bucharest',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(booking.startsAtLocal));
    try {
      await this.mail.send(email, 'Programare confirmată la Beauty Studio', [
          'Programarea ta la Beauty Studio este confirmată.',
          `Serviciu: ${booking.serviceName}`,
          `Specialistă: ${booking.specialistName}`,
          `Data și ora: ${dateTime} (Europe/Bucharest)`,
          `Preț: ${booking.totalPriceRon} RON`,
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
