import { useEffect, useState } from 'react';
import { ApiError, fetchDays } from '../../booking-api';
import type { BookingDay, Contact, GroupCount } from '../../booking-api';

export const salonTimeZone = 'Europe/Bucharest';
export const localDateTime = new Intl.DateTimeFormat('ro-RO', {
  timeZone: salonTimeZone, dateStyle: 'long', timeStyle: 'short',
});
const money = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });
const dayLabel = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: salonTimeZone });
const weekday = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', timeZone: salonTimeZone });
const dayMonth = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: salonTimeZone });

export const emptyContact: Contact = { firstName: '', lastName: '', phone: '', email: '' };

export function price(value: string | number) {
  return `${money.format(Number(value))} RON`;
}

export function salonToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: salonTimeZone }).format(new Date());
}

export function shiftDay(day: string, delta: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
}

function dateObject(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

export function formatDay(value: string) {
  return dayLabel.format(dateObject(value));
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function useBookingDays(serviceId: string, specialistId: string | undefined, start: string, refresh: number) {
  const key = `${serviceId}/${specialistId}/${start}/${refresh}`;
  const [result, setResult] = useState<{ key: string; days: BookingDay[]; error?: string }>();
  useEffect(() => {
    if (!serviceId || !specialistId) return;
    const controller = new AbortController();
    fetchDays(serviceId, specialistId, start, controller.signal).then(({ days }) => {
      if (!controller.signal.aborted) setResult({ key, days });
    }).catch(error => {
      if (!controller.signal.aborted) {
        setResult({ key, days: [], error: errorMessage(error, 'Nu am putut încărca disponibilitatea.') });
      }
    });
    return () => controller.abort();
  }, [key, serviceId, specialistId, start]);
  return result?.key === key ? result : undefined;
}

export function ContactFields({ value, change }: { value: Contact; change: (contact: Contact) => void }) {
  return <div className="contact-grid">
    <label className="field">Prenume<input name="firstName" value={value.firstName} onChange={event => change({ ...value, firstName: event.target.value })}
      autoComplete="given-name" maxLength={100} required /></label>
    <label className="field">Nume<input name="lastName" value={value.lastName} onChange={event => change({ ...value, lastName: event.target.value })}
      autoComplete="family-name" maxLength={100} required /></label>
    <label className="field">Telefon<input name="phone" value={value.phone} onChange={event => change({ ...value, phone: event.target.value })}
      autoComplete="tel" type="tel" maxLength={32} required /></label>
    <label className="field">E-mail<input name="email" value={value.email} onChange={event => change({ ...value, email: event.target.value })}
      autoComplete="email" type="email" maxLength={254} required /></label>
  </div>;
}

export function DayStrip({ days, selected, onSelect, start, move }: {
  days: BookingDay[]; selected: string; start: string; onSelect: (date: string) => void; move: (date: string) => void;
}) {
  const today = salonToday();
  return <div>
    <div className="date-heading">
      <strong>Ziua Programării</strong>
      <div className="date-navigation">
        <button type="button" className="secondary-button" onClick={() => move(shiftDay(start, -6) < today ? today : shiftDay(start, -6))}
          disabled={start <= today} aria-label="Zilele anterioare">←</button>
        <button type="button" className="secondary-button" onClick={() => move(shiftDay(start, 6))}
          disabled={start >= '9999-12-25'} aria-label="Zilele următoare">→</button>
      </div>
    </div>
    <div className="date-row" role="group" aria-label="Ziua programării">
      {days.map(day => {
        const free = day.morning.free + day.afternoon.free;
        const label = day.status === 'closed' ? 'Indisponibil' : day.status === 'full' ? 'Complet Ocupat' :
          day.isFullDay ? `Zi Full (${free} locuri)` : 'Disponibil';
        return <button type="button" className="date-pill" key={day.date} aria-pressed={day.date === selected} onClick={() => onSelect(day.date)}>
          {day.isFullDay && <span className="peak-dot" aria-label="Zi Full" />}
          <span>{weekday.format(dateObject(day.date))}</span>
          <strong>{dayMonth.format(dateObject(day.date))}</strong>
          <span className={`date-badge ${day.status === 'full' ? 'full' : day.isFullDay ? 'peak' : day.status}`}>{label}</span>
        </button>;
      })}
    </div>
  </div>;
}

export function DayBanner({ day }: { day: BookingDay }) {
  const date = formatDay(day.date);
  const closed = day.status === 'closed';
  const full = day.status === 'full';
  return <div className={`day-banner ${day.isFullDay || full ? 'warning' : closed ? '' : 'available'}`} role="status">
    <span aria-hidden="true">{day.isFullDay || full ? '⚠️' : '📅'}</span>
    <div><strong>{date}{day.isFullDay ? ' · Zi Full' : ''}{full ? ' · Complet Ocupat' : ''}</strong>
      <p>{closed ? 'Nu mai sunt intervale de program în această zi. Alege altă dată.' :
        full ? 'Toate intervalele sunt rezervate. Te poți înscrie pe lista de așteptare.' :
          day.isFullDay ? 'Anularea și reprogramarea nu sunt permise online. Pentru modificări, contactează salonul.' :
            'Alege una dintre orele disponibile pentru serviciul selectat.'}</p>
    </div>
  </div>;
}

export function SlotGroups({ day, selected, onSelect }: {
  day: BookingDay; selected?: number; onSelect: (slotUtcMs: number) => void;
}) {
  const groups: { title: string; count: GroupCount; morning: boolean }[] = [
    { title: 'DIMINEAȚA (09:00 - 13:00)', count: day.morning, morning: true },
    { title: 'DUPĂ-AMIAZA (13:00 - 19:00)', count: day.afternoon, morning: false },
  ];
  return <>{groups.map(group => <fieldset className="slot-fieldset" key={group.title}>
    <legend className="sr-only">{group.title}</legend>
    <div className="slot-group-title" aria-hidden="true"><strong>{group.title}</strong>
      <span className="slot-count">{group.count.free} din {group.count.total} libere</span></div>
    <div className="slot-grid">
      {day.choices.filter(slot => (slot.localIso.slice(11, 16) < '13:00') === group.morning).map(slot => (
        <label key={slot.utcMs} className="slot-option">
          <input className="sr-only" type="radio" name="slot" checked={slot.utcMs === selected}
            disabled={!slot.available} onChange={() => onSelect(slot.utcMs)} />
          {slot.localIso.slice(11, 16)}
        </label>
      ))}
    </div>
  </fieldset>)}</>;
}
