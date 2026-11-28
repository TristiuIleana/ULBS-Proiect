import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import roLocale from '@fullcalendar/core/locales/ro';
import timeGridPlugin from '@fullcalendar/timegrid';
import luxonPlugin from '@fullcalendar/luxon3';
import { fetchCalendar, calendarUrl, dayLabel, shiftDate, staffError, studioDate, studioTime, studioZone,
  visitAction, visitLabels, type Appointment, type Staff, type StaffCalendar, type StaffSpecialist, type View } from '../../staff-api';
import { StaffDialog } from '../../components/staff/StaffDialog';
import { DeskBookingForm } from '../admin/DeskBookingForm';
import { WaitlistManagementPage } from '../admin/WaitlistManagementPage';

type Dialog = { type: 'detail' | 'move'; appointment: Appointment } | { type: 'create' | 'waitlist' };
const plugins = [timeGridPlugin, luxonPlugin];
const contactName = (appointment: Appointment) =>
  [appointment.contact.firstName, appointment.contact.lastName].filter(Boolean).join(' ') || 'Clientă';

export function EmployeeCalendarPage({ staff, reception = false }: { staff: Staff; reception?: boolean }) {
  const [date, setDate] = useState(studioDate);
  const [view, setView] = useState<View>('day');
  const [specialistId, setSpecialist] = useState('');
  const [calendar, setCalendar] = useState<StaffCalendar | null>(null);
  const [specialists, setSpecialists] = useState<StaffSpecialist[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [pending, setPending] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const query = useMemo(() => ({ date, view, ...(specialistId ? { specialistId } : {}) }), [date, view, specialistId]);

  useEffect(() => {
    const abort = new AbortController();
    setError('');
    fetchCalendar(reception, query, abort.signal).then(result => {
      setCalendar(result);
      if (!specialistId) setSpecialists(result.specialists);
    }).catch(failure => { if (!abort.signal.aborted) setError(staffError(failure)); });
    return () => abort.abort();
  }, [reception, query, revision, specialistId]);

  function selectDate(value: string) {
    if (!value || value === date) return;
    setCalendar(null);
    setDate(value);
  }

  function selectView(value: View) {
    if (value === view) return;
    setCalendar(null);
    setView(value);
  }

  function open(value: Dialog | null) {
    setDialog(value);
    setDialogError('');
    setCancelConfirm(false);
  }

  function saved(message = 'Programarea a fost actualizată.') {
    open(null);
    setNotice(message);
    setRevision(value => value + 1);
  }

  async function action(appointment: Appointment, command: 'complete' | 'no-show' | 'cancel') {
    setPending(true);
    setDialogError('');
    try {
      await visitAction(reception, appointment.id, command);
      saved();
    } catch (failure) {
      setDialogError(staffError(failure));
    } finally {
      setPending(false);
    }
  }

  const dayStep = view === 'week' ? 7 : 1;
  const selected = dialog && 'appointment' in dialog ? dialog.appointment : null;
  const confirmed = selected?.status === 'CONFIRMED';
  const active = confirmed || selected?.status === 'PENDING_CONFIRMATION';
  const mayMark = confirmed && Date.parse(selected.endTime) <= Date.now();
  const splitStageLabel = (stage: Appointment['stages'][number]) =>
    `${studioTime(stage.startTime)}–${studioTime(stage.endTime)} ${stage.isBusy ? 'Ocupat' : 'Liber'}`;

  return <main className={`staff-page ${reception ? 'staff-reception' : ''}`}>
    <header className="studio-header card staff-row">
      <div><span className="staff-brand">Beauty Studio</span>
        <h1>{reception ? 'Calendar Recepție' : 'Programările mele'}</h1>
        <p>{staff.firstName} · {staff.role === 'ADMIN' ? 'Administratoare' : 'Specialistă Make-up'}</p>
      </div>
      {reception && <button className="primary-button" disabled={!specialists.length}
        onClick={() => open({ type: 'create' })}>Programare nouă</button>}
    </header>
    <section className="card staff-workspace" aria-label="Calendar">
      <div className="staff-row">
        <div className="staff-controls" aria-label="Perioada calendarului">
          <button className="secondary-button" aria-label="Perioada anterioară" onClick={() => selectDate(shiftDate(date, -dayStep))}>‹</button>
          <button className="secondary-button" onClick={() => selectDate(studioDate())}>Astăzi</button>
          <button className="secondary-button" aria-label="Perioada următoare" onClick={() => selectDate(shiftDate(date, dayStep))}>›</button>
          <label className="field"><span className="sr-only">Data calendarului</span>
            <input type="date" value={date} onChange={event => selectDate(event.target.value)} />
          </label>
        </div>
        <div className="staff-controls" aria-label="Vizualizare">
          <button className="secondary-button" aria-pressed={view === 'day'} onClick={() => selectView('day')}>Zi</button>
          <button className="secondary-button" aria-pressed={view === 'week'} onClick={() => selectView('week')}>Săptămână</button>
        </div>
      </div>
      <div className="staff-row">
        <div className="staff-controls">
          {reception && <label className="field"><span className="sr-only">Filtru specialistă</span>
            <select value={specialistId} onChange={event => { setCalendar(null); setSpecialist(event.target.value); }}>
              <option value="">Ambele specialiste</option>
              {specialists.map(person => <option key={person.id} value={person.id}>{person.firstName}</option>)}
            </select>
          </label>}
        </div>
        <div className="staff-controls">
          {reception && <button className="secondary-button" onClick={() => open({ type: 'waitlist' })}>Waitlist</button>}
          {calendar?.appointments.some(row => row.status === 'CONFIRMED')
            ? <a className="secondary-button staff-download" href={calendarUrl(reception, '/calendar.ics', query)} download>Descarcă .ics</a>
            : <button className="secondary-button" disabled>Descarcă .ics</button>}
        </div>
      </div>
      {notice && <p role="status" className="staff-notice">{notice}</p>}
      {error && <p role="alert" className="staff-error">{error} <button className="secondary-button"
        onClick={() => setRevision(value => value + 1)}>Reîncearcă</button></p>}
      {!calendar && !error && <p role="status">Se încarcă programările…</p>}
      {calendar?.fullDays.map(day => <p key={`${day.specialistId}-${day.date}`} className="staff-full">
        <strong>Zi Full · {dayLabel(day.date)} · {specialists.find(person => person.id === day.specialistId)?.firstName}</strong>
        {' '}Anularea și reprogramarea se fac prin salon în Zi Full.
      </p>)}
      {calendar && <div className={`staff-columns ${calendar.specialists.length === 2 ? 'staff-columns-combined' : ''}`}>
        {calendar.specialists.map(person => {
          const rows = calendar.appointments.filter(row => row.specialistId === person.id);
          return <section key={person.id} className="staff-lane" aria-label={`Agenda ${person.firstName}`}>
            <h2>{reception ? person.firstName : dayLabel(date)}</h2>
            {rows.length === 0 && <p className="staff-empty">Nicio programare în perioada selectată.</p>}
            {view === 'week' ? <FullCalendar key={date} plugins={plugins} locale={roLocale} timeZone={studioZone}
              initialDate={date} initialView="timeGridWeek" firstDay={1} headerToolbar={false} allDaySlot={false}
              slotMinTime="09:00:00" slotMaxTime="19:00:00" height="auto" eventMinHeight={34}
              events={rows.map(row => ({
                id: row.id, start: row.startTime, end: row.endTime, title: `${row.service.name} · ${contactName(row)}`,
                className: `staff-event-${row.status}`, extendedProps: { appointment: row },
              }))}
              eventContent={info => <button type="button" className="staff-event"
                onClick={() => open({ type: 'detail', appointment: info.event.extendedProps.appointment as Appointment })}>
                <span>{info.timeText}</span><strong>{info.event.title}</strong>
              </button>} /> : rows.map(row => <button className="staff-visit staff-visit-button" key={row.id}
              onClick={() => open({ type: 'detail', appointment: row })}>
              <span className="staff-visit-time">{studioTime(row.startTime)}–{studioTime(row.endTime)}</span>
              <strong>{row.service.name}</strong><span>{contactName(row)}</span>
              <span className="staff-badge" data-status={row.status}>{visitLabels[row.status]}</span>
              {row.stages.length > 1 && <span className="staff-stages">{row.stages.map(stage => <span
                key={stage.startTime} data-busy={stage.isBusy}>{splitStageLabel(stage)}</span>)}</span>}
            </button>)}
          </section>;
        })}
      </div>}
    </section>
    {dialog?.type === 'waitlist' && <StaffDialog title="Waitlist" onClose={() => open(null)}>
      <WaitlistManagementPage query={query} refreshCalendar={() => setRevision(value => value + 1)} />
    </StaffDialog>}
    {(dialog?.type === 'create' || dialog?.type === 'move') && <StaffDialog
      title={dialog.type === 'create' ? 'Programare nouă' : 'Reprogramează vizita'} onClose={() => open(null)}>
      <DeskBookingForm specialists={specialists} date={selected ? studioDate(new Date(selected.startTime)) : date}
        appointment={selected ?? undefined} onSaved={() => saved(dialog.type === 'create' ? 'Programarea a fost confirmată.' : undefined)} />
    </StaffDialog>}
    {dialog?.type === 'detail' && selected && <StaffDialog title="Detalii programare" onClose={() => open(null)}>
      <dl className="staff-details">
        <dt>Serviciu</dt><dd>{selected.service.name}</dd>
        <dt>Specialistă</dt><dd>{selected.specialist.firstName}</dd>
        <dt>Dată și oră</dt><dd>{dayLabel(studioDate(new Date(selected.startTime)))} · {studioTime(selected.startTime)}–{studioTime(selected.endTime)}</dd>
        <dt>Clientă</dt><dd>{contactName(selected)}</dd>
        <dt>Telefon</dt><dd>{selected.contact.phone || '—'}</dd>
        <dt>E-mail</dt><dd>{selected.contact.email || '—'}</dd>
        <dt>Notițe</dt><dd>{selected.notes || '—'}</dd>
        <dt>Stare</dt><dd>{visitLabels[selected.status]}</dd>
      </dl>
      {dialogError && <p role="alert" className="staff-error">{dialogError}</p>}
      {confirmed && !mayMark && <p>Marcarea este disponibilă după ora de sfârșit.</p>}
      <div className="staff-controls">
        {confirmed && <>
          <button className="primary-button" disabled={pending || !mayMark}
            onClick={() => void action(selected, 'complete')}>Marchează finalizată</button>
          <button className="secondary-button" disabled={pending || !mayMark}
            onClick={() => void action(selected, 'no-show')}>Neprezentare</button>
        </>}
        {reception && active && <>
          <button className="secondary-button" disabled={pending} onClick={() => open({ type: 'move', appointment: selected })}>Reprogramează</button>
          <button className="secondary-button" disabled={pending} onClick={() => cancelConfirm
            ? void action(selected, 'cancel') : setCancelConfirm(true)}>
            {cancelConfirm ? 'Confirmă anularea' : 'Anulează programarea'}
          </button>
        </>}
      </div>
    </StaffDialog>}
  </main>;
}
