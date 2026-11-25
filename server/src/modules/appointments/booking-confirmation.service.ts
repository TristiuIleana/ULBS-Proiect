import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

@Injectable()
export class BookingConfirmationService {
  private readonly logger = new Logger(BookingConfirmationService.name);
  private readonly transport = createTransport({
    host: process.env.SMTP_HOST || 'mailpit',
    port: Number(process.env.SMTP_PORT || 1025),
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 5000,
  });

  async send(email: string, booking: {
    id: string;
    serviceName: string;
    specialistName: string;
    startsAtLocal: string;
    totalPriceRon: string;
  }): Promise<'sent' | 'failed'> {
    const dateTime = new Intl.DateTimeFormat('ro-RO', {
      timeZone: 'Europe/Bucharest',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(booking.startsAtLocal));
    try {
      await this.transport.sendMail({
        from: 'Beauty Studio <programari@beautystudio.local>',
        to: { name: '', address: email },
        subject: 'Programare confirmată la Beauty Studio',
        text: [
          'Programarea ta la Beauty Studio este confirmată.',
          `Serviciu: ${booking.serviceName}`,
          `Specialistă: ${booking.specialistName}`,
          `Data și ora: ${dateTime} (Europe/Bucharest)`,
          `Preț: ${booking.totalPriceRon} RON`,
        ].join('\n'),
      });
      return 'sent';
    } catch {
      this.logger.error(`Trimiterea confirmării SMTP a eșuat pentru programarea ${booking.id}.`);
      return 'failed';
    }
  }
}
