import { SignJWT } from 'jose';
import { DateTime } from 'luxon';

import { createId } from '@/lib/id';
import { userDB } from '@/lib/db';

const SG_ZONE = 'Asia/Singapore';
const SESSION_COOKIE_NAME = 'session';
const SECRET = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET ?? 'development-secret-change-me'
);

export type TestSession = {
  userId: string;
  username: string;
  token: string;
  cookieHeader: string;
};

let cachedSession: TestSession | null = null;

export async function ensureTestSession(): Promise<TestSession> {
  if (cachedSession) {
    return cachedSession;
  }

  const timestamp = new Date().toISOString();
  const username = `playwright-${process.pid}`;
  let user = userDB.findByUsername(username);
  if (!user) {
    user = userDB.create({
      id: createId(),
      username,
      displayName: 'Playwright User',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);

  cachedSession = {
    userId: user.id,
    username: user.username,
    token,
    cookieHeader: `${SESSION_COOKIE_NAME}=${token}`,
  };

  return cachedSession;
}

export function sgFutureIso({ minutes = 0, seconds = 0 }: { minutes?: number; seconds?: number }): string {
  return DateTime.now()
    .setZone(SG_ZONE)
    .plus({ minutes, seconds })
    .toFormat("yyyy-LL-dd'T'HH:mm");
}

export function authHeaders(session: TestSession, extra?: Record<string, string>) {
  return {
    Cookie: session.cookieHeader,
    'Content-Type': 'application/json',
    ...(extra ?? {}),
  };
}
