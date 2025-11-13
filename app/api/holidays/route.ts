import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { holidayDB } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const holidays = holidayDB.list();
  return NextResponse.json(ok(holidays));
}
