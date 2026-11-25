import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, createBooking, fetchCatalog, fetchSlots } from '../../booking-api';
import type { Catalog, Category, Confirmation, Slot } from '../../booking-api';

const categories: { id: Category; label: string }[] = [
  { id: 'BROWS', label: 'Sprâncene' },
  { id: 'MAKEUP', label: 'Make-up' },
];
const salonTimeZone = 'Europe/Bucharest';
const dateTimeFormat = new Intl.DateTimeFormat('ro-RO', {
  timeZone: salonTimeZone, dateStyle: 'long', timeStyle: 'short',
});
const priceFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

function salonToday() {
  const fields = new Intl.DateTimeFormat('ro-RO', {
    timeZone: salonTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts();
  return ['year', 'month', 'day'].map(type => fields.find(field => field.type === type)?.value).join('-');
}

function price(amount: string) {
  return `${priceFormat.format(Number(amount))} RON`;
}

type SlotResult = { key: string; slots: Slot[]; error?: string };

export function BookingWizardPage() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [catalog, setCatalog] = useState<Catalog>();
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [serviceId, setServiceId] = useState('');
  const [specialistId, setSpecialistId] = useState('');
  const [date, setDate] = useState(salonToday);
  const [slotResult, setSlotResult] = useState<SlotResult>();
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number>();
  const [sending, setSending] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const service = catalog?.services.find(item => item.id === serviceId);
  const specialists = catalog?.specialists.filter(item => item.category === service?.category) ?? [];
  const specialist = specialists.find(item => item.id === specialistId) ?? specialists[0];
  const activeSpecialistId = specialist?.id;
  const slotKey = `${serviceId}/${activeSpecialistId}/${date}/${slotRefresh}`;
  const activeResult = slotResult?.key === slotKey ? slotResult : undefined;
  const servicePending = !catalog && !catalogError;
  const slotPending = Boolean(service && specialist && date && !activeResult);
  const slot = activeResult?.slots.find(item => item.utcMs === selectedSlot);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal).then(data => {
      setCatalog(data);
      setServiceId(data.services[0]?.id ?? '');
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogError(true);
    });
    return () => controller.abort();
  }, [catalogRefresh]);

  useEffect(() => {
    if (!serviceId || !activeSpecialistId || !date) return;
    const controller = new AbortController();
    fetchSlots(serviceId, activeSpecialistId, date, controller.signal).then(({ slots }) => {
      setSlotResult({ key: slotKey, slots });
    }).catch(() => {
      if (!controller.signal.aborted) {
        setSlotResult({ key: slotKey, slots: [], error: 'Nu am putut încărca orele disponibile.' });
      }
    });
    return () => controller.abort();
  }, [serviceId, activeSpecialistId, date, slotKey]);

  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
  }, [confirmation]);

  function clearSlot() {
    setSelectedSlot(undefined);
    setBookingError('');
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service || !specialist || !slot || sending) return;
    const data = new FormData(event.currentTarget);
    setSending(true);
    setBookingError('');
    try {
      setConfirmation(await createBooking({
        serviceId: service.id,
        specialistId: specialist.id,
        slotUtcMs: slot.utcMs,
        firstName: String(data.get('firstName') ?? ''),
        lastName: String(data.get('lastName') ?? ''),
        phone: String(data.get('phone') ?? ''),
        email: String(data.get('email') ?? ''),
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        clearSlot();
        setSlotRefresh(current => current + 1);
        setBookingError('Intervalul tocmai a fost rezervat. Alege o altă oră.');
      } else if (error instanceof ApiError && error.status === 400) {
        setBookingError('Verifică prenumele, numele, telefonul și adresa de e-mail.');
      } else {
        setBookingError('Nu am putut verifica rezultatul rezervării. Contactează studioul înainte de a încerca din nou.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="booking-page">
      <header className="card studio-header">
        <div className="studio-top">
          <span className="location">Gura Râului, Sibiu</span>
          <button type="button" className="secondary-button" onClick={() => setDark(!dark)}>
            {dark ? 'Mod luminos' : 'Mod întunecat'}
          </button>
        </div>
        <h1>Beauty Studio</h1>
        <p>Servicii dedicate de sprâncene și make-up.</p>
        <p className="guest-notice">Te poți programa fără cont.</p>
      </header>

      {confirmation ? (
        <section className="card confirmation" aria-labelledby="confirmation-heading">
          <div className="confirmation-mark" aria-hidden="true">✓</div>
          <h2 id="confirmation-heading" tabIndex={-1} ref={confirmationHeading}>Programare confirmată</h2>
          <p>{confirmation.emailStatus === 'sent'
            ? 'Am trimis detaliile programării prin e-mail.'
            : 'Programarea este salvată. Nu am putut trimite confirmarea prin e-mail.'}</p>
          <dl className="confirmation-details">
            <div><dt>Serviciu</dt><dd>{confirmation.serviceName}</dd></div>
            <div><dt>Specialistă</dt><dd>{confirmation.specialistName}</dd></div>
            <div><dt>Dată și oră</dt><dd>{dateTimeFormat.format(new Date(confirmation.startsAtLocal))}</dd></div>
            <div><dt>Preț</dt><dd>{price(confirmation.totalPriceRon)}</dd></div>
          </dl>
          <button type="button" className="secondary-button" onClick={() => {
            setConfirmation(undefined);
            clearSlot();
            setSlotRefresh(current => current + 1);
          }}>Fă o nouă rezervare</button>
        </section>
      ) : (
        <>
          <section className="card" aria-labelledby="service-heading">
            <h2 id="service-heading">Alege serviciul</h2>
            {servicePending && <p role="status">Se încarcă serviciile…</p>}
            {catalogError && <div className="feedback error" role="alert">
              <p>Catalogul nu este disponibil momentan.</p>
              <button type="button" className="secondary-button" onClick={() => {
                setCatalogError(false);
                setCatalogRefresh(current => current + 1);
              }}>Reîncearcă</button>
            </div>}
            {catalog?.services.length === 0 && <p role="status">Momentan nu sunt servicii disponibile.</p>}
            <fieldset disabled={sending}>
              <legend className="sr-only">Serviciu</legend>
              {categories.map(category => {
                const services = catalog?.services.filter(item => item.category === category.id) ?? [];
                if (!services.length) return null;
                return <div className="service-group" key={category.id}>
                  <h3>{category.label}</h3>
                  {services.map(item => <label className="service-option" key={item.id}>
                    <input type="radio" name="service" value={item.id} checked={serviceId === item.id}
                      onChange={() => { setServiceId(item.id); setSpecialistId(''); clearSlot(); }} />
                    <span className="service-copy">
                      <strong>{item.name}</strong>
                      {item.description && <span>{item.description}</span>}
                    </span>
                    <span className="service-meta">
                      <strong>{price(item.priceRon)}</strong>
                      <span>{item.totalDurationMinutes} min</span>
                    </span>
                  </label>)}
                </div>;
              })}
            </fieldset>
          </section>

          {service && <section className="card" aria-labelledby="slot-heading">
            <h2 id="slot-heading">Alege data și ora</h2>
            <fieldset disabled={sending}>
              <legend className="sr-only">Dată și oră</legend>
              <div className="schedule-controls">
                <label className="field">Dată
                  <input type="date" value={date} required onChange={event => { setDate(event.target.value); clearSlot(); }} />
                </label>
                {specialists.length > 1 ? <label className="field">Specialistă
                  <select value={activeSpecialistId} onChange={event => { setSpecialistId(event.target.value); clearSlot(); }}>
                    {specialists.map(item => <option key={item.id} value={item.id}>{item.firstName}</option>)}
                  </select>
                </label> : specialist && <p>Specialistă · <strong>{specialist.firstName}</strong></p>}
              </div>
              {!specialist && <p role="status">Momentan nu sunt specialiste disponibile pentru acest serviciu.</p>}
              {slotPending && <p role="status">Se încarcă orele disponibile…</p>}
              {activeResult?.error && <div className="feedback error" role="alert">
                <p>{activeResult.error}</p>
                <button type="button" className="secondary-button" onClick={() => setSlotRefresh(current => current + 1)}>Reîncearcă</button>
              </div>}
              {activeResult && !activeResult.error && (
                activeResult.slots.length ? <fieldset className="slot-fieldset">
                  <legend>Ore disponibile · Europe/Bucharest</legend>
                  <div className="slot-grid">
                    {activeResult.slots.map(item => <label className="slot-option" key={item.utcMs}>
                      <input className="sr-only" type="radio" name="slot" value={item.utcMs} checked={item.utcMs === selectedSlot}
                        onChange={() => { setSelectedSlot(item.utcMs); setBookingError(''); }} />
                      {item.localIso.slice(11, 16)}
                    </label>)}
                  </div>
                </fieldset> : <p role="status">Nu sunt ore disponibile. Alege altă dată.</p>
              )}
            </fieldset>
          </section>}

          {service && <section className="card" aria-labelledby="contact-heading">
            <h2 id="contact-heading">Date de contact</h2>
            <p>Confirmarea se trimite prin e-mail.</p>
            <form onSubmit={submitBooking}>
              <fieldset className="contact-grid" disabled={sending}>
                <legend className="sr-only">Date de contact</legend>
                <label className="field">Prenume<input name="firstName" autoComplete="given-name" maxLength={100} required /></label>
                <label className="field">Nume<input name="lastName" autoComplete="family-name" maxLength={100} required /></label>
                <label className="field">Telefon<input name="phone" type="tel" autoComplete="tel" maxLength={32} required /></label>
                <label className="field">E-mail<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
              </fieldset>
              {bookingError && <p className="feedback error" role="alert">{bookingError}</p>}
              <div className="booking-summary">
                <div>
                  <strong>{service.name} · {price(service.priceRon)}</strong>
                  <p>{slot ? dateTimeFormat.format(new Date(slot.localIso)) : 'Alege o oră pentru a confirma.'}</p>
                </div>
                <button type="submit" className="primary-button" disabled={!slot || sending}>
                  {sending ? 'Se confirmă…' : 'Confirmă rezervarea'}
                </button>
              </div>
            </form>
          </section>}
        </>
      )}
    </main>
  );
}
