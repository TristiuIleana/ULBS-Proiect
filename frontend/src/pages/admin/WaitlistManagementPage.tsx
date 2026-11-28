import { useEffect, useState } from 'react';
import { convertEntry, fetchQueue, notifyEntry, staffError, studioTime, type QueueEntry } from '../../staff-api';

const states: Record<string, string> = {
  WAITING: 'În așteptare', NOTIFIED: 'Ofertă activă', CLAIMED: 'Revendicată', EXPIRED: 'Expirată',
};
const windows: Record<string, string> = { ANY: 'Orice oră', MORNING: 'Dimineață', AFTERNOON: 'După-amiază' };

export function WaitlistManagementPage({ query, refreshCalendar }: {
  query: Record<string, string>; refreshCalendar: () => void;
}) {
  const [entries, setEntries] = useState<QueueEntry[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ id: string; action: 'notify' | 'convert' }>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    fetchQueue(query, abort.signal).then(response => setEntries(response.entries))
      .catch(failure => { if (!abort.signal.aborted) setError(staffError(failure)); });
    return () => abort.abort();
  }, [query, revision]);

  async function act(id: string, action: 'notify' | 'convert') {
    setPending({ id, action });
    setError('');
    setMessage('');
    try {
      if (action === 'convert') {
        await convertEntry(id);
        setMessage('Programarea a fost confirmată.');
      } else {
        const result = await notifyEntry(id);
        setMessage(result.notified ? 'Oferta a fost expediată.' : 'Expedierea nu este încă confirmată.');
      }
    } catch (failure) {
      setError(staffError(failure));
    } finally {
      if (action === 'convert') refreshCalendar();
      setPending(undefined);
      setRevision(value => value + 1);
    }
  }

  return <div className="staff-form">
    {error && <p className="staff-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!entries && !error && <p role="status">Se încarcă cererile…</p>}
    {entries?.length === 0 && <p>Nu există cereri Waitlist pentru perioada selectată.</p>}
    {entries?.map(entry => <article className="staff-visit" key={entry.id}>
      <strong>{entry.firstName} {entry.lastName}</strong>
      <span>{entry.service.name} · {entry.desiredDate} · {states[entry.status] ?? entry.status}</span>
      <span>{windows[entry.window]}</span>
      {entry.offeredStartAt && <span>Ora oferită {studioTime(entry.offeredStartAt)}</span>}
      {entry.expiresAt && entry.status === 'NOTIFIED' && <span>Expiră la {studioTime(entry.expiresAt)}</span>}
      {entry.notifiedAt && <span>Expediată la {studioTime(entry.notifiedAt)}</span>}
      <div className="staff-controls">
        {entry.canNotify && <button className="secondary-button" disabled={Boolean(pending)}
          onClick={() => void act(entry.id, 'notify')}>
          {pending?.id === entry.id && pending.action === 'notify' ? 'Se expediază…' : 'Trimite notificarea'}
        </button>}
        {entry.canConvert && <button className="primary-button" disabled={Boolean(pending)}
          onClick={() => void act(entry.id, 'convert')}>
          {pending?.id === entry.id && pending.action === 'convert' ? 'Se salvează…' : 'Creează programare'}
        </button>}
      </div>
    </article>)}
  </div>;
}
