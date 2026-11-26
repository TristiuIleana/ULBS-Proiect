import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingConfirmationService } from './booking-confirmation.service';
import { PublicBookingsController } from './public-bookings.controller';
import { ClientAccessModule } from '../client-access/client-access.module';
import { WaitlistService } from '../waitlist/waitlist.service';
import { WaitlistController } from '../waitlist/waitlist.controller';
import { AppointmentManagementService } from './appointment-management.service';
import { AdminAppointmentsController, AppointmentManagementController } from './appointment-management.controller';
import { NotificationJobsService } from '../notifications/notification-jobs.service';

@Module({
  imports: [AvailabilityModule, ClientAccessModule],
  controllers: [PublicBookingsController, AppointmentManagementController, AdminAppointmentsController, WaitlistController],
  providers: [AppointmentsService, AppointmentManagementService, BookingConfirmationService, WaitlistService, NotificationJobsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
