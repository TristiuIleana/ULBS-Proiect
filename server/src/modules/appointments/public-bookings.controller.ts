import { Body, Controller, Headers, Post } from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
import { AppointmentsService } from './appointments.service';
import { BookingConfirmationService } from './booking-confirmation.service';
import { PublicBookingDto, SlotBookingDto } from './public-booking.dto';
import { strictBody } from '../client-access/client-access.controller';
import { ClientAccessService } from '../client-access/client-access.service';

@Controller('api/bookings')
export class PublicBookingsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly availability: AvailabilityService,
    private readonly confirmation: BookingConfirmationService,
    private readonly access: ClientAccessService,
  ) {}

  @Post()
  async book(@Body(strictBody) guest: PublicBookingDto) {
    const appointment = await this.appointments.bookAppointment(guest);
    return this.confirm(appointment, guest.email);
  }

  @Post('account')
  async bookWithAccount(@Body(strictBody) slot: SlotBookingDto, @Headers('cookie') cookie: string | undefined) {
    const user = await this.access.requireUser(cookie, 'CLIENT');
    return this.confirm(await this.appointments.bookAppointment(slot, user.id), user.email);
  }

  private async confirm(appointment: Awaited<ReturnType<AppointmentsService['bookAppointment']>>, email: string) {
    const summary = {
      id: appointment.id,
      status: appointment.status,
      serviceName: appointment.service.name,
      specialistName: appointment.specialist.firstName,
      startsAtLocal: this.availability.toLocalIso(appointment.startTime.getTime()),
      endsAtLocal: this.availability.toLocalIso(appointment.endTime.getTime()),
      totalPriceRon: appointment.totalPriceRon.toString(),
      loyaltyDiscountRon: appointment.loyaltyDiscountRon.toString(),
    };
    const emailStatus = await this.confirmation.send(email, { ...summary, cancellationToken: appointment.cancellationToken });
    return { ...summary, emailStatus };
  }
}
