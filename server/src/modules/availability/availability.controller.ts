import { Controller, Get, Query, BadRequestException, NotFoundException, ParseUUIDPipe, Sse } from '@nestjs/common';
import { interval, map, merge, startWith } from 'rxjs';
import { AvailabilityService } from './availability.service';
import { AvailableSlot } from './availability.types';
import { PrismaService } from '../prisma/prisma.service';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

@Controller('api/availability')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly prisma: PrismaService,
  ) {}

  @Sse('changes')
  changes(@Query('specialistId', ParseUUIDPipe) specialistId: string) {
    return merge(
      this.availabilityService.changes(specialistId).pipe(map(({ date }) => ({ data: date }))),
      interval(25_000).pipe(map(() => ({ type: 'heartbeat', data: 'tick' }))),
    ).pipe(startWith({ type: 'ready', data: 'ready' }));
  }

  /**
   * GET /api/availability
   * Query params: serviceId, date (YYYY-MM-DD), specialistId
   * Returns array of available start slots in Europe/Bucharest.
   */
  @Get()
  async getSlots(
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
    @Query('specialistId') specialistId: string,
  ): Promise<{ slots: AvailableSlot[] }> {
    await this.validate(serviceId, specialistId, date);
    const slots = await this.availabilityService.getAvailableSlots(specialistId, serviceId, date);
    return { slots };
  }

  @Get('days')
  async getDays(
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
    @Query('specialistId') specialistId: string,
  ) {
    const { stages } = await this.validate(serviceId, specialistId, date);
    const start = Date.parse(`${date}T00:00:00Z`);
    const dayCount = Math.min(6, 1 + (Date.UTC(9999, 11, 30) - start) / 86_400_000);
    const days = await Promise.all(Array.from({ length: dayCount }, async (_, index) => {
      const day = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
      const [shift, override] = await Promise.all([
        this.availabilityService.resolveShiftWindow(specialistId, day),
        this.prisma.scheduleOverride.findUnique({
          where: { specialistId_date: { specialistId, date: day } }, select: { isFullDayPolicy: true },
        }),
      ]);
      const choices = shift ? await this.availabilityService.getSlotChoices(specialistId, shift, stages, this.prisma) : [];
      const morning = choices.filter(slot => slot.localIso.slice(11, 16) < '13:00');
      const afternoon = choices.filter(slot => slot.localIso.slice(11, 16) >= '13:00');
      const group = (slots: typeof choices) => ({
        total: slots.length, free: slots.filter(slot => slot.available).length,
      });
      const status = !shift || !choices.length ? 'closed' : choices.some(slot => slot.available) ? 'available' : 'full';
      return { date: day, status, isFullDay: override?.isFullDayPolicy ?? false, morning: group(morning), afternoon: group(afternoon), choices };
    }));
    return { days };
  }

  private async validate(serviceId: string, specialistId: string, date: string) {
    if (!serviceId || !date || !specialistId) {
      throw new BadRequestException(
        'Query params serviceId, date and specialistId are all required.',
      );
    }

    const day = new Date(date + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.getTime()) ||
        day.toISOString().slice(0, 10) !== date || day.getUTCFullYear() === 0) {
      throw new BadRequestException('date must be a valid YYYY-MM-DD date.');
    }
    if (!uuid.test(serviceId) || !uuid.test(specialistId)) {
      throw new BadRequestException('serviceId and specialistId must be UUIDs.');
    }
    const [service, specialist] = await Promise.all([
      this.prisma.service.findUnique({
        where: { id: serviceId, isActive: true }, include: { stages: { orderBy: { stageOrder: 'asc' } } },
      }),
      this.prisma.user.findUnique({
        where: { id: specialistId, role: { in: ['ADMIN', 'SPECIALIST'] } },
        select: { specialistCategory: true },
      }),
    ]);
    if (!service || !specialist) throw new NotFoundException('Service or specialist not found.');
    if (service.category !== specialist.specialistCategory) {
      throw new BadRequestException('The specialist does not provide this service.');
    }

    return service;
  }
}
