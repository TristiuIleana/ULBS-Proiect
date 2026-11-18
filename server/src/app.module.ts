import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';

@Module({
  imports: [PrismaModule, AvailabilityModule, AppointmentsModule],
})
export class AppModule {}
