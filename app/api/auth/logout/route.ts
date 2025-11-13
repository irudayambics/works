import { NextResponse } from 'next/server';

import { deleteSession } from '@/lib/auth';
import { ok } from '@/lib/http';

export async function POST() {
  await deleteSession();
  return NextResponse.json(ok({ success: true }));
}
