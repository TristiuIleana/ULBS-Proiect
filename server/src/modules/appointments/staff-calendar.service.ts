import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import { AvailabilityService, SALON_TZ } from '../availability/availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { staffIdentities } from '../staff-access/staff-identities';
import { WaitlistService } from '../waitlist/waitlist.service';
import { AppointmentsService } from './appointments.service';
import { serializeCalendar } from './calendar-export';
import { pendingConfirmationExpired } from './confirmation-deadline';
import { ContactDto, SlotBookingDto } from './public-booking.dto';

const dayMs = 86_400_000;
const names = staffIdentities.map(identity => identity.email);
const bookingSelect = {
  id: true, specialistId: true, serviceId: true, startTime: true, endTime: true, status: true, createdAt: true,
  guestFirstName: true, guestLastName: true, guestPhone: true, guestEmail: true, notes: true,
  client: { select: { firstName: true, lastName: true, phone: true, email: true } },
  specialist: { select: { firstName: true } },
  service: { select: { name: true } },
  stages: { orderBy: { stageOrder: 'asc' }, select: { isBusy: true, startTime: true, endTime: true } },
} satisfies Prisma.AppointmentSelect;

type CalendarRow = Prisma.AppointmentGetPayload<{ select: typeof bookingSelect }>;

function calendarRange(date: string, view: 'day' | 'week' = 'day') {
  const civil = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(civil.getTime()) || civil.getUTCFullYear() < 1 ||
      civil.toISOString().slice(0, 10) !== date || date > '9999-12-24') {
    throw new BadRequestException('Data calendarului nu este validă.');
  }
  const startMs = civil.getTime() - (view === 'week' ? (civil.getUTCDay() + 6) % 7 * dayMs : 0);
  const first = new Date(startMs).toISOString().slice(0, 10);
  const last = new Date(startMs + (view === 'week' ? 7 : 1) * dayMs).toISOString().slice(0, 10);
  return { first, last, start: fromZonedTime(`${first}T00:00:00`, SALON_TZ), end: fromZonedTime(`${last}T00:00:00`, SALON_TZ) };
}

function bookingView(booking: CalendarRow, now: number) {
  const { guestFirstName, guestLastName, guestPhone, guestEmail, client, createdAt, ...fields } = booking;
  return {
    ...fields, status: pendingConfirmationExpired({ status: booking.status, createdAt }, now) ? 'CANCELLED' : booking.status,
    contact: client ?? { firstName: guestFirstName, lastName: guestLastName, phone: guestPhone, email: guestEmail },
  };
}

@Injectable()
export class StaffCalendarService {
  constructor(private readonly db: PrismaService, private readonly availability: AvailabilityService,
    private readonly appointments: AppointmentsService, private readonly waitlist: WaitlistService) {}

  private async specialists(specialistId?: string) {
    const specialists = await this.db.user.findMany({
      where: { id: specialistId, email: { in: names } },
      orderBy: { role: 'asc' }, select: { id: true, firstName: true, specialistCategory: true },
    });
    if (specialistId && !specialists.length) throw new NotFoundException('Specialista nu a fost găsită.');
    return specialists;
  }

  async calendar(date: string, view: 'day' | 'week', specialistId?: string) {
    const { first, last, start, end } = calendarRange(date, view);
    const specialists = await this.specialists(specialistId);
    const scope = { in: specialists.map(specialist => specialist.id) };
    const [rows, fullDays] = await Promise.all([
      this.db.appointment.findMany({
        where: { specialistId: scope, startTime: { lt: end }, endTime: { gt: start } },
        select: bookingSelect, orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
      }),
      this.db.scheduleOverride.findMany({
        where: { specialistId: scope, date: { gte: first, lt: last }, isFullDayPolicy: true },
        select: { specialistId: true, date: true },
      }),
    ]);
    const now = Date.now();
    return { specialists, appointments: rows.map(row => bookingView(row, now)), fullDays };
  }

