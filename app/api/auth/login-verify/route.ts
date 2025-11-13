import { Buffer } from 'node:buffer';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { z } from 'zod';

import { authenticatorDB, authChallengeDB, userDB } from '@/lib/db';
import { err, ok } from '@/lib/http';
import { createSession } from '@/lib/auth';

const DEFAULT_ORIGIN = process.env.AUTH_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000';
const RP_ID = process.env.AUTH_RP_ID ?? new URL(DEFAULT_ORIGIN).hostname;

const schema = z.object({
  username: z.string().trim().min(3).max(50),
  challenge: z.string().trim().min(1),
  response: z.custom<AuthenticationResponseJSON>(),
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

  const challenge = authChallengeDB.consume(parsed.data.challenge, 'authentication');
  if (!challenge || challenge.userId !== user.id) {
    return NextResponse.json(err('E_CHALLENGE', 'Challenge has expired or is invalid'), {
      status: 400,
    });
  }

  const credentialId = parsed.data.response.rawId;
  const authenticator = authenticatorDB.getByCredentialId(credentialId);

  if (!authenticator) {
    return NextResponse.json(err('E_NOT_FOUND', 'Authenticator not registered'), { status: 404 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: parsed.data.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: DEFAULT_ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: authenticator.credentialId,
        credentialPublicKey: Buffer.from(authenticator.publicKey, 'base64url'),
        counter: authenticator.counter ?? 0,
        transports: authenticator.transports as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: true,
    });
  } catch (error) {
    return NextResponse.json(err('E_VERIFICATION', 'Authentication failed'), { status: 400 });
  }

  if (!verification.verified || !verification.authenticationInfo) {
    return NextResponse.json(err('E_VERIFICATION', 'Authentication could not be verified'), {
      status: 400,
    });
  }

  authenticatorDB.updateCounter(authenticator.credentialId, verification.authenticationInfo.newCounter ?? authenticator.counter ?? 0);

  const token = await createSession(user.id, user.username);

  return NextResponse.json(
    ok({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
      token,
    })
  );
}
