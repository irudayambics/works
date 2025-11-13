import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';
import { tagDB, todoDB, todoTagDB, subtaskDB } from '@/lib/db';
import { nowSg, parseSg, toUtcIso, SG_TZ } from '@/lib/timezone';

const tagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Color must be a hex code'),
});

const subtaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  completed: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
});

const todoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueAt: z.string().optional().nullable(),
  completed: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().optional(),
  reminderMinutes: z.number().nullable().optional(),
  subtasks: z.array(subtaskSchema).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
});

const importSchema = z.object({
  version: z.number().int().min(1),
  todos: z.array(todoSchema).default([]),
  tags: z.array(tagSchema).default([]),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid import payload', parsed.error.issues), {
      status: 400,
    });
  }

  const now = nowSg();
  const timestamp = toUtcIso(now);
  const existingTags = new Map(
    tagDB.list(session.userId).map((tag) => [tag.name.toLowerCase(), tag.id])
  );

  parsed.data.tags.forEach((tag) => {
    if (!existingTags.has(tag.name.toLowerCase())) {
      const created = tagDB.create({
        id: createId(),
        userId: session.userId,
        name: tag.name,
        color: tag.color.toLowerCase(),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      existingTags.set(created.name.toLowerCase(), created.id);
    }
  });

  let importedCount = 0;
  parsed.data.todos.forEach((todo) => {
    const todoId = createId();

    let dueAtIso: string | null = null;
    if (todo.dueAt) {
      const isoCandidate = DateTime.fromISO(todo.dueAt, { setZone: true });
      const normalized = isoCandidate.isValid ? isoCandidate.setZone(SG_TZ) : parseSg(todo.dueAt);
      if (normalized.isValid) {
        dueAtIso = toUtcIso(normalized);
      }
    }

    const isRecurring = todo.isRecurring ?? false;
    const reminderMinutes = dueAtIso ? todo.reminderMinutes ?? null : null;

    todoDB.create({
      id: todoId,
      userId: session.userId,
      title: todo.title,
      description: todo.description?.trim?.() ? todo.description.trim() : null,
      priority: todo.priority,
      dueAt: dueAtIso,
      completed: todo.completed ? 1 : 0,
      isRecurring: isRecurring ? 1 : 0,
      recurrencePattern: isRecurring ? todo.recurrencePattern ?? null : null,
      reminderMinutes,
      lastNotificationSent: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });

    const tagIds = todo.tags
      .map((name) => existingTags.get(name.toLowerCase()))
      .filter((value): value is string => Boolean(value));
    if (tagIds.length > 0) {
      todoTagDB.replace(todoId, tagIds);
    }

    todo.subtasks
      .sort((a, b) => a.position - b.position)
      .forEach((subtask, index) => {
        subtaskDB.create({
          id: createId(),
          todoId,
          title: subtask.title,
          completed: subtask.completed ? 1 : 0,
          position: subtask.position ?? index,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });

    importedCount += 1;
  });

  return NextResponse.json(ok({ imported: importedCount }));
}
