import {
  Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import type { Response } from 'express';
import { strictBody } from '../client-access/client-access.controller';
import { CurrentStaff, StaffAdminGuard, StaffGuard } from '../staff-access/staff-access.controller';
import type { StaffUser } from '../staff-access/staff-access.service';
import { MoveDto } from './appointment-management.controller';
import { AppointmentManagementService } from './appointment-management.service';
import { PublicBookingDto, UUID } from './public-booking.dto';
import { StaffCalendarService } from './staff-calendar.service';

class CalendarQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsIn(['day', 'week'])
  @IsOptional()
  view: 'day' | 'week' = 'day';
}

class ReceptionQuery extends CalendarQuery {
  @IsUUID()
  @IsOptional()
  specialistId?: string;
}

class SlotsQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @Matches(UUID)
  serviceId!: string;

  @IsUUID()
  specialistId!: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;
}

class DeskBookingDto extends PublicBookingDto {
  @IsOptional()
  email!: string;
}

enum Attendance { complete = 'complete', noShow = 'no-show' }
enum ReceptionAction { complete = 'complete', noShow = 'no-show', cancel = 'cancel' }

async function sendCalendar(response: Response, calendar: ReturnType<StaffCalendarService['export']>) {
  const { body, filename } = await calendar;
  response.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
  response.send(body);
}

@Controller('api/staff')
@UseGuards(StaffGuard)
export class EmployeeCalendarController {
  constructor(private readonly calendar: StaffCalendarService, private readonly appointments: AppointmentManagementService) {}

  @Get('appointments')
  list(@Query(strictBody) query: CalendarQuery, @CurrentStaff() user: StaffUser) {
    return this.calendar.calendar(query.date, query.view, user.id);
  }

  @Get('appointments/:id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() user: StaffUser) {
    return this.calendar.detail(id, user.id);
  }

  @Post('appointments/:id/:action')
  @HttpCode(200)
  mark(@Param('id', ParseUUIDPipe) id: string, @Param('action', new ParseEnumPipe(Attendance)) action: Attendance,
    @CurrentStaff() user: StaffUser) {
    const admin = user.role === 'ADMIN';
    return this.appointments.change(admin ? { id } : { id, specialistId: user.id }, action, admin);
  }

  @Get('calendar.ics')
  export(@Query(strictBody) query: CalendarQuery, @CurrentStaff() user: StaffUser, @Res() response: Response) {
    return sendCalendar(response, this.calendar.export(query.date, query.view, user.id));
  }
}

@Controller('api/staff/reception')
@UseGuards(StaffAdminGuard)
export class ReceptionCalendarController {
  constructor(private readonly calendar: StaffCalendarService, private readonly appointments: AppointmentManagementService) {}

  @Get('appointments')
  list(@Query(strictBody) query: ReceptionQuery) {
    return this.calendar.calendar(query.date, query.view, query.specialistId);
  }

  @Get('appointments/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendar.detail(id);
  }

  @Post('appointments')
  create(@Body(strictBody) body: DeskBookingDto) {
    return this.calendar.create(body);
  }

  @Post('appointments/:id/reschedule')
  @HttpCode(200)
  move(@Param('id', ParseUUIDPipe) id: string, @Body(strictBody) body: MoveDto) {
    return this.appointments.change({ id }, 'reschedule', true, body.slotUtcMs);
  }

  @Post('appointments/:id/:action')
  @HttpCode(200)
  change(@Param('id', ParseUUIDPipe) id: string, @Param('action', new ParseEnumPipe(ReceptionAction)) action: ReceptionAction) {
    return this.appointments.change({ id }, action, true);
  }

  @Get('slots')
  slots(@Query(strictBody) query: SlotsQuery) {
    return this.calendar.slots(query.specialistId, query.serviceId, query.date, query.appointmentId);
  }

  @Get('waitlist')
  queue(@Query(strictBody) query: ReceptionQuery) {
    return this.calendar.queue(query.date, query.view, query.specialistId);
  }

  @Post('waitlist/:id/notify')
  @HttpCode(200)
  notify(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendar.notify(id);
  }

  @Post('waitlist/:id/convert')
  convert(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendar.convert(id);
  }

  @Get('calendar.ics')
  export(@Query(strictBody) query: ReceptionQuery, @Res() response: Response) {
    return sendCalendar(response, this.calendar.export(query.date, query.view, query.specialistId));
  }
}
