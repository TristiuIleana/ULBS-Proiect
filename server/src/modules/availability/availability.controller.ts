import { Controller, Get, Query, BadRequestException, NotFoundException } from '@nestjs/common';
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
        where: { id: serviceId, isActive: true }, select: { category: true },
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

    const slots = await this.availabilityService.getAvailableSlots(
      specialistId,
      serviceId,
      date,
    );
    return { slots };
  }
}
