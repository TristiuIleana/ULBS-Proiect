import { useState } from 'react';
import type { FormEvent } from 'react';
import { post } from '../../booking-api';
import type { Account, BookingDay, Contact, WaitlistWindow } from '../../booking-api';
import { ContactFields, errorMessage, formatDay } from './BookingControls';

const windows: { value: WaitlistWindow; label: string }[] = [
  { value: 'ANY', label: '☀️ Oricând în timpul zilei (09:00 - 19:00)' },
  { value: 'MORNING', label: '🌅 Doar Dimineața (09:00 - 13:00)' },
  { value: 'AFTERNOON', label: '🌇 Doar După-amiaza (13:00 - 19:00)' },
];

export function WaitlistCard({ day, serviceId, specialistId, contact, changeContact, account }: {
  day: BookingDay; serviceId: string; specialistId: string; contact: Contact;
  changeContact: (value: Contact) => void; account?: Account;
}) {
  const eligible = {
    ANY: day.status === 'full',
    MORNING: day.morning.total > 0 && day.morning.free === 0,
    AFTERNOON: day.afternoon.total > 0 && day.afternoon.free === 0,
  };
  const [preferredWindow, setWindow] = useState<WaitlistWindow>();
  const window = preferredWindow && eligible[preferredWindow] ? preferredWindow
    : eligible.ANY ? 'ANY' : eligible.MORNING ? 'MORNING' : 'AFTERNOON';
  const [pending, setPending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [error, setError] = useState('');
  const details = account ?? contact;
  const date = formatDay(day.date);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !eligible[window] || account?.blocked) return;
    setError('');
    setPending(true);
    const { firstName, lastName, phone, email } = details;
    try {
      await post('/api/waitlist', { firstName, lastName, phone, email, serviceId, specialistId, date: day.date, window });
      setRegisteredEmail(email);
    } catch (error) {
      setError(errorMessage(error, 'Înscrierea nu a putut fi confirmată. Încearcă din nou.'));
    } finally {
      setPending(false);
    }
  }

  return <section className="waitlist-card" aria-labelledby="waitlist-heading">
    <div className="waitlist-header"><span aria-hidden="true">⏳</span><div>
      <h3 id="waitlist-heading">Intră pe lista de așteptare</h3>
      <p>{date}. Te anunțăm dacă se eliberează o oră pentru serviciul ales.</p>
    </div></div>
    {registeredEmail ? <div className="waitlist-success" role="status">
      <strong>✓ Te-ai înscris cu succes pe lista de așteptare!</strong>
      <p>Vei primi pe {registeredEmail} un link prioritar, valabil până la 30 de minute, dacă se eliberează un interval compatibil.</p>
    </div> : <form onSubmit={submit}>
      <fieldset className="window-options" disabled={pending || account?.blocked}>
        <legend>Alege intervalul preferat de timp</legend>
        {windows.map(option => <label key={option.value} className="window-option">
          <input type="radio" name="waitlist-window" checked={window === option.value}
            disabled={!eligible[option.value]}
            onChange={() => setWindow(option.value)} />
          {option.label}
        </label>)}
        {!account && <ContactFields value={contact} change={changeContact} />}
      </fieldset>
      <p className="waitlist-notice"><strong>🔔 Prioritate de până la 30 de minute.</strong> Primești un link securizat pentru a rezerva intervalul.</p>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <button type="submit" className="primary-button waitlist-submit" disabled={pending || account?.blocked || !eligible[window]}>
        {pending ? 'Se înscrie…' : 'Înscrie-mă pe lista de așteptare'} <span aria-hidden="true">→</span>
      </button>
    </form>}
  </section>;
}
