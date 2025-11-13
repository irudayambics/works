import { SignJWT, jwtVerify } from 'jose';
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

  if (!process.env.TEST_AUTH_BYPASS) {
    throw new Error('TEST_AUTH_BYPASS env not set for tests');
  }

  if (process.env.NODE_ENV !== 'production') {
    // no-op placeholder to avoid lint complaining about console usage in production builds
  }

  // eslint-disable-next-line no-console -- helpful during test bootstrap to confirm db path
  console.log('[tests] using DATA_DB_PATH', process.env.DATA_DB_PATH);

  const timestamp = new Date().toISOString();
  let desiredUserId = process.env.TEST_AUTH_USER_ID ?? createId();
  const username = process.env.TEST_AUTH_USERNAME ?? `playwright-${process.pid}`;
  let user = userDB.getById(desiredUserId) ?? userDB.findByUsername(username);
  if (!user) {
    user = userDB.create({
      id: desiredUserId,
      username,
      displayName: 'Playwright User',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  desiredUserId = user.id;

  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);

  await jwtVerify(token, SECRET);

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra ?? {}),
  };

  if (process.env.TEST_AUTH_BYPASS !== '1' && process.env.TEST_AUTH_BYPASS !== 'true') {
    headers.Cookie = session.cookieHeader;
    headers.cookie = session.cookieHeader;
  }

  return headers;
}
