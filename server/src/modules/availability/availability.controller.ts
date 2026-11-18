import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailableSlot } from './availability.types';

@Controller('api/availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

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

    // Basic date format guard "YYYY-MM-DD"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format.');
    }

    const slots = await this.availabilityService.getAvailableSlots(
      specialistId,
      serviceId,
      date,
    );
    return { slots };
  }
}
