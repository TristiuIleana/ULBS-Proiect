import { useEffect, useRef, useState } from 'react';
import { ApiError, post, request } from '../../booking-api';
import type { ManagedBooking } from '../../booking-api';
import { PendingBookingNotice } from '../../components/public/PendingBookingNotice';
import { DayStrip, SlotGroups, errorMessage, localDateTime, price, salonToday, useBookingDays } from '../../components/public/BookingControls';

const phone = { display: '0756 062 883', href: 'tel:+40756062883' };

function RescheduleOptions({ booking, url, selected, onSelect }: {
  booking: ManagedBooking; url: string; selected?: number; onSelect: (slot?: number) => void;
}) {
  const [start, setStart] = useState(salonToday);
  const [date, setDate] = useState(start);
  const [refresh, setRefresh] = useState(0);
  const result = useBookingDays(booking.serviceId, booking.specialistId, start, refresh, url);
  const day = result?.days.find(item => item.date === date);
  function select(value: string) {
    setDate(value);
    onSelect(undefined);
  }
  return <div className="reschedule-options">
    <DayStrip days={result?.days ?? []} selected={date} start={start} onSelect={select}
      move={value => { setStart(value); select(value); }} />
    {!result && <p role="status">Se încarcă orele…</p>}
    {result?.error && <p className="feedback error" role="alert">{result.error}
      <button type="button" className="secondary-button" onClick={() => setRefresh(value => value + 1)}>Reîncearcă</button></p>}
    {day?.status === 'available' && <SlotGroups day={day} selected={selected} onSelect={onSelect} />}
    {day && day.status !== 'available' && <p role="status">Alege o altă zi cu ore disponibile.</p>}
  </div>;
}

