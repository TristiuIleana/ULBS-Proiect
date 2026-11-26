import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);

export function randomToken() {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function passwordMatches(password: string, stored: string | null | undefined) {
  const [salt, hash] = (stored ?? '').split(':');
  const actual = await derive(password, salt || 'invalid-account', 64) as Buffer;
  const expected = Buffer.from(hash ?? '', 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
