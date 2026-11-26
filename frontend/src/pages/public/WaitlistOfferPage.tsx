import { useEffect, useState } from 'react';
import { post, request } from '../../booking-api';
import type { Confirmation } from '../../booking-api';
import { errorMessage, localDateTime, price } from '../../components/public/BookingControls';
import { PendingBookingNotice } from '../../components/public/PendingBookingNotice';

interface Offer {
  serviceName: string;
  startsAtLocal: string;
  expiresAt: string;
}

export function WaitlistOfferPage() {
  const token = new URLSearchParams(location.search).get('token');
  const [offer, setOffer] = useState<Offer>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    request<Offer>(`/api/waitlist/offer?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setOffer(value); })
      .catch(error => {
        if (!controller.signal.aborted) setError(errorMessage(error, 'Nu am putut încărca oferta.'));
      });
    return () => controller.abort();
  }, [token]);

  async function claim() {
    if (!token || pending) return;
    setPending(true);
    setError('');
    try {
      setConfirmation(await post<Confirmation>('/api/waitlist/claim', { token }));
    } catch (error) {
      setError(errorMessage(error, 'Nu am putut revendica oferta.'));
    } finally {
      setPending(false);
    }
  }

  return <main className="booking-page"><section className="card confirmation">
    <h1>{confirmation ? (confirmation.status === 'CONFIRMED' ? 'Programare confirmată' : 'Programare salvată') : 'Oferta ta prioritară'}</h1>
    {token && !offer && !error && <p role="status">Se încarcă oferta…</p>}
    {(!token || error) && <p className="feedback error" role="alert">{error || 'Linkul de ofertă este incomplet.'}</p>}
    {offer && <>
      <p><strong>{offer.serviceName}</strong> · {localDateTime.format(new Date(offer.startsAtLocal))}</p>
      {!confirmation && <p>Poți rezerva intervalul până la {localDateTime.format(new Date(offer.expiresAt))}.</p>}
    </>}
    {offer && !confirmation && <button type="button" className="primary-button" onClick={() => void claim()} disabled={pending}>
      {pending ? 'Se rezervă…' : 'Rezervă intervalul'}
    </button>}
    {confirmation && <>
      <p>{price(confirmation.totalPriceRon)}</p>
      {confirmation.status === 'PENDING_CONFIRMATION' && <PendingBookingNotice
        path={`/api/bookings/${confirmation.id}`} credentials={{ resendToken: confirmation.resendToken }}
        emailStatus={confirmation.emailStatus} />}
    </>}
    <a className="text-link" href="/">Înapoi la rezervare</a>
  </section></main>;
}
