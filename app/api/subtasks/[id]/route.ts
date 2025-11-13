import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { subtaskDB, todoDB } from '@/lib/db';
import { nowSg, toUtcIso } from '@/lib/timezone';

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    completed: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

async function ensureOwnership(subtaskId: string, userId: string) {
  const record = subtaskDB.getById(subtaskId);
  if (!record) return null;
  const todo = todoDB.getById(record.todoId, userId);
  if (!todo) return null;
  return record;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const existing = await ensureOwnership(id, session.userId);
  if (!existing) {
    return NextResponse.json(err('E_NOT_FOUND', 'Subtask not found'), { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const updates: Record<string, unknown> = { updatedAt: toUtcIso(nowSg()) };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
  if (parsed.data.completed !== undefined) updates.completed = parsed.data.completed ? 1 : 0;
  if (parsed.data.position !== undefined) updates.position = parsed.data.position;

  const updated = subtaskDB.update(id, updates) ?? existing;

  return NextResponse.json(ok(updated));
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const existing = await ensureOwnership(id, session.userId);
  if (!existing) {
    return NextResponse.json(err('E_NOT_FOUND', 'Subtask not found'), { status: 404 });
  }

  subtaskDB.delete(id);
  return NextResponse.json(ok({ success: true }));
}
