import { Module } from '@nestjs/common';
import { ClientAccessModule } from '../client-access/client-access.module';
import { StaffAccessController, StaffAdminGuard, StaffGuard } from './staff-access.controller';
import { StaffAccessService } from './staff-access.service';

@Module({
  imports: [ClientAccessModule],
  controllers: [StaffAccessController],
  providers: [StaffAccessService, StaffGuard, StaffAdminGuard],
  exports: [StaffAccessService, StaffGuard, StaffAdminGuard],
})
export class StaffAccessModule {}
