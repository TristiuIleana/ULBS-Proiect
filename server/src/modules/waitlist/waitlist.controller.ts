import { Body, ConflictException, Controller, Get, Headers, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { WaitlistWindow } from '@prisma/client';
import { IsEnum, IsUUID, Matches } from 'class-validator';
import { AppointmentsService } from '../appointments/appointments.service';
import { BookingConfirmationService } from '../appointments/booking-confirmation.service';
import { ContactDto, UUID } from '../appointments/public-booking.dto';
import { AvailabilityService } from '../availability/availability.service';
import { strictBody } from '../client-access/client-access.controller';
import { ClientAccessService } from '../client-access/client-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from './waitlist.service';

class EntryDto extends ContactDto {
  @Matches(UUID)
  serviceId!: string;

  @IsUUID()
  specialistId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsEnum(WaitlistWindow)
  window!: WaitlistWindow;
}

class ClaimDto {
  @IsUUID()
  token!: string;
}

@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly db: PrismaService, private readonly waitlist: WaitlistService,
    private readonly access: ClientAccessService, private readonly appointments: AppointmentsService,
    private readonly availability: AvailabilityService, private readonly confirmation: BookingConfirmationService) {}

  @Post()
  async enroll(@Body(strictBody) details: EntryDto, @Headers('cookie') cookie: string | undefined) {
    const user = await this.access.optionalUser(cookie);
    return this.waitlist.enroll(details, user?.role === 'CLIENT' ? user.id : undefined);
  }

  @Get('offer')
  async offer(@Query('token', ParseUUIDPipe) token: string) {
    const entry = await this.db.waitlistEntry.findFirst({
      where: { priorityToken: token, status: 'NOTIFIED', expiresAt: { gt: new Date(Date.now()) } },
      include: { service: { select: { name: true } } },
    });
    if (!entry?.offeredStartAt) throw new ConflictException('Oferta a expirat sau a fost folosită.');
    return {
      serviceName: entry.service.name, startsAtLocal: this.availability.toLocalIso(entry.offeredStartAt.getTime()),
      expiresAt: entry.expiresAt,
    };
  }

  @Post('claim')
  async claim(@Body(strictBody) { token }: ClaimDto) {
    const { booking, address } = await this.appointments.claimWaitlist({ priorityToken: token }, 'public');
    return this.confirmation.notifyCreated(booking, address);
  }
}
