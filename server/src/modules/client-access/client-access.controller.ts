import { Body, Controller, Get, Headers, HttpCode, Post, Res, ValidationPipe } from '@nestjs/common';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { ContactDto } from '../appointments/public-booking.dto';
import { ClientAccessService, sessionCookie, sessionMaxAge } from './client-access.service';
import { PrismaService } from '../prisma/prisma.service';

export const strictBody = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

class RegisterDto extends ContactDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

class VerifyDto {
  @Matches(/^[a-zA-Z0-9_-]{43}$/)
  token!: string;
}

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };

@Controller('api/client')
export class ClientAccessController {
  constructor(private readonly access: ClientAccessService, private readonly db: PrismaService) {}

  @Post('register')
  async register(@Body(strictBody) data: RegisterDto) {
    await this.access.register(data);
    return { verificationRequired: true };
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Body(strictBody) { token }: VerifyDto, @Res({ passthrough: true }) response: Response) {
    response.cookie(sessionCookie, await this.access.verify(token), { ...cookieOptions, maxAge: sessionMaxAge });
    return { authenticated: true };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body(strictBody) { email, password }: LoginDto, @Res({ passthrough: true }) response: Response) {
    response.cookie(sessionCookie, await this.access.login(email, password), { ...cookieOptions, maxAge: sessionMaxAge });
    return { authenticated: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Headers('cookie') cookie: string | undefined, @Res({ passthrough: true }) response: Response) {
    await this.access.logout(cookie);
    response.clearCookie(sessionCookie, cookieOptions);
    return { authenticated: false };
  }

  @Get('account')
  async account(@Headers('cookie') cookie: string | undefined) {
    const user = await this.access.requireUser(cookie, 'CLIENT');
    const bookings = await this.db.appointment.findMany({
      where: { clientId: user.id },
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
      select: {
        id: true, status: true, startTime: true, endTime: true, totalPriceRon: true, loyaltyDiscountRon: true,
        service: { select: { name: true } }, specialist: { select: { firstName: true } },
      },
    });
    const completed = bookings.filter(booking => booking.status === 'COMPLETED').length;
    const now = Date.now();
    const upcoming = bookings.filter(booking => booking.status === 'CONFIRMED' && booking.startTime.getTime() > now);
    const progress = completed % 5;
    return {
      firstName: user.firstName, lastName: user.lastName, phone: user.phone, email: user.email,
      createdAt: user.createdAt,
      blocked: user.lateCancellationCount >= 3, lateCancellationCount: user.lateCancellationCount, progress,
      nextDiscount: progress === 4 && !bookings.some(booking =>
        booking.status === 'CONFIRMED' && booking.loyaltyDiscountRon.gt(0)),
      upcoming,
      history: bookings.filter(booking => booking.status !== 'CONFIRMED' || booking.startTime.getTime() <= now).reverse(),
    };
  }
}
