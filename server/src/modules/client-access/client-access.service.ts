import {
  ConflictException, ForbiddenException, Injectable, Logger, ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { allocateLoyalty, emailKey, lockClient, lockEmail } from './client-records';
import { hashPassword, passwordMatches, randomToken, tokenHash } from './password';
import { ContactDto } from '../appointments/public-booking.dto';
import { staffIdentities } from '../staff-access/staff-identities';

export const sessionCookie = 'beauty_session';
export const sessionMaxAge = 7 * 24 * 60 * 60_000;

@Injectable()
export class ClientAccessService {
  private readonly logger = new Logger(ClientAccessService.name);

  constructor(private readonly db: PrismaService, private readonly mail: MailService) {}

  async register(details: ContactDto & { password: string }) {
    const { password, ...contact } = details;
    const email = emailKey(contact.email);
    if (staffIdentities.some(identity => identity.email === email)) {
      throw new ConflictException('Adresa de e-mail este deja înregistrată.');
    }
    const passwordHash = await hashPassword(password);
    const token = randomToken();
    const verification = {
      verificationHash: tokenHash(token), verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    };

    await this.db.$transaction(async tx => {
      await lockEmail(tx, email);
      const existing = await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
      if (existing) {
        if (existing.role !== 'CLIENT' || existing.emailVerifiedAt || !await passwordMatches(password, existing.passwordHash)) {
          throw new ConflictException('Adresa de e-mail este deja înregistrată.');
        }
        await tx.user.update({ where: { id: existing.id }, data: verification });
      } else {
        await tx.user.create({ data: { ...contact, email, passwordHash, ...verification } });
      }
    });
    try {
      await this.mail.send(email, 'Confirmă adresa pentru contul Beauty Studio',
        `Confirmă adresa de e-mail pentru contul tău:\n${this.mail.link('/cont', token)}`);
    } catch {
      this.logger.warn('Trimiterea linkului de verificare a eșuat.');
      throw new ServiceUnavailableException('Nu am putut trimite mesajul. Reîncearcă cu aceleași date.');
    }
  }

  async verify(token: string) {
    const digest = tokenHash(token);
    const pending = await this.db.user.findUnique({ where: { verificationHash: digest } });
    if (pending?.role !== 'CLIENT') throw new ForbiddenException('Linkul de confirmare a expirat sau a fost folosit.');
    const user = await this.db.$transaction(async tx => {
      await lockEmail(tx, pending.email);
      const locked = await lockClient(tx, pending.id);
      if (locked?.verificationHash !== digest || !locked.verificationExpiresAt ||
        locked.verificationExpiresAt.getTime() <= Date.now()) {
        throw new ForbiddenException('Linkul de confirmare a expirat sau a fost folosit.');
      }
      const sameEmail = { equals: locked.email, mode: 'insensitive' as const };
      await tx.appointment.updateMany({ where: { clientId: null, guestEmail: sameEmail }, data: { clientId: locked.id } });
      await tx.waitlistEntry.updateMany({ where: { clientId: null, guestEmail: sameEmail }, data: { clientId: locked.id } });
      const lateCancellationCount = await tx.appointment.count({ where: { clientId: locked.id, lateCancellation: true } });
      await tx.user.update({
        where: { id: locked.id },
        data: { emailVerifiedAt: new Date(Date.now()), verificationHash: null, verificationExpiresAt: null, lateCancellationCount },
      });
      await allocateLoyalty(tx, locked.id);
      return locked;
    });
    return this.createSession(user.id);
  }

  async login(email: string, password: string) {
    const user = await this.db.user.findFirst({
      where: { role: 'CLIENT', email: { equals: emailKey(email), mode: 'insensitive' } },
    });
    const matches = await passwordMatches(password, user?.passwordHash);
    if (!user || !matches) throw new UnauthorizedException('E-mail sau parolă incorectă.');
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Confirmă adresa din e-mail înainte de autentificare.');
    }
    return this.createSession(user.id);
  }

  private async createSession(userId: string) {
    const token = randomToken();
    await this.db.clientSession.create({
      data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + sessionMaxAge) },
    });
    return token;
  }

  private sessionHash(cookie: string | undefined) {
    const token = cookie?.split(';').map(part => part.trim())
      .find(part => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
    return token && /^[a-zA-Z0-9_-]{43}$/.test(token) ? tokenHash(token) : undefined;
  }

  async optionalUser(cookie: string | undefined) {
    const digest = this.sessionHash(cookie);
    if (!digest) return null;
    const session = await this.db.clientSession.findUnique({
      where: { tokenHash: digest }, include: { user: true },
    });
    return session?.user.role === 'CLIENT' && session.expiresAt.getTime() > Date.now() ? session.user : null;
  }

  async requireUser(cookie: string | undefined, role: Role) {
    const user = await this.optionalUser(cookie);
    if (!user) throw new UnauthorizedException('Autentifică-te pentru a continua.');
    if (user.role !== role) throw new ForbiddenException('Accesul este restricționat.');
    return user;
  }

  async logout(cookie: string | undefined) {
    const digest = this.sessionHash(cookie);
    if (digest) await this.db.clientSession.deleteMany({ where: { tokenHash: digest } });
  }
}
