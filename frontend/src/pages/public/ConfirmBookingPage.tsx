import { useEffect, useState } from 'react';
import { request } from '../../booking-api';
import { errorMessage } from '../../components/public/BookingControls';

export function ConfirmBookingPage() {
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    request<{ managementToken: string }>('/api/bookings/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }), signal: controller.signal,
    }).then(({ managementToken }) => {
      if (!controller.signal.aborted) location.replace(`/programare?token=${encodeURIComponent(managementToken)}`);
    }).catch(error => {
      if (!controller.signal.aborted) setError(errorMessage(error, 'Nu am putut confirma programarea.'));
    });
    return () => controller.abort();
  }, [token]);

  return <main className="booking-page"><section className="card confirmation">
    <h1>Confirmarea programării</h1>
    {token && !error ? <p role="status">Se confirmă programarea…</p>
      : <p className="feedback error" role="alert">{error || 'Linkul de confirmare este incomplet.'}</p>}
    <a className="text-link" href="/">Înapoi la rezervare</a>
  </section></main>;
}
