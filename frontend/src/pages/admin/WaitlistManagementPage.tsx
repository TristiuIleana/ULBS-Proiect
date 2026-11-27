import { useEffect, useState } from 'react';
import { fetchQueue, notifyEntry, staffError, studioTime, type QueueEntry } from '../../staff-api';

const states: Record<string, string> = {
  WAITING: 'În așteptare', NOTIFIED: 'Ofertă activă', CLAIMED: 'Revendicată', EXPIRED: 'Expirată',
};
const windows: Record<string, string> = { ANY: 'Orice oră', MORNING: 'Dimineață', AFTERNOON: 'După-amiază' };

export function WaitlistManagementPage({ query }: { query: Record<string, string> }) {
  const [entries, setEntries] = useState<QueueEntry[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    fetchQueue(query, abort.signal).then(response => setEntries(response.entries))
      .catch(failure => { if (!abort.signal.aborted) setError(staffError(failure)); });
    return () => abort.abort();
  }, [query, revision]);

  async function notify(id: string) {
    setPending(id);
    setError('');
    setMessage('');
    try {
      const result = await notifyEntry(id);
      setMessage(result.notified ? 'Oferta a fost expediată.' : 'Expedierea nu este încă confirmată.');
    } catch (failure) {
      setError(staffError(failure));
    } finally {
      setPending('');
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
      {entry.expiresAt && <span>Expiră la {studioTime(entry.expiresAt)}</span>}
      {entry.notifiedAt && <span>Expediată la {studioTime(entry.notifiedAt)}</span>}
      {entry.canNotify && <button className="secondary-button" disabled={Boolean(pending)}
        onClick={() => void notify(entry.id)}>{pending === entry.id ? 'Se expediază…' : 'Trimite notificarea'}</button>}
    </article>)}
  </div>;
}
