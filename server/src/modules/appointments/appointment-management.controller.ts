import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { strictBody } from '../client-access/client-access.controller';
import { ClientAccessService } from '../client-access/client-access.service';
import { AppointmentManagementService } from './appointment-management.service';

class TokenDto {
  @IsUUID()
  token!: string;
}

class MoveDto {
  @IsInt()
  @Min(0)
  @Max(Date.UTC(9999, 11, 30, 23, 59, 59, 999))
  slotUtcMs!: number;
}

class MoveByTokenDto extends MoveDto {
  @IsUUID()
  token!: string;
}

@Controller('api/appointments')
export class AppointmentManagementController {
  constructor(private readonly appointments: AppointmentManagementService, private readonly access: ClientAccessService) {}

  @Get('by-token')
  getByToken(@Query('token', ParseUUIDPipe) token: string) {
    return this.appointments.get({ token });
  }

  @Post('by-token/cancel')
  @HttpCode(200)
  cancelByToken(@Body(strictBody) { token }: TokenDto) {
    return this.appointments.change({ token }, 'cancel', false);
  }

  @Post('by-token/reschedule')
  @HttpCode(200)
  moveByToken(@Body(strictBody) { token, slotUtcMs }: MoveByTokenDto) {
    return this.appointments.change({ token }, 'reschedule', false, slotUtcMs);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @Headers('cookie') cookie: string | undefined) {
    const user = await this.access.requireUser(cookie, 'CLIENT');
    return this.appointments.get({ id, clientId: user.id });
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Headers('cookie') cookie: string | undefined) {
    const user = await this.access.requireUser(cookie, 'CLIENT');
    return this.appointments.change({ id, clientId: user.id }, 'cancel', false);
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  async move(@Param('id', ParseUUIDPipe) id: string, @Body(strictBody) { slotUtcMs }: MoveDto,
    @Headers('cookie') cookie: string | undefined) {
    const user = await this.access.requireUser(cookie, 'CLIENT');
    return this.appointments.change({ id, clientId: user.id }, 'reschedule', false, slotUtcMs);
  }
}

@Controller('api/admin')
export class AdminAppointmentsController {
  constructor(private readonly appointments: AppointmentManagementService, private readonly access: ClientAccessService) {}

  @Post('appointments/:id/complete')
  @HttpCode(200)
  async complete(@Param('id', ParseUUIDPipe) id: string, @Headers('cookie') cookie: string | undefined) {
    await this.access.requireUser(cookie, 'ADMIN');
    return this.appointments.change({ id }, 'complete', true);
  }

  @Post('appointments/:id/cancel')
  @HttpCode(200)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Headers('cookie') cookie: string | undefined) {
    await this.access.requireUser(cookie, 'ADMIN');
    return this.appointments.change({ id }, 'cancel', true);
  }

  @Post('clients/:id/unblock')
  @HttpCode(200)
  async unblock(@Param('id', ParseUUIDPipe) id: string, @Headers('cookie') cookie: string | undefined) {
    await this.access.requireUser(cookie, 'ADMIN');
    return this.appointments.unblock(id);
  }
}
