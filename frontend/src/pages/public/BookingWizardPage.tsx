import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, createBooking, fetchAccount, fetchCatalog } from '../../booking-api';
import type { Account, Catalog, Category, Confirmation, Service } from '../../booking-api';
import { ContactFields, DayBanner, DayStrip, SlotGroups, emptyContact, errorMessage, localDateTime, price, salonToday, useBookingDays } from '../../components/public/BookingControls';
import { WaitlistCard } from '../../components/public/WaitlistCard';
import { PendingBookingNotice } from '../../components/public/PendingBookingNotice';

const categories: { id: Category; label: string; icon: string; detail: string }[] = [
  { id: 'BROWS', label: 'Sprâncene', icon: '🌿', detail: 'Laminare, pensat cu vopsit & pensat simplu' },
  { id: 'MAKEUP', label: 'Make-up', icon: '💄', detail: 'Machiaje de ocazie & mireasă' },
];

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${minutes} min`;
}

export function BookingWizardPage() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [account, setAccount] = useState<Account>();
  const [serviceId, setServiceId] = useState('');
  const [specialistId, setSpecialistId] = useState('');
  const [start, setStart] = useState(salonToday);
  const [date, setDate] = useState(start);
  const [refresh, setRefresh] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number>();
  const [contact, setContact] = useState(emptyContact);
  const [sending, setSending] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const confirmationHeading = useRef<HTMLHeadingElement>(null);

  const service = catalog?.services.find(item => item.id === serviceId);
  const category = categories.find(item => item.id === service?.category) ?? categories[0];
  const services = catalog?.services.filter(item => item.category === category.id) ?? [];
  const specialists = catalog?.specialists.filter(item => item.category === service?.category) ?? [];
  const specialist = specialists.find(item => item.id === specialistId) ?? specialists[0];
  const result = useBookingDays(serviceId, specialist?.id, start, refresh);
  const day = result?.days.find(item => item.date === date);
  const slot = day?.choices.find(item => item.utcMs === selectedSlot && item.available);
  const waitlistAvailable = day && (day.status === 'full' ||
    [day.morning, day.afternoon].some(group => group.total > 0 && group.free === 0));
  const offerDiscount = account?.nextDiscount || (slot && account?.upcoming.some(booking =>
    Number(booking.loyaltyDiscountRon) > 0 && new Date(booking.startTime).getTime() > slot.utcMs));
  const priceInBani = service ? Math.round(Number(service.priceRon) * 100) : 0;
  const displayPrice = offerDiscount ? (priceInBani - Math.round(priceInBani / 10)) / 100 : service?.priceRon;

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setCatalog(data);
      setServiceId(data.services[0]?.id ?? '');
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogError(true);
    });
    return () => controller.abort();
  }, [catalogRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAccount(controller.signal).then(data => {
      if (!controller.signal.aborted) setAccount(data);
    }).catch(() => {});
    return () => controller.abort();
  }, [confirmation]);

  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
  }, [confirmation]);

  function clearSlot() {
    setSelectedSlot(undefined);
    setBookingError('');
  }

  function chooseService(next: Service) {
    setServiceId(next.id);
    setSpecialistId('');
    clearSlot();
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service || !specialist || !slot || sending) return;
    setSending(true);
    setBookingError('');
    try {
      setConfirmation(await createBooking(
        { serviceId: service.id, specialistId: specialist.id, slotUtcMs: slot.utcMs },
        account ? undefined : contact,
      ));
      clearSlot();
      setRefresh(current => current + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSelectedSlot(undefined);
        setRefresh(current => current + 1);
        setBookingError('Intervalul tocmai a fost rezervat. Alege o altă oră.');
      } else if (error instanceof ApiError && error.status === 400) {
        setBookingError('Verifică ora aleasă și datele de contact.');
      } else {
        setBookingError(errorMessage(error, 'Nu am putut verifica rezultatul rezervării. Contactează studioul înainte de a încerca din nou.'));
      }
    } finally {
      setSending(false);
    }
  }

  return <main className="booking-page">
    <header className="card studio-header">
      <div className="studio-top">
        <span className="location">📍 Gura Râului, Sibiu</span>
        <div className="studio-account-actions">
          <p className="guest-notice"><strong>Te poți programa fără cont.</strong> Cont opțional, cu 10% reducere la fiecare a 5-a vizită.</p>
          <a href="/cont" className="secondary-button account-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" /><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
            </svg>
            {account ? 'Contul meu' : 'Contul meu / Autentificare'}
          </a>
          {offerDiscount && !confirmation && <span className="discount-badge">−10% fidelizare la această vizită</span>}
        </div>
      </div>
      <h1>Beauty Studio</h1>
      <p className="studio-bio">Studio intim de înfrumusețare dedicat serviciilor profesionale de make-up și stilizării sprâncenelor. Alege domeniul dorit și verifică disponibilitatea în timp real.</p>
      {!confirmation && <div className="hero-actions">
        <a className="primary-button" href="#services">Programează-te acum <span aria-hidden="true">↓</span></a>
        <span>Servicii de sprâncene și make-up · Confirmare prin e-mail</span>
      </div>}
    </header>

    {confirmation ? <section className="card confirmation" aria-labelledby="confirmation-heading">
      {confirmation.status === 'CONFIRMED' && <div className="confirmation-mark" aria-hidden="true">✓</div>}
      <h2 id="confirmation-heading" tabIndex={-1} ref={confirmationHeading}>
        {confirmation.status === 'PENDING_CONFIRMATION' ? 'Programare salvată' : 'Programare confirmată'}
      </h2>
      {confirmation.status === 'PENDING_CONFIRMATION' && <PendingBookingNotice
        path={`/api/bookings/${confirmation.id}`} credentials={{ resendToken: confirmation.resendToken }}
        emailStatus={confirmation.emailStatus} />}
      <dl className="confirmation-details">
        <div><dt>Serviciu</dt><dd>{confirmation.serviceName}</dd></div>
        <div><dt>Specialistă</dt><dd>{confirmation.specialistName}</dd></div>
        <div><dt>Dată și oră</dt><dd>{localDateTime.format(new Date(confirmation.startsAtLocal))}</dd></div>
        <div><dt>Preț</dt><dd>{price(confirmation.totalPriceRon)}</dd></div>
      </dl>
      <button type="button" className="secondary-button" onClick={() => {
        setConfirmation(undefined);
        clearSlot();
        setRefresh(current => current + 1);
      }}>Fă o nouă rezervare</button>
    </section> : <>
      <section className="card flow-card" id="services" aria-labelledby="service-heading">
        <span className="step-tag">Pasul 1</span>
        <h2 id="service-heading">Alege Serviciul</h2>
        <p className="flow-subtitle">Selectează serviciul dorit. Durata și prețul se actualizează automat.</p>
        {!catalog && !catalogError && <p role="status">Se încarcă serviciile…</p>}
        {catalogError && <div className="feedback error" role="alert">
          <p>Catalogul nu este disponibil momentan.</p>
          <button type="button" className="secondary-button" onClick={() => {
            setCatalogError(false);
            setCatalogRefresh(current => current + 1);
          }}>Reîncearcă</button>
        </div>}
        {catalog?.services.length === 0 && <p role="status">Momentan nu sunt servicii disponibile.</p>}
        {services.length > 0 && <fieldset className="service-group" disabled={sending}>
          <legend>{category.icon} {category.label}</legend>
          {services.map(item => <label className="service-option" key={item.id}>
            <input type="radio" name="service" value={item.id} checked={serviceId === item.id} onChange={() => chooseService(item)} />
            <span className="service-copy"><strong>{item.name}</strong>{item.description && <span>{item.description}</span>}</span>
            <span className="service-meta"><strong>{price(item.priceRon)}</strong><span>{duration(item.totalDurationMinutes)}</span></span>
          </label>)}
        </fieldset>}
      </section>

      {service && <section className="card flow-card" aria-labelledby="slot-heading">
        <span className="step-tag">Pasul 2</span>
        <h2 id="slot-heading">Alege Categoria &amp; Orarul</h2>
        <p className="flow-subtitle">Selectează domeniul și ziua. Orele afișate sunt în ora studioului.</p>
        <fieldset disabled={sending}>
          <legend className="domain-legend">Domeniu Servicii</legend>
          <div className="domain-pills">{categories.map(item => {
            const firstService = catalog?.services.find(candidate => candidate.category === item.id);
            return <button key={item.id} className="domain-pill" type="button" aria-pressed={item.id === category.id}
              disabled={!firstService} onClick={() => firstService && item.id !== category.id && chooseService(firstService)}>
              <span className="domain-avatar" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            </button>;
          })}</div>
          {specialists.length > 1 && <label className="field specialist-field">Specialistă
            <select value={specialist?.id} onChange={event => { setSpecialistId(event.target.value); clearSlot(); }}>
              {specialists.map(item => <option key={item.id} value={item.id}>{item.firstName}</option>)}
            </select></label>}
          {!specialist && <p role="status">Momentan nu sunt specialiste disponibile pentru acest serviciu.</p>}
          {specialist && <>
            <DayStrip days={result?.days ?? []} selected={date} start={start}
              onSelect={value => { setDate(value); clearSlot(); }}
              move={value => { setStart(value); setDate(value); clearSlot(); }} />
            {!result && <p role="status">Se încarcă orele disponibile…</p>}
            {result?.error && <div className="feedback error" role="alert">
              <p>{result.error}</p><button type="button" className="secondary-button"
                onClick={() => setRefresh(current => current + 1)}>Reîncearcă</button>
            </div>}
            {day && <DayBanner day={day} />}
            {day?.status === 'available' && <SlotGroups day={day} selected={selectedSlot}
              onSelect={value => { setSelectedSlot(value); setBookingError(''); }} />}
            {waitlistAvailable && <WaitlistCard key={`${service.id}/${specialist.id}/${day.date}`} day={day}
              serviceId={service.id} specialistId={specialist.id} contact={contact} changeContact={setContact} account={account} />}
          </>}
        </fieldset>
        {bookingError && <p className="feedback error" role="alert">{bookingError}</p>}
      </section>}

      {service && day?.status === 'available' && <section className="card flow-card" aria-labelledby="contact-heading">
        <span className="step-tag">Pasul 3</span>
        <h2 id="contact-heading">Datele Tale de Contact</h2>
        <p>{account ? `Confirmarea se trimite pe ${account.email}.` : 'Te poți programa fără cont. Confirmarea se trimite prin e-mail.'}</p>
        {account?.blocked && <p className="feedback error" role="alert">Rezervarea online este blocată. Contactează salonul.</p>}
        <form onSubmit={submitBooking}>
          {!account && <fieldset disabled={sending}><legend className="sr-only">Date de contact</legend>
            <ContactFields value={contact} change={setContact} /></fieldset>}
          <div className="booking-summary">
            <div><strong>{service.name} · {price(displayPrice ?? service.priceRon)}</strong>
              <p>{slot ? localDateTime.format(new Date(slot.localIso)) : 'Alege o oră pentru a rezerva.'}</p></div>
            <button type="submit" className="primary-button" disabled={!slot || sending || account?.blocked}>
              {sending ? 'Se rezervă…' : `Rezervă intervalul · ${price(displayPrice ?? service.priceRon)} →`}
            </button>
          </div>
        </form>
      </section>}
    </>}
  </main>;
}
