import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { tagDB, todoDB, todoTagDB } from '@/lib/db';

const assignSchema = z.object({
  tagIds: z.array(z.string().trim().min(1)).min(1, 'Provide at least one tag id'),
});

const revokeSchema = z.object({
  tagId: z.string().trim().min(1),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id: todoId } = await context.params;
  const todo = todoDB.getById(todoId, session.userId);
  if (!todo) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = assignSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), { status: 400 });
  }

  const invalid = parsed.data.tagIds.filter((tagId) => !tagDB.getById(tagId, session.userId));
  if (invalid.length > 0) {
    return NextResponse.json(err('E_VALIDATION', 'Unknown tag provided'), { status: 400 });
  }

  todoTagDB.replace(todoId, parsed.data.tagIds);
  const updated = todoDB.getById(todoId, session.userId)!;
  return NextResponse.json(ok(updated.tags));
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id: todoId } = await context.params;
  const todo = todoDB.getById(todoId, session.userId);
  if (!todo) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = revokeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), { status: 400 });
  }

  todoTagDB.revoke(todoId, parsed.data.tagId);
  const updated = todoDB.getById(todoId, session.userId)!;
  return NextResponse.json(ok(updated.tags));
}
