import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';
import { tagDB } from '@/lib/db';
import { nowSg, toUtcIso } from '@/lib/timezone';

const colorRegex = /^#([0-9a-fA-F]{6})$/;

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  color: z
    .string()
    .trim()
    .regex(colorRegex, 'Color must be a hex code (e.g. #34d399)'),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const tags = tagDB.list(session.userId);
  return NextResponse.json(ok(tags));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const existing = tagDB
    .list(session.userId)
    .find((tag) => tag.name.toLowerCase() === parsed.data.name.toLowerCase());
  if (existing) {
    return NextResponse.json(err('E_CONFLICT', 'Tag name already in use'), { status: 409 });
  }

  const timestamp = toUtcIso(nowSg());
  const tag = tagDB.create({
    id: createId(),
    userId: session.userId,
    name: parsed.data.name.trim(),
    color: parsed.data.color.toLowerCase(),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return NextResponse.json(ok(tag), { status: 201 });
}
