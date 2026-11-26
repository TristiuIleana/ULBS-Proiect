import { useEffect, useState } from 'react';
import { post, request } from '../../booking-api';
import type { Confirmation } from '../../booking-api';
import { errorMessage, localDateTime, price } from '../../components/public/BookingControls';

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
      setError(errorMessage(error, 'Nu am putut confirma oferta.'));
    } finally {
      setPending(false);
    }
  }

  return <main className="booking-page"><section className="card confirmation">
    <h1>{confirmation ? 'Programare confirmată' : 'Oferta ta prioritară'}</h1>
    {token && !offer && !error && <p role="status">Se încarcă oferta…</p>}
    {(!token || error) && <p className="feedback error" role="alert">{error || 'Linkul de ofertă este incomplet.'}</p>}
    {offer && <>
      <p><strong>{offer.serviceName}</strong> · {localDateTime.format(new Date(offer.startsAtLocal))}</p>
      {!confirmation && <p>Poți confirma până la {localDateTime.format(new Date(offer.expiresAt))}.</p>}
    </>}
    {offer && !confirmation && <button type="button" className="primary-button" onClick={() => void claim()} disabled={pending}>
      {pending ? 'Se confirmă…' : 'Confirmă programarea'}
    </button>}
    {confirmation && <p>{price(confirmation.totalPriceRon)} · {confirmation.emailStatus === 'sent'
      ? 'Am trimis confirmarea prin e-mail.' : 'Programarea este salvată. Confirmarea prin e-mail nu a putut fi trimisă.'}</p>}
    <a className="text-link" href="/">Înapoi la rezervare</a>
  </section></main>;
}
