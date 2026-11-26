export type Category = 'BROWS' | 'MAKEUP';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  priceRon: string;
  totalDurationMinutes: number;
}

export interface Specialist {
  id: string;
  firstName: string;
  category: Category;
}

export interface Catalog {
  services: Service[];
  specialists: Specialist[];
}

export interface Slot {
  utcMs: number;
  localIso: string;
}

export interface Contact {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface SlotBooking {
  serviceId: string;
  specialistId: string;
  slotUtcMs: number;
}

export type WaitlistWindow = 'ANY' | 'MORNING' | 'AFTERNOON';
export type GroupCount = { free: number; total: number };
export interface BookingDay {
  date: string;
  status: 'available' | 'full' | 'closed';
  isFullDay: boolean;
  morning: GroupCount;
  afternoon: GroupCount;
  choices: (Slot & { available: boolean })[];
}

export type BookingStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export interface AccountBooking {
  id: string;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  totalPriceRon: string;
  loyaltyDiscountRon: string;
  service: { name: string };
  specialist: { firstName: string };
}

export interface Account extends Contact {
  createdAt: string;
  blocked: boolean;
  lateCancellationCount: number;
  progress: number;
  nextDiscount: boolean;
  upcoming: AccountBooking[];
  history: AccountBooking[];
}

export interface Confirmation {
  id: string;
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED';
  resendToken: string;
  serviceName: string;
  specialistName: string;
  startsAtLocal: string;
  endsAtLocal: string;
  totalPriceRon: string;
  loyaltyDiscountRon: string;
  emailStatus: 'sent' | 'failed';
}

export interface ManagedBooking extends Omit<Confirmation, 'status' | 'emailStatus' | 'resendToken'> {
  serviceId: string;
  specialistId: string;
  status: BookingStatus;
  canManage: boolean;
  isFullDay: boolean;
  date: string;
  category: Category;
  contact: { [K in keyof Contact]: string | null };
  waitlistOffered?: boolean;
  emailStatus?: Confirmation['emailStatus'];
}

export class ApiError extends Error {
  constructor(readonly status: number, message?: string) {
    super(message || 'Cererea nu a putut fi finalizată.');
  }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: unknown } | null;
    throw new ApiError(response.status, typeof error?.message === 'string' ? error.message : undefined);
  }
  return response.json() as Promise<T>;
}

export function post<T>(path: string, payload: object = {}) {
  return request<T>(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

export function fetchCatalog(signal: AbortSignal) {
  return request<Catalog>('/api/services', { signal });
}

export function fetchDays(serviceId: string, specialistId: string, date: string, signal: AbortSignal) {
  const params = new URLSearchParams({ serviceId, specialistId, date });
  return request<{ days: BookingDay[] }>(`/api/availability/days?${params}`, { signal });
}

export function fetchAccount(signal?: AbortSignal) {
  return request<Account>('/api/client/account', { signal });
}

export function createBooking(booking: SlotBooking, contact?: Contact) {
  return post<Confirmation>(contact ? '/api/bookings' : '/api/bookings/account', { ...booking, ...contact });
}
