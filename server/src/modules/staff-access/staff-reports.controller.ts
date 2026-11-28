import { Controller, Get, NotFoundException, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { confirmationExpiredReason } from '../appointments/confirmation-deadline';
import { SALON_TZ } from '../availability/availability.service';
import { strictBody } from '../client-access/client-access.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StaffAdminGuard } from './staff-access.controller';
import { staffIdentities } from './staff-identities';

const periods = ['week', 'month', 'quarter'] as const;
type Period = typeof periods[number];

class ReportQuery {
  @IsIn(periods)
  @IsOptional()
  period: Period = 'month';

  @IsUUID()
  @IsOptional()
  specialistId?: string;
}

function reportRange(period: Period) {
  const today = new Date(formatInTimeZone(Date.now(), SALON_TZ, 'yyyy-MM-dd') + 'T00:00:00Z');
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const monday = today.getUTCDate() - (today.getUTCDay() + 6) % 7;
  const start = period === 'week' ? new Date(Date.UTC(year, month, monday))
    : new Date(Date.UTC(year, month - (period === 'quarter' ? 2 : 0), 1));
  const end = period === 'week' ? new Date(Date.UTC(year, month, monday + 7))
    : new Date(Date.UTC(year, month + 1, 1));
  const civil = (date: Date) => date.toISOString().slice(0, 10);
  return {
    first: civil(start), last: civil(new Date(end.getTime() - 86_400_000)),
    start: fromZonedTime(civil(start) + 'T00:00:00', SALON_TZ),
    end: fromZonedTime(civil(end) + 'T00:00:00', SALON_TZ),
  };
}

@Controller('api/staff/reports')
@UseGuards(StaffAdminGuard)
export class StaffReportsController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async report(@Query(strictBody) { period, specialistId }: ReportQuery) {
    const { first, last, start, end } = reportRange(period);
    const specialists = await this.db.user.findMany({
      where: { email: { in: staffIdentities.map(identity => identity.email) }, specialistCategory: { not: null } },
      select: { id: true, firstName: true, specialistCategory: true }, orderBy: { role: 'asc' },
    });
    const scope = specialists.filter(person => !specialistId || person.id === specialistId);
    if (specialistId && !scope.length) throw new NotFoundException('Specialista nu a fost găsită.');
    const categories = [...new Set(scope.flatMap(person => person.specialistCategory ? [person.specialistCategory] : []))];
    const [appointments, services] = await Promise.all([
      this.db.appointment.findMany({
        where: { specialistId: { in: scope.map(person => person.id) }, startTime: { gte: start, lt: end },
          OR: [{ status: { in: ['COMPLETED', 'NO_SHOW'] } },
            { status: 'CANCELLED', OR: [{ cancellationReason: null },
              { cancellationReason: { not: confirmationExpiredReason } }] }] },
        select: { status: true, totalPriceRon: true, loyaltyDiscountRon: true, specialistId: true, serviceId: true,
          service: { select: { category: true } } },
      }),
      this.db.service.findMany({ where: { category: { in: categories } },
        select: { id: true, name: true, isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }, { id: 'asc' }] }),
    ]);
    const counts = { netBani: 0, completed: 0, noShows: 0, cancelled: 0, discounted: 0, discountBani: 0 };
    const group = (id: string, label: string) => ({ id, label, completed: 0, netBani: 0 });
    const byCategory = new Map(categories.map(id => [id, group(id, id === 'BROWS' ? 'Sprâncene' : 'Make-up')]));
    const byService = new Map(services.map(service => [service.id, group(service.id, service.name)]));
    const bySpecialist = new Map(scope.map(person => [person.id, group(person.id, person.firstName)]));
    for (const visit of appointments) {
      if (visit.status === 'NO_SHOW') { counts.noShows++; continue; }
      if (visit.status === 'CANCELLED') { counts.cancelled++; continue; }
      const netBani = visit.totalPriceRon.mul(100).toNumber();
      const discountBani = visit.loyaltyDiscountRon.mul(100).toNumber();
      counts.completed++;
      counts.netBani += netBani;
      counts.discountBani += discountBani;
      if (discountBani > 0) counts.discounted++;
      for (const row of [byCategory.get(visit.service.category), byService.get(visit.serviceId), bySpecialist.get(visit.specialistId)]) {
        if (row) { row.completed++; row.netBani += netBani; }
      }
    }
    const activeOrUsed = new Set([...services.filter(service => service.isActive).map(service => service.id),
      ...appointments.map(visit => visit.serviceId)]);
    return { first, last, specialists: specialists.map(({ id, firstName }) => ({ id, firstName })),
      kpis: counts, breakdowns: { categories: [...byCategory.values()],
        services: [...byService.values()].filter(service => activeOrUsed.has(service.id)), specialists: [...bySpecialist.values()] } };
  }
}
