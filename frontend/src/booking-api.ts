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

interface GuestBooking {
  serviceId: string;
  specialistId: string;
  slotUtcMs: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface Confirmation {
  id: string;
  status: 'CONFIRMED';
  serviceName: string;
  specialistName: string;
  startsAtLocal: string;
  endsAtLocal: string;
  totalPriceRon: string;
  emailStatus: 'sent' | 'failed';
}

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Booking API returned HTTP ${status}`);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export function fetchCatalog(signal: AbortSignal) {
  return request<Catalog>('/api/services', { signal });
}

export function fetchSlots(serviceId: string, specialistId: string, date: string, signal: AbortSignal) {
  const params = new URLSearchParams({ serviceId, specialistId, date });
  return request<{ slots: Slot[] }>(`/api/availability?${params}`, { signal });
}

export function createBooking(booking: GuestBooking) {
  return request<Confirmation>('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });
}
