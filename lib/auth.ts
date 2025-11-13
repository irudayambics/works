import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET ?? 'development-secret-change-me'
);

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
const cookieSecure = process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

export async function createSession(userId: string, username: string) {
  const token = await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);

  (await cookies()).set('session', token, {
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
  const token = (await cookies()).get('session')?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload as { userId: string; username: string };
  } catch (error) {
    return null;
  }
}

export async function deleteSession() {
  (await cookies()).delete('session');
}
