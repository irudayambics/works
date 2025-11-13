import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';
import { templateDB, tagDB, todoDB, todoTagDB, subtaskDB } from '@/lib/db';
import { nowSg, toUtcIso } from '@/lib/timezone';

const schema = z.object({
  titleOverride: z.string().trim().min(1).max(200).optional(),
  descriptionOverride: z.string().max(2000).optional(),
  dueOffsetMinutes: z.number().int().nullable().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const template = templateDB.getById(id, session.userId);
  if (!template) {
    return NextResponse.json(err('E_NOT_FOUND', 'Template not found'), { status: 404 });
  }

  const payload = JSON.parse(template.payload) as {
    title: string;
    description?: string | null;
    priority: 'low' | 'medium' | 'high';
    isRecurring?: boolean;
    recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
    reminderMinutes?: number | null;
    dueOffsetMinutes?: number | null;
    subtasks?: Array<{ title: string; position?: number }>;
    tagIds?: string[];
  };

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const dueOffset = parsed.data.dueOffsetMinutes ?? payload.dueOffsetMinutes ?? null;
  const now = nowSg();
  let dueAtUtc: string | null = null;
  if (dueOffset != null) {
    const dueAt = now.plus({ minutes: dueOffset });
    dueAtUtc = toUtcIso(dueAt);
  }

  const timestamp = toUtcIso(now);
  const todoId = createId();

  const todo = todoDB.create({
    id: todoId,
    userId: session.userId,
    title: parsed.data.titleOverride ?? payload.title,
    description:
      parsed.data.descriptionOverride?.trim() ?? payload.description ?? null,
    priority: payload.priority,
    dueAt: dueAtUtc,
    completed: 0,
    isRecurring: payload.isRecurring ? 1 : 0,
    recurrencePattern: payload.recurrencePattern ?? null,
    reminderMinutes: payload.reminderMinutes ?? null,
    lastNotificationSent: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });

  const tagIds = payload.tagIds ?? [];
  const missing = tagIds.filter((tagId) => !tagDB.getById(tagId, session.userId));
  if (missing.length > 0) {
    return NextResponse.json(err('E_VALIDATION', 'One or more tags no longer exist'), { status: 400 });
  }
  if (tagIds.length > 0) {
    todoTagDB.replace(todoId, tagIds);
  }

  const subtasks = (payload.subtasks ?? []).map((subtask, index) => ({
    ...subtask,
    position: subtask.position ?? index,
  }));

  subtasks
    .sort((a, b) => a.position - b.position)
    .forEach((subtask) => {
      subtaskDB.create({
        id: createId(),
        todoId,
        title: subtask.title,
        completed: 0,
        position: subtask.position,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

  const hydrated = todoDB.getById(todoId, session.userId)!;
  return NextResponse.json(ok(hydrated), { status: 201 });
}
