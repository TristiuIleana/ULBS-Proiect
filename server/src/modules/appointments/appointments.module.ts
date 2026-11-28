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
import { StaffAccessModule } from '../staff-access/staff-access.module';
import { EmployeeCalendarController, ReceptionCalendarController } from './staff-calendar.controller';
import { StaffCalendarService } from './staff-calendar.service';
import { StaffReportsController } from '../staff-access/staff-reports.controller';
import { StaffServicesController } from '../staff-access/staff-services.controller';

@Module({
  imports: [AvailabilityModule, ClientAccessModule, StaffAccessModule],
  controllers: [PublicBookingsController, AppointmentManagementController, AdminAppointmentsController,
    WaitlistController, EmployeeCalendarController, ReceptionCalendarController, StaffReportsController, StaffServicesController],
  providers: [AppointmentsService, AppointmentManagementService, BookingConfirmationService, WaitlistService,
    NotificationJobsService, StaffCalendarService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