export function ManageBookingPage() {
  const query = new URLSearchParams(location.search);
  const token = query.get('token');
  const id = query.get('id');
  const path = token ? '/api/appointments/by-token' : `/api/appointments/${encodeURIComponent(id ?? '')}`;
  const detailPath = token ? `${path}?token=${encodeURIComponent(token)}` : path;
  const [booking, setBooking] = useState<ManagedBooking>();
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [update, setUpdate] = useState('');
  const [action, setAction] = useState<'cancel' | 'reschedule'>();
  const [selected, setSelected] = useState<number>();
  const [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!id && !token) return;
    const controller = new AbortController();
    request<ManagedBooking>(detailPath, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setBooking(value);
    }).catch(error => {
      if (!controller.signal.aborted) setError(errorMessage(error, 'Nu am putut încărca programarea.'));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [detailPath, id, token, refresh]);

  useEffect(() => {
    const reload = () => setRefresh(value => value + 1);
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, []);

  useEffect(() => {
    if (action && !dialog.current?.open) dialog.current?.showModal();
  }, [action]);

  function open(operation: 'cancel' | 'reschedule') {
    setSelected(undefined);
    setError('');
    setAction(operation);
  }

  async function change() {
    if (!action || pending || (action === 'reschedule' && selected === undefined)) return;
    setPending(true);
    setError('');
    try {
      const data = await post<ManagedBooking>(`${path}/${action}`, {
        ...(token ? { token } : {}), ...(action === 'reschedule' ? { slotUtcMs: selected } : {}),
      });
      setBooking(data);
      setUpdate(action === 'reschedule' ? (data.emailStatus === 'failed'
        ? 'Programarea a fost mutată. E-mailul nu a putut fi trimis.'
        : 'Programarea a fost mutată. Am trimis un e-mail cu detaliile.') : '');
      dialog.current?.close();
    } catch (error) {
      setError(errorMessage(error, 'Modificarea nu a putut fi finalizată.'));
      if (error instanceof ApiError && error.status === 403) {
        dialog.current?.close();
        setRefresh(value => value + 1);
      } else if (error instanceof ApiError && error.status === 409) {
        setSelected(undefined);
        setRefresh(value => value + 1);
      }
    } finally {
      setPending(false);
    }
  }

  const status = { PENDING_CONFIRMATION: 'În așteptarea confirmării', CONFIRMED: 'Programare confirmată',
    CANCELLED: 'Anulată', COMPLETED: '✓ Finalizată', NO_SHOW: 'Neprezentare' };
  const isActive = booking?.status === 'PENDING_CONFIRMATION' || booking?.status === 'CONFIRMED';
  return <main className="booking-page manage-page">
    <header className="manage-studio account-title"><h1>Beauty Studio</h1>
      <p>📍 Gura Râului, Sibiu · Gestiune Rezervare Online</p></header>
    <section className="card manage-card">
      {loading && (id || token) && <p role="status">Se încarcă programarea…</p>}
      {!booking && (!loading || (!id && !token)) && <p className="feedback error" role="alert">{error || 'Linkul de gestiune este incomplet.'}</p>}
      {booking?.status === 'CANCELLED' && <div className="confirmation">
        <div className="confirmation-mark" aria-hidden="true">✓</div>
        <h2>Rezervarea a fost anulată</h2><p>Intervalul a fost eliberat în calendar.</p>
        <a href="/" className="primary-button">Programează o vizită</a>
      </div>}
      {booking && booking.status !== 'CANCELLED' && <>
        <div className="manage-topline"><span className={`status-chip ${booking.status.toLowerCase()}`}>{status[booking.status]}</span>
          <span>Cod rezervare #{booking.id.slice(0, 8).toUpperCase()}</span></div>
        <span className="step-tag">{booking.category === 'BROWS' ? '🌿 Sprâncene' : '💄 Make-up'}</span>
        <h2 className="manage-service">{booking.serviceName}</h2>
        {booking.status === 'PENDING_CONFIRMATION' && <PendingBookingNotice
          path={path} credentials={token ? { token } : undefined} emailStatus={booking.emailStatus} />}
        <dl className="manage-details">
          <div><dt>Data și ora programării</dt><dd>{localDateTime.format(new Date(booking.startsAtLocal))}</dd></div>
          <div><dt>Locație și specialistă</dt><dd>Beauty Studio</dd><dd className="detail-sub">{booking.specialistName} · Gura Râului, Sibiu</dd></div>
          <div><dt>Clientă</dt><dd>{`${booking.contact.firstName} ${booking.contact.lastName}`.trim()}</dd>
            <dd className="detail-sub">{booking.contact.phone} · {booking.contact.email}</dd></div>
          <div><dt>Preț total de achitat</dt><dd>{price(booking.totalPriceRon)}</dd><dd className="detail-sub">Plată directă la salon</dd></div>
        </dl>
        {isActive && <div className={`day-banner ${booking.canManage ? 'available' : 'warning'}`}>
          <span aria-hidden="true">{booking.canManage ? '📅' : '⚠️'}</span>
          <div><strong>{booking.isFullDay ? 'Zi Full' : 'Politica de anulare și reprogramare'}</strong>
            <p>{booking.canManage ? 'Poți anula sau reprograma gratuit cu cel puțin 24 de ore înainte.' :
              <>Modificarea nu mai este permisă online. Contactează salonul la <a className="text-link" href={phone.href}>{phone.display}</a>.</>}</p>
          </div>
        </div>}
        {isActive && <div className="manage-actions">
          <button type="button" className="primary-button" disabled={!booking.canManage} onClick={() => open('reschedule')}>📅 Reprogramează la altă dată</button>
          <button type="button" className="secondary-button destructive" disabled={!booking.canManage} onClick={() => open('cancel')}>Anulează rezervarea</button>
        </div>}
        {update && <p className="waitlist-success" role="status">{update}</p>}
        {error && !action && <p className="feedback error" role="alert">{error}</p>}
      </>}
    </section>
    <a href={token ? '/' : '/cont'} className="text-link">{token ? 'Înapoi la rezervare' : 'Înapoi la contul meu'}</a>
    {booking && <dialog ref={dialog} className="card manage-dialog" aria-labelledby="dialog-title"
      onCancel={event => { if (pending) event.preventDefault(); }} onClose={() => setAction(undefined)}>
      {action && <>
        <h2 id="dialog-title">{action === 'cancel' ? 'Confirmare Anulare' : 'Reprogramare'}</h2>
        {action === 'cancel' ? <p>Vrei să anulezi programarea pentru {booking.serviceName}?</p> :
          <RescheduleOptions key={refresh} booking={booking}
            url={`${path}/reschedule-days?${token ? `token=${encodeURIComponent(token)}` : ''}`}
            selected={selected} onSelect={setSelected} />}
        {error && <p className="feedback error" role="alert">{error}</p>}
        <div className="manage-actions">
          <button type="button" className="secondary-button" disabled={pending} onClick={() => dialog.current?.close()}>Renunță</button>
          <button type="button" className={`primary-button ${action === 'cancel' ? 'destructive' : ''}`}
            disabled={pending || (action === 'reschedule' && selected === undefined)} onClick={() => void change()}>
            {pending ? 'Se salvează…' : action === 'cancel' ? 'Confirmă anularea' : 'Confirmă reprogramarea'}
          </button>
        </div>
      </>}
    </dialog>}
  </main>;
}
