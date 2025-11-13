import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { tagDB } from '@/lib/db';
import { nowSg, toUtcIso } from '@/lib/timezone';

const colorRegex = /^#([0-9a-fA-F]{6})$/;

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    color: z
      .string()
      .trim()
      .regex(colorRegex, 'Color must be a hex code (e.g. #34d399)')
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const existing = tagDB.getById(id, session.userId);
  if (!existing) {
    return NextResponse.json(err('E_NOT_FOUND', 'Tag not found'), { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  if (parsed.data.name) {
    const duplicate = tagDB
      .list(session.userId)
      .find((tag) => tag.name.toLowerCase() === parsed.data.name?.toLowerCase() && tag.id !== id);
    if (duplicate) {
      return NextResponse.json(err('E_CONFLICT', 'Tag name already in use'), { status: 409 });
    }
  }

  const updated = tagDB.update(id, session.userId, {
    ...parsed.data,
    updatedAt: toUtcIso(nowSg()),
  });

  return NextResponse.json(ok(updated ?? existing));
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const existing = tagDB.getById(id, session.userId);
  if (!existing) {
    return NextResponse.json(err('E_NOT_FOUND', 'Tag not found'), { status: 404 });
  }

  tagDB.delete(id, session.userId);
  return NextResponse.json(ok({ success: true }));
}
