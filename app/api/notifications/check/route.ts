import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { todoDB } from '@/lib/db';
import { fromUtcIso, nowSg, toUtcIso, SG_TZ } from '@/lib/timezone';

const markSchema = z.object({
  todoId: z.string().trim().min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const now = nowSg();
  const todos = todoDB.listDueForReminder(session.userId, now);
  const payload = todos.map((todo) => {
    const dueAt = todo.dueAt ? fromUtcIso(todo.dueAt).setZone(SG_TZ) : null;
    const reminderMinutes = todo.reminderMinutes ?? 0;
    const reminderAt = dueAt ? dueAt.minus({ minutes: reminderMinutes }) : null;

    return {
      id: todo.id,
      title: todo.title,
      dueAt: todo.dueAt,
      reminderMinutes: todo.reminderMinutes,
      remindAt: reminderAt ? toUtcIso(reminderAt) : null,
    };
  });

  return NextResponse.json(ok({ todos: payload }));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = markSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const todo = todoDB.getById(parsed.data.todoId, session.userId);
  if (!todo) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  todoDB.markNotified(todo.id, toUtcIso(nowSg()));
  return NextResponse.json(ok({ success: true }));
}
