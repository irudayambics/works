import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';
import { subtaskDB, todoDB } from '@/lib/db';
import { toUtcIso, nowSg } from '@/lib/timezone';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  position: z.number().int().min(0).optional(),
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
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const existingSubtasks = subtaskDB.listForTodo(todoId);
  const nextPosition = parsed.data.position ?? (existingSubtasks.at(-1)?.position ?? existingSubtasks.length);
  const timestamp = toUtcIso(nowSg());

  const subtask = subtaskDB.create({
    id: createId(),
    todoId,
    title: parsed.data.title,
    completed: 0,
    position: nextPosition,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return NextResponse.json(ok(subtask), { status: 201 });
}
