import type { Appointment, Prisma } from '@prisma/client';

const confirmationWindowMs = 60 * 60_000;
export const confirmationExpiredReason = 'CONFIRMATION_EXPIRED';
export const confirmationExpiredMessage = 'Termenul de 1 oră pentru confirmare a expirat. Te rugăm să faci o programare nouă.';

function confirmationCutoff(now: number) {
  return new Date(now - confirmationWindowMs);
}

export function pendingPastDeadline(now: number): Prisma.AppointmentWhereInput {
  return { status: 'PENDING_CONFIRMATION', createdAt: { lte: confirmationCutoff(now) } };
}

export function occupyingAppointment(now: number): Prisma.AppointmentWhereInput {
  return { OR: [
    { status: 'CONFIRMED' },
    { status: 'PENDING_CONFIRMATION', createdAt: { gt: confirmationCutoff(now) } },
  ] };
}

export function pendingConfirmationExpired(booking: Pick<Appointment, 'status' | 'createdAt'>, now: number) {
  return booking.status === 'PENDING_CONFIRMATION' && booking.createdAt.getTime() <= confirmationCutoff(now).getTime();
}
