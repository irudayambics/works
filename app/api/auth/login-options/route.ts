import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { z } from 'zod';

import { authenticatorDB, authChallengeDB, userDB } from '@/lib/db';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';

const DEFAULT_ORIGIN = process.env.AUTH_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000';
const RP_ID = process.env.AUTH_RP_ID ?? new URL(DEFAULT_ORIGIN).hostname;

const schema = z.object({
  username: z.string().trim().min(3).max(50),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const username = parsed.data.username.toLowerCase();
  const user = userDB.findByUsername(username);

  if (!user) {
    return NextResponse.json(err('E_NOT_FOUND', 'User not found'), { status: 404 });
  }

  const authenticators = authenticatorDB.listByUser(user.id);

  if (authenticators.length === 0) {
    return NextResponse.json(err('E_NOT_FOUND', 'No authenticators registered for this user'), {
      status: 404,
    });
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: authenticators.map((authenticator) => ({
      id: authenticator.credentialId,
      transports: authenticator.transports as AuthenticatorTransportFuture[] | undefined,
    })),
  });

  const timestamp = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 5).toISOString();

  authChallengeDB.create({
    id: createId(),
    userId: user.id,
    username: user.username,
    challenge: options.challenge,
    type: 'authentication',
    createdAt: timestamp,
    expiresAt,
  });

  return NextResponse.json(ok(options));
}
