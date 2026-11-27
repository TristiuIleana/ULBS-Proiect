import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClientAccessService } from '../client-access/client-access.service';
import { emailKey, lockEmail } from '../client-access/client-records';
import { passwordMatches, randomToken, tokenHash } from '../client-access/password';
import { PrismaService } from '../prisma/prisma.service';
import { isStaffIdentity, staffIdentities } from './staff-identities';

export const staffCookie = 'beauty_staff';
export const staffSessionAge = 8 * 60 * 60_000;
const attemptWindow = 15 * 60_000;

export function staffOrigin() {
  return new URL(process.env.PUBLIC_WEB_ORIGIN || 'http://localhost:17173');
}

export function requireStaffOrigin(origin: string | undefined) {
  if (origin !== staffOrigin().origin) throw new ForbiddenException('Originea cererii nu este permisă.');
}

export type StaffUser = { id: string; firstName: string; role: 'ADMIN' | 'SPECIALIST' };

function sessionHash(cookie: string | undefined) {
  const token = cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${staffCookie}=`))?.slice(staffCookie.length + 1);
  return token && /^[a-zA-Z0-9_-]{43}$/.test(token) ? tokenHash(token) : undefined;
}

@Injectable()
export class StaffAccessService {
  private readonly attempts = new Map<string, { count: number; expires: number }>();

  constructor(private readonly db: PrismaService, private readonly clients: ClientAccessService) {}

  async login(email: string, password: string, address: string, cookie: string | undefined) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.expires <= now) this.attempts.delete(key);
    const attempt = this.attempts.get(address) ?? { count: 0, expires: now + attemptWindow };
    if (attempt.count >= 10 || (!this.attempts.has(address) && this.attempts.size >= 1024)) {
      throw new HttpException('Prea multe încercări. Încearcă mai târziu.', HttpStatus.TOO_MANY_REQUESTS);
    }
    attempt.count++;
    this.attempts.set(address, attempt);
    const normalized = emailKey(email);
    const user = staffIdentities.some(identity => identity.email === normalized)
      ? await this.db.user.findUnique({ where: { email: normalized } }) : null;
    const matches = await passwordMatches(password, user?.passwordHash);
    if (!user || !isStaffIdentity(user) || !matches) throw new UnauthorizedException('E-mail sau parolă incorectă.');

    const token = randomToken();
    await this.db.$transaction(async tx => {
      await lockEmail(tx, normalized);
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current || !isStaffIdentity(current) || current.passwordHash !== user.passwordHash) {
        throw new UnauthorizedException('E-mail sau parolă incorectă.');
      }
      const previous = sessionHash(cookie);
      await tx.staffSession.deleteMany({ where: {
        OR: [{ userId: user.id, expiresAt: { lte: new Date(now) } }, ...(previous ? [{ tokenHash: previous }] : [])],
      } });
      await tx.staffSession.create({ data: {
        userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(now + staffSessionAge),
      } });
    });
    this.attempts.delete(address);
    return token;
  }

  async requireStaff(cookie: string | undefined): Promise<StaffUser> {
    const tokenHash = sessionHash(cookie);
    const session = tokenHash ? await this.db.staffSession.findUnique({ where: { tokenHash }, include: { user: true } }) : null;
    if (session && session.expiresAt.getTime() > Date.now() && isStaffIdentity(session.user)) {
      const { id, firstName, role } = session.user;
      if (role === 'ADMIN' || role === 'SPECIALIST') return { id, firstName, role };
    }
    if (await this.clients.optionalUser(cookie)) throw new ForbiddenException('Acces rezervat personalului.');
    throw new UnauthorizedException('Autentifică-te pentru a continua.');
  }

  async logout(cookie: string | undefined) {
    const tokenHash = sessionHash(cookie);
    if (tokenHash) await this.db.staffSession.deleteMany({ where: { tokenHash } });
  }
}
