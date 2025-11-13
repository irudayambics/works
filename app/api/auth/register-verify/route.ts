import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { userDB, authenticatorDB } from '@/lib/db';
import { createSession } from '@/lib/auth';

const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';

export async function POST(request: NextRequest) {
  try {
    const body: RegistrationResponseJSON = await request.json();

    const challenge = request.cookies.get('reg-challenge')?.value;
    const username = request.cookies.get('reg-username')?.value;

    if (!challenge || !username) {
      return NextResponse.json({ error: 'Registration session expired' }, { status: 400 });
    }

    // Get origin from request
    const origin = request.headers.get('origin') || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    const registrationInfo = verification.registrationInfo;

    // Extract credential information from the new API structure
    const finalCredentialID = registrationInfo.credential?.id;
    const finalCredentialPublicKey = registrationInfo.credential?.publicKey;
    const counter = registrationInfo.credential?.counter ?? 0;
    const credentialDeviceType = registrationInfo.credentialDeviceType;
    const credentialBackedUp = registrationInfo.credentialBackedUp ?? false;

    if (!finalCredentialID || !finalCredentialPublicKey) {
      return NextResponse.json({ error: 'Invalid credential data' }, { status: 400 });
    }

    // Create user
    const user = userDB.create(username);

    // Store authenticator - pass transports array directly, not stringified
    authenticatorDB.create(
      user.id,
      Buffer.from(finalCredentialID).toString('base64'),
      Buffer.from(finalCredentialPublicKey).toString('base64'),
      counter,
      credentialDeviceType,
      credentialBackedUp,
      body.response.transports
    );

    // Create session
    await createSession(user.id, user.username);

    // Clear registration cookies
    const response = NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
    response.cookies.delete('reg-challenge');
    response.cookies.delete('reg-username');

    return response;
  } catch (error) {
    console.error('Registration verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
