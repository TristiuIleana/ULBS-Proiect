import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
import { AppointmentsService } from './appointments.service';
import { BookingConfirmationService } from './booking-confirmation.service';
import { PublicBookingDto } from './public-booking.dto';

@Controller('api/bookings')
export class PublicBookingsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly availability: AvailabilityService,
    private readonly confirmation: BookingConfirmationService,
  ) {}

  @Post()
  async book(@Body(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })) guest: PublicBookingDto) {
    const appointment = await this.appointments.bookAppointment(guest);
    const summary = {
      id: appointment.id,
      status: appointment.status,
      serviceName: appointment.service.name,
      specialistName: appointment.specialist.firstName,
      startsAtLocal: this.availability.toLocalIso(appointment.startTime.getTime()),
      endsAtLocal: this.availability.toLocalIso(appointment.endTime.getTime()),
      totalPriceRon: appointment.totalPriceRon.toString(),
    };
    const emailStatus = await this.confirmation.send(guest.email, summary);
    return { ...summary, emailStatus };
  }
}
