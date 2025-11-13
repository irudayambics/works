import { NextResponse } from 'next/server';

import { todoDB } from '@/lib/db';
import { ok } from '@/lib/http';

export async function GET() {
  const summary = todoDB.summary();
  return NextResponse.json(ok(summary));
}
