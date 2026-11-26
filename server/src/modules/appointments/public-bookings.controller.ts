import { Body, Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AppointmentManagementService } from './appointment-management.service';
import { AppointmentsService } from './appointments.service';
import { BookingConfirmationService } from './booking-confirmation.service';
import { PublicBookingDto, ResendTokenDto, SlotBookingDto, TokenDto } from './public-booking.dto';
import { strictBody } from '../client-access/client-access.controller';
import { ClientAccessService } from '../client-access/client-access.service';

@Controller('api/bookings')
export class PublicBookingsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly management: AppointmentManagementService,
    private readonly confirmation: BookingConfirmationService,
    private readonly access: ClientAccessService,
  ) {}

  @Post()
  async book(@Body(strictBody) guest: PublicBookingDto) {
    const appointment = await this.appointments.bookAppointment(guest);
    return this.confirmation.notifyCreated(appointment, guest.email);
  }

  @Post('account')
  async bookWithAccount(@Body(strictBody) slot: SlotBookingDto, @Headers('cookie') cookie: string | undefined) {
    const user = await this.access.requireUser(cookie, 'CLIENT');
    return this.confirmation.notifyCreated(await this.appointments.bookAppointment(slot, user.id), user.email);
  }

  @Post('confirm')
  @HttpCode(200)
  confirm(@Body(strictBody) { token }: TokenDto) {
    return this.management.confirm(token);
  }

  @Post(':id/resend-confirmation')
  @HttpCode(200)
  resend(@Param('id', ParseUUIDPipe) id: string, @Body(strictBody) { resendToken }: ResendTokenDto) {
    return this.management.resendConfirmation({ id, resendToken });
  }
}
