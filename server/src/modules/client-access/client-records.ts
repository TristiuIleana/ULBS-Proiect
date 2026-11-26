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
  const visits = await tx.appointment.findMany({
    where: { clientId, status: { in: ['COMPLETED', 'CONFIRMED'] } },
    orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    select: { id: true, status: true, basePriceRon: true, totalPriceRon: true, loyaltyDiscountRon: true },
  });
  let visitNumber = 0;
  let pendingDiscountReserved = false;
  for (const booking of visits) {
    const completed = booking.status === 'COMPLETED';
    const earnsDiscount = (visitNumber + 1) % 5 === 0 && (completed || !pendingDiscountReserved);
    // A confirmed discounted visit reserves its place if a later visit is completed first.
    if (completed || earnsDiscount) visitNumber++;
    if (!completed && earnsDiscount) pendingDiscountReserved = true;
    const price = booking.basePriceRon ?? booking.totalPriceRon;
    const discount = earnsDiscount ? price.times(0.1).toDecimalPlaces(2) : new Prisma.Decimal(0);
    if (!booking.loyaltyDiscountRon.eq(discount)) {
      await tx.appointment.update({
        where: { id: booking.id },
        data: { basePriceRon: price, loyaltyDiscountRon: discount, totalPriceRon: price.minus(discount) },
      });
    }
  }
}
