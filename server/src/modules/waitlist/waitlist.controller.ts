import { Body, ConflictException, Controller, Get, Headers, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { WaitlistWindow } from '@prisma/client';
import { IsEnum, IsUUID, Matches } from 'class-validator';
import { AppointmentsService, lockSpecialist } from '../appointments/appointments.service';
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
    const { booking, address } = await this.appointments.transaction(async tx => {
      const lookup = await tx.waitlistEntry.findUnique({ where: { priorityToken: token }, select: { specialistId: true } });
      if (!lookup) throw new ConflictException('Oferta a expirat sau a fost folosită.');
      await lockSpecialist(tx, lookup.specialistId);
      const entry = await tx.waitlistEntry.findFirst({
        where: { priorityToken: token, status: 'NOTIFIED', expiresAt: { gt: new Date(Date.now()) } },
        include: { client: { select: { email: true } } },
      });
      const address = entry?.client?.email ?? entry?.guestEmail;
      if (!entry?.offeredStartAt || !address) throw new ConflictException('Oferta a expirat sau a fost folosită.');
      const booking = await this.appointments.reserve(tx, {
        specialistId: entry.specialistId, serviceId: entry.serviceId, slotUtcMs: entry.offeredStartAt.getTime(),
        firstName: entry.guestFirstName ?? undefined, lastName: entry.guestLastName ?? undefined,
        phone: entry.guestPhone ?? undefined, email: address,
      }, entry.clientId ?? undefined, entry.id);
      const claimed = await tx.waitlistEntry.updateMany({
        where: { id: entry.id, status: 'NOTIFIED', expiresAt: { gt: new Date(Date.now()) } },
        data: { status: 'CLAIMED' },
      });
      if (!claimed.count) throw new ConflictException('Oferta a expirat.');
      return { booking, address };
    });
    this.availability.invalidate(booking.specialistId, booking.startTime);
    return this.confirmation.notifyCreated(booking, address);
  }
}
