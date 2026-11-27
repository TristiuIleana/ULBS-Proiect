import {
  Body, CanActivate, Controller, createParamDecorator, ExecutionContext, ForbiddenException, Get,
  Header, HttpCode, Injectable, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { strictBody } from '../client-access/client-access.controller';
import { requireStaffOrigin, StaffAccessService, staffCookie, staffOrigin, staffSessionAge, StaffUser } from './staff-access.service';

type StaffRequest = Request & { staff: StaffUser };
export const CurrentStaff = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<StaffRequest>().staff);

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly access: StaffAccessService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
    request.staff = await this.access.requireStaff(request.headers.cookie);
    if (!['GET', 'HEAD'].includes(request.method)) requireStaffOrigin(request.headers.origin);
    return true;
  }
}

@Injectable()
export class StaffAdminGuard extends StaffGuard {
  constructor(access: StaffAccessService) { super(access); }

  async canActivate(context: ExecutionContext) {
    await super.canActivate(context);
    if (context.switchToHttp().getRequest<StaffRequest>().staff.role !== 'ADMIN') {
      throw new ForbiddenException('Acces rezervat recepției.');
    }
    return true;
  }
}

class StaffLoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

function cookieOptions() {
  const origin = staffOrigin();
  const localHttp = origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  return { httpOnly: true, sameSite: 'strict' as const, secure: !localHttp || process.env.NODE_ENV === 'production', path: '/' };
}

@Controller('api/staff')
export class StaffAccessController {
  constructor(private readonly access: StaffAccessService) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Body(strictBody) { email, password }: StaffLoginDto, @Req() request: Request,
    @Res({ passthrough: true }) response: Response) {
    requireStaffOrigin(request.headers.origin);
    const token = await this.access.login(email, password, request.ip ?? 'unknown', request.headers.cookie);
    response.cookie(staffCookie, token, { ...cookieOptions(), maxAge: staffSessionAge });
    return { authenticated: true };
  }

  @Get('session')
  @UseGuards(StaffGuard)
  session(@CurrentStaff() user: StaffUser) {
    return user;
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    requireStaffOrigin(request.headers.origin);
    await this.access.logout(request.headers.cookie);
    response.clearCookie(staffCookie, cookieOptions());
    return { authenticated: false };
  }
}
