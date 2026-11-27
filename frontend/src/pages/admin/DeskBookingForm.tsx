import { useEffect, useState, type FormEvent } from 'react';
import { fetchCatalog, type Service, type Slot } from '../../booking-api';
import { createAtDesk, fetchDeskSlots, staffError, studioDate, visitAction, type Appointment, type StaffSpecialist } from '../../staff-api';

export function DeskBookingForm({ specialists, date, appointment, onSaved }: {
  specialists: StaffSpecialist[]; date: string; appointment?: Appointment; onSaved: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [day, setDay] = useState(date < studioDate() ? studioDate() : date);
  const [specialistId, setSpecialistId] = useState(appointment?.specialistId ?? specialists[0]?.id ?? '');
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '');
  const [slot, setSlot] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const category = specialists.find(specialist => specialist.id === specialistId)?.specialistCategory;
  const choices = services.filter(service => service.category === category);

  useEffect(() => {
    if (appointment) return;
    const abort = new AbortController();
    fetchCatalog(abort.signal).then(value => setServices(value.services))
      .catch(error => { if (!abort.signal.aborted) setError(staffError(error)); });
    return () => abort.abort();
  }, [appointment]);

  useEffect(() => {
    setSlot('');
    setSlots(null);
    if (!day || !serviceId || !specialistId) return;
    const abort = new AbortController();
    fetchDeskSlots({ date: day, serviceId, specialistId, ...(appointment ? { appointmentId: appointment.id } : {}) }, abort.signal)
      .then(result => setSlots(result.slots))
      .catch(error => { if (!abort.signal.aborted) { setSlots([]); setError(staffError(error)); } });
    return () => abort.abort();
  }, [day, serviceId, specialistId, appointment]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || busy) return;
    const contact = Object.fromEntries(new FormData(event.currentTarget));
    if (!contact.email) delete contact.email;
    setError('');
    setBusy(true);
    try {
      if (appointment) await visitAction(true, appointment.id, 'reschedule', { slotUtcMs: Number(slot) });
      else await createAtDesk({ specialistId, serviceId, slotUtcMs: Number(slot), ...contact });
      onSaved();
    } catch (failure) {
      setError(staffError(failure));
      setSlot('');
      setSlots(null);
      try {
        const details = { date: day, serviceId, specialistId, ...(appointment ? { appointmentId: appointment.id } : {}) };
        setSlots((await fetchDeskSlots(details, new AbortController().signal)).slots);
      } catch {
        setSlots([]);
      }
      setBusy(false);
    }
  }

  return <form className="staff-form" onSubmit={save}>
    <fieldset className="staff-form" disabled={busy}>
      {appointment ? <p>{appointment.service.name} · {appointment.specialist.firstName}</p> : <>
        <label className="field">Specialistă
          <select value={specialistId} onChange={event => { setSpecialistId(event.target.value); setServiceId(''); }} required>
            {specialists.map(specialist => <option key={specialist.id} value={specialist.id}>{specialist.firstName}</option>)}
          </select>
        </label>
        <label className="field">Serviciu<select required value={serviceId} onChange={event => setServiceId(event.target.value)}>
          <option value="">Alege serviciul</option>
          {choices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select></label>
      </>}
      <label className="field">Data programării
        <input required type="date" min={studioDate()} value={day} onChange={event => setDay(event.target.value)} />
      </label>
      <label className="field">Ora programării<select value={slot} onChange={event => setSlot(event.target.value)}
        required disabled={!slots?.length}>
        <option value="">{slots?.length ? 'Alege ora' : slots ? 'Niciun interval disponibil' :
          serviceId ? 'Se încarcă intervalele…' : 'Alege serviciul'}</option>
        {slots?.map(item => <option key={item.utcMs} value={item.utcMs}>{item.localIso.slice(11, 16)}</option>)}
      </select></label>
      {!appointment && <div className="staff-fields">
        <label className="field">Prenume<input name="firstName" required maxLength={100} /></label>
        <label className="field">Nume<input name="lastName" required maxLength={100} /></label>
        <label className="field">Telefon<input type="tel" name="phone" required maxLength={32} /></label>
        <label className="field">E-mail (opțional)<input type="email" name="email" maxLength={254} /></label>
      </div>}
    </fieldset>
    {error && <p className="staff-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy || !slot}>{busy ? 'Se salvează…' : 'Salvează programarea'}</button>
  </form>;
}
