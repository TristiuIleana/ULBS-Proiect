import { useState } from 'react';
import { post } from '../../booking-api';
import type { Confirmation } from '../../booking-api';
import { errorMessage } from './BookingControls';

export function PendingBookingNotice({ path, credentials, emailStatus }: {
  path: string;
  credentials?: { token: string } | { resendToken: string };
  emailStatus?: Confirmation['emailStatus'];
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ error: boolean; message: string }>();
  const failed = 'Nu am putut trimite e-mailul de confirmare. Poți încerca din nou.';

  async function resend() {
    if (sending) return;
    setSending(true);
    setResult(undefined);
    try {
      const { emailStatus } = await post<Pick<Confirmation, 'emailStatus'>>(`${path}/resend-confirmation`, credentials);
      setResult(emailStatus === 'sent' ? { error: false, message: 'Am retrimis e-mailul de confirmare.' }
        : { error: true, message: failed });
    } catch (error) {
      setResult({ error: true, message: errorMessage(error, failed) });
    } finally {
      setSending(false);
    }
  }

  const feedback = result ?? (emailStatus === 'failed' ? { error: true, message: failed } : undefined);
  return <div className="day-banner warning pending-booking-notice">
    <span aria-hidden="true">⚠️</span>
    <div>
      <strong>Programarea NU este confirmată încă — te rugăm să accesezi linkul de confirmare trimis pe email</strong>
      {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
      <button type="button" className="secondary-button" onClick={() => void resend()} disabled={sending}>
        {sending ? 'Se trimite…' : 'Retrimite e-mailul de confirmare'}
      </button>
    </div>
  </div>;
}
