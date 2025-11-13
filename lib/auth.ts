import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET ?? 'development-secret-change-me'
);

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
const cookieSecure = process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
export const SESSION_COOKIE_NAME = 'session';

export async function createSession(userId: string, username: string) {
  const token = await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);

  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    domain: cookieDomain || undefined,
  });

  return token;
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  return verifySessionToken(token);
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

export async function verifySessionToken(token: string) {
  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload as { userId: string; username: string };
  } catch (error) {
    return null;
  }
}
