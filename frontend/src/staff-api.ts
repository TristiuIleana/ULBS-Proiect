import { ApiError, type Category, type Contact, post, request, type Slot } from './booking-api';

export type Staff = { id: string; firstName: string; role: 'ADMIN' | 'SPECIALIST' };
export type View = 'day' | 'week';
export type StaffSpecialist = { id: string; firstName: string; specialistCategory: Category };
export type VisitStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type Appointment = {
  id: string; specialistId: string; serviceId: string; startTime: string; endTime: string; status: VisitStatus;
  contact: { [K in keyof Contact]: string | null }; notes: string | null;
  service: { name: string }; specialist: { firstName: string };
  stages: Array<{ isBusy: boolean; startTime: string; endTime: string }>;
};
export type StaffCalendar = {
  specialists: StaffSpecialist[]; appointments: Appointment[]; fullDays: Array<{ date: string; specialistId: string }>;
};
export type QueueEntry = {
  id: string; desiredDate: string; window: string; status: string; expiresAt: string | null;
  notifiedAt: string | null; canNotify: boolean; firstName: string | null; lastName: string | null;
  offeredStartAt: string | null; canConvert: boolean;
  service: { name: string };
};

export const studioZone = 'Europe/Bucharest';
export const studioDate = (value = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: studioZone }).format(value);
export const studioTime = (value: string) => new Intl.DateTimeFormat('ro-RO', {
  timeZone: studioZone, hour: '2-digit', minute: '2-digit',
}).format(new Date(value));
export const dayLabel = (date: string) => new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
}).format(new Date(`${date}T00:00:00Z`));
export const visitLabels: Record<VisitStatus, string> = {
  PENDING_CONFIRMATION: 'În așteptarea confirmării', CONFIRMED: 'Confirmată',
  CANCELLED: 'Anulată', COMPLETED: 'Finalizată', NO_SHOW: 'Neprezentare',
};

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const base = (reception: boolean) => reception ? '/api/staff/reception' : '/api/staff';
export const getSession = (signal?: AbortSignal) => request<Staff>('/api/staff/session', { signal });
export const staffLogin = (email: string, password: string) => post('/api/staff/login', { email, password });
export const staffLogout = () => post('/api/staff/logout');
export const calendarUrl = (reception: boolean, path: string, params: Record<string, string>) =>
  `${base(reception)}${path}?${new URLSearchParams(params)}`;
export const fetchCalendar = (reception: boolean, params: Record<string, string>, signal: AbortSignal) =>
  request<StaffCalendar>(calendarUrl(reception, '/appointments', params), { signal });
export const visitAction = (reception: boolean, id: string, action: string, details?: object) =>
  post(`${base(reception)}/appointments/${id}/${action}`, details);
export const createAtDesk = (details: object) => post('/api/staff/reception/appointments', details);
export const fetchDeskSlots = (params: Record<string, string>, signal: AbortSignal) =>
  request<{ slots: Slot[] }>(calendarUrl(true, '/slots', params), { signal });
export const fetchQueue = (params: Record<string, string>, signal: AbortSignal) =>
  request<{ entries: QueueEntry[] }>(calendarUrl(true, '/waitlist', params), { signal });
export const notifyEntry = (id: string) => post<{ notified: boolean }>(`/api/staff/reception/waitlist/${id}/notify`);
export const convertEntry = (id: string) => post<Appointment>(`/api/staff/reception/waitlist/${id}/convert`);

export function staffError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) location.replace('/staff/login');
  return error instanceof Error ? error.message : 'Cererea nu a putut fi finalizată.';
}
