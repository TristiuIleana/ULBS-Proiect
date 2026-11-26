import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { MailModule } from './modules/notifications/mail.module';

@Module({
  imports: [PrismaModule, MailModule, ScheduleModule.forRoot(), AvailabilityModule, AppointmentsModule],
})
export class AppModule {}
