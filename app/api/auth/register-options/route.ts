import { Buffer } from 'node:buffer';

import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { z } from 'zod';

import { authChallengeDB, authenticatorDB, userDB } from '@/lib/db';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';

const DEFAULT_ORIGIN = process.env.AUTH_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000';
const RP_ID = process.env.AUTH_RP_ID ?? new URL(DEFAULT_ORIGIN).hostname;
const RP_NAME = process.env.AUTH_RP_NAME ?? 'Todo App';

const schema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(50),
  displayName: z.string().trim().min(1, 'Display name is required').max(100),
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
  const existingUser = userDB.findByUsername(username);
  const userId = existingUser?.id ?? createId();

  const excludeCredentials = existingUser
    ? authenticatorDB.listByUser(existingUser.id).map((authenticator) => ({
        id: authenticator.credentialId,
      }))
    : [];

  const options = await generateRegistrationOptions({
    rpID: RP_ID,
    rpName: RP_NAME,
    userName: username,
    userDisplayName: existingUser?.displayName ?? displayName,
    userID: Buffer.from(userId, 'utf8'),
    attestationType: 'none',
    excludeCredentials,
  });

  const challengeId = createId();
  const timestamp = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 5).toISOString();

  authChallengeDB.create({
    id: challengeId,
    userId: existingUser?.id ?? userId,
    username,
    challenge: options.challenge,
    type: 'registration',
    createdAt: timestamp,
    expiresAt,
  });

  return NextResponse.json(ok(options));
}
