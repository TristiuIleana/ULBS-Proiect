import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingConfirmationService } from './booking-confirmation.service';
import { PublicBookingsController } from './public-bookings.controller';

@Module({
  imports: [AvailabilityModule],
  controllers: [PublicBookingsController],
  providers: [AppointmentsService, BookingConfirmationService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
