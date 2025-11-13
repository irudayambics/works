import { Buffer } from 'node:buffer';

import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { z } from 'zod';

import { authenticatorDB, authChallengeDB, userDB } from '@/lib/db';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';
import { createSession } from '@/lib/auth';

const DEFAULT_ORIGIN = process.env.AUTH_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000';
const RP_ID = process.env.AUTH_RP_ID ?? new URL(DEFAULT_ORIGIN).hostname;

const schema = z.object({
  username: z.string().trim().min(3).max(50),
  displayName: z.string().trim().min(1).max(100),
  challenge: z.string().trim().min(1),
  response: z.custom<RegistrationResponseJSON>(),
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
  const displayName = parsed.data.displayName.trim();
  const challengeValue = parsed.data.challenge;
  const challenge = authChallengeDB.consume(challengeValue, 'registration');

  if (!challenge || challenge.username !== username) {
    return NextResponse.json(err('E_CHALLENGE', 'Challenge has expired or is invalid'), {
      status: 400,
    });
  }

  const expectedOrigin = DEFAULT_ORIGIN;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response,
      expectedChallenge: challengeValue,
      expectedOrigin,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (error) {
    return NextResponse.json(err('E_VERIFICATION', 'Could not verify registration'), {
      status: 400,
    });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(err('E_VERIFICATION', 'Registration could not be verified'), {
      status: 400,
    });
  }

  const info = verification.registrationInfo;
  const timestamp = new Date().toISOString();
  const userId = challenge.userId ?? createId();

  let user = userDB.getById(userId);
  if (!user) {
    user = userDB.create({
      id: userId,
      username,
      displayName,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const existingAuthenticators = authenticatorDB.listByUser(user.id);
  const credentialId = Buffer.from(info.credentialID).toString('base64url');

  const existingDevice = existingAuthenticators.find((item) => item.credentialId === credentialId);
  if (existingDevice) {
    authenticatorDB.delete(existingDevice.id);
  }

  authenticatorDB.create({
    id: createId(),
    userId: user.id,
    credentialId,
    publicKey: Buffer.from(info.credentialPublicKey).toString('base64url'),
    counter: info.counter ?? 0,
    transports: parsed.data.response.response.transports ?? [],
    backedUp: info.credentialBackedUp ?? false,
    deviceType: info.credentialDeviceType ?? 'singleDevice',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const token = await createSession(user.id, user.username);

  return NextResponse.json(
    ok({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
      token,
    }),
    { status: 201 }
  );
}