  async detail(id: string, specialistId?: string) {
    const row = await this.db.appointment.findFirst({
      where: { id, specialistId, specialist: { email: { in: names } } }, select: bookingSelect,
    });
    if (!row) throw new NotFoundException('Programarea nu este disponibilă.');
    return bookingView(row, Date.now());
  }

  async export(date: string, view: 'day' | 'week', specialistId?: string) {
    const { first, start, end } = calendarRange(date, view);
    const specialists = await this.specialists(specialistId);
    const events = await this.db.appointment.findMany({
      where: { specialistId: { in: specialists.map(specialist => specialist.id) }, status: 'CONFIRMED',
        startTime: { lt: end }, endTime: { gt: start } },
      select: { id: true, startTime: true, endTime: true, updatedAt: true,
        service: { select: { name: true } }, specialist: { select: { firstName: true } } },
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    });
    if (!events.length) throw new NotFoundException('Nu există programări confirmate în perioada selectată.');
    return { body: serializeCalendar(events), filename: `beauty-studio-${first}-${view}.ics` };
  }

  async slots(specialistId: string, serviceId: string, date: string, appointmentId?: string) {
    calendarRange(date);
    const [specialist] = await this.specialists(specialistId);
    const service = await this.db.service.findUnique({
      where: { id: serviceId, isActive: true },
      include: { stages: { orderBy: { stageOrder: 'asc' } } },
    });
    if (!service || specialist.specialistCategory !== service.category) {
      throw new BadRequestException('Specialista nu oferă acest serviciu.');
    }
    if (appointmentId && !await this.db.appointment.findFirst({ where: { id: appointmentId, specialistId, serviceId } })) {
      throw new NotFoundException('Programarea nu este disponibilă.');
    }
    const shift = await this.availability.resolveShiftWindow(specialistId, date);
    return { slots: shift ? await this.availability.getSlotsForShift(specialistId, shift, service.stages,
      this.db, { appointmentId }) : [] };
  }

  async create(details: SlotBookingDto & Partial<ContactDto>) {
    await this.specialists(details.specialistId);
    const booking = await this.appointments.transaction(tx =>
      this.appointments.reserve(tx, details, undefined, undefined, 'reception'));
    this.availability.invalidate(booking.specialistId, booking.startTime);
    return this.detail(booking.id);
  }

  async queue(date: string, view: 'day' | 'week', specialistId?: string) {
    const { first, last } = calendarRange(date, view);
    const specialists = await this.specialists(specialistId);
    const entries = await this.db.waitlistEntry.findMany({
      where: { specialistId: { in: specialists.map(specialist => specialist.id) }, desiredDate: { gte: first, lt: last } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, specialistId: true, desiredDate: true, window: true, status: true, expiresAt: true,
        notifiedAt: true, emailClaimedAt: true, guestFirstName: true, guestLastName: true,
        service: { select: { name: true } }, client: { select: { firstName: true, lastName: true } },
      },
    });
    return { entries: entries.map(({ emailClaimedAt, client, guestFirstName, guestLastName, ...entry }) => ({
      ...entry, firstName: client?.firstName ?? guestFirstName, lastName: client?.lastName ?? guestLastName,
      canNotify: entry.status === 'NOTIFIED' && (entry.expiresAt?.getTime() ?? 0) > Date.now() &&
        !entry.notifiedAt && !emailClaimedAt,
    })) };
  }

  async notify(id: string) {
    const entry = await this.db.waitlistEntry.findUnique({
      where: { id }, select: { status: true, expiresAt: true, notifiedAt: true, emailClaimedAt: true },
    });
    if (!entry) throw new NotFoundException('Cererea Waitlist nu a fost găsită.');
    if (entry.notifiedAt) return { notified: true };
    if (entry.status !== 'NOTIFIED' || (entry.expiresAt?.getTime() ?? 0) <= Date.now() || entry.emailClaimedAt) {
      throw new ConflictException('Oferta nu este disponibilă pentru expediere.');
    }
    await this.waitlist.notifyPending(id);
    const current = await this.db.waitlistEntry.findUnique({ where: { id }, select: { notifiedAt: true } });
    return { notified: Boolean(current?.notifiedAt) };
  }
}
