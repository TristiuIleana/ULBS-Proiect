import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transport = createTransport({
    host: process.env.SMTP_HOST || 'mailpit',
    port: Number(process.env.SMTP_PORT || 1025),
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 5000,
  });

  async send(to: string, subject: string, text: string, messageId?: string) {
    await this.transport.sendMail({
      from: 'Beauty Studio <programari@beautystudio.local>',
      to: { name: '', address: to },
      subject, text, messageId,
    });
  }

  link(path: string, token: string, placement: 'query' | 'fragment' = 'query') {
    const url = new URL(path, process.env.PUBLIC_WEB_ORIGIN || 'http://localhost:5173');
    if (placement === 'fragment') url.hash = new URLSearchParams({ token }).toString();
    else url.searchParams.set('token', token);
    return url.href;
  }
}

export function deliveryFailedBeforeAcceptance(error: unknown) {
  if (!(error instanceof Error)) return false;
  const { command, responseCode } = error as Error & { command?: string; responseCode?: number };
  return command === 'CONN' || Boolean(responseCode && responseCode >= 400 && responseCode < 600);
}
