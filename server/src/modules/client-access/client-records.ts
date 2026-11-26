import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function emailKey(email: string) {
  return email.trim().toLowerCase();
}

export async function lockEmail(tx: Prisma.TransactionClient, email: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${emailKey(email)}, 31832))`;
}

export async function lockClient(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid AND role = 'CLIENT' FOR UPDATE`;
  return tx.user.findFirst({ where: { id, role: 'CLIENT' } });
}

export async function guestProfile(tx: Prisma.TransactionClient, email: string) {
  const user = await tx.user.findFirst({
    where: { role: 'CLIENT', email: { equals: emailKey(email), mode: 'insensitive' } },
  });
  return user ? lockClient(tx, user.id) : null;
}

export function assertNotBlocked(user: { lateCancellationCount: number } | null) {
  if (user && user.lateCancellationCount >= 3) {
    throw new ForbiddenException('Rezervarea online este blocată. Contactează salonul.');
  }
}

export async function allocateLoyalty(tx: Prisma.TransactionClient, clientId: string) {
  const completed = await tx.appointment.count({ where: { clientId, status: 'COMPLETED' } });
  const pending = await tx.appointment.findMany({
    where: { clientId, status: 'CONFIRMED' },
    orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    select: { id: true, startTime: true, basePriceRon: true, totalPriceRon: true, loyaltyDiscountRon: true },
  });
  const eligible = completed % 5 === 4
    ? pending.find(booking => booking.startTime.getTime() >= Date.now() || booking.loyaltyDiscountRon.gt(0))
    : undefined;
  for (const booking of pending) {
    const price = booking.basePriceRon ?? booking.totalPriceRon;
    const discount = booking.id === eligible?.id ? price.times(0.1).toDecimalPlaces(2) : new Prisma.Decimal(0);
    if (!booking.loyaltyDiscountRon.eq(discount)) {
      await tx.appointment.update({
        where: { id: booking.id },
        data: { basePriceRon: price, loyaltyDiscountRon: discount, totalPriceRon: price.minus(discount) },
      });
    }
  }
}
