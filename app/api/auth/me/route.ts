import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  return NextResponse.json(ok({ userId: session.userId, username: session.username }));
}
