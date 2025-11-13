import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  db,
  todoDB,
  todoTagDB,
  tagDB,
  subtaskDB,
  type TodoWithRelations,
  type RecurrencePattern,
} from '@/lib/db';
import { err, ok } from '@/lib/http';
import { getSession } from '@/lib/auth';
import { nowSg, parseSg, toUtcIso, fromUtcIso, SG_TZ } from '@/lib/timezone';
import { createId } from '@/lib/id';

const allowedReminderMinutes = [15, 30, 60, 120, 1440, 2880, 10080] as const;

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.union([z.string().max(2000), z.null()]).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueAt: z.union([z.string().trim().min(1), z.null()]).optional(),
    completed: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
    recurrencePattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
    reminderMinutes: z
      .number()
      .optional()
      .refine((value) => value == null || allowedReminderMinutes.includes(value as any), {
        message: 'Reminder must be one of the allowed values',
      }),
    tags: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

function serialize(todo: TodoWithRelations) {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    dueAt: todo.dueAt,
    completed: todo.completed === 1,
    isRecurring: todo.isRecurring === 1,
    recurrencePattern: todo.recurrencePattern,
    reminderMinutes: todo.reminderMinutes,
    lastNotificationSent: todo.lastNotificationSent,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    tags: todo.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
    subtasks: todo.subtasks.map((subtask) => ({
      id: subtask.id,
      todoId: subtask.todoId,
      title: subtask.title,
      completed: subtask.completed === 1,
      position: subtask.position,
      createdAt: subtask.createdAt,
      updatedAt: subtask.updatedAt,
    })),
  };
}

function computeNextDueDate(currentDue: string, pattern: RecurrencePattern): string {
  const base = fromUtcIso(currentDue).setZone(SG_TZ);
  let next = base;

  switch (pattern) {
    case 'daily':
      next = base.plus({ days: 1 });
      break;
    case 'weekly':
      next = base.plus({ weeks: 1 });
      break;
    case 'monthly':
      next = base.plus({ months: 1 });
      break;
    case 'yearly':
      next = base.plus({ years: 1 });
      break;
  }

  return toUtcIso(next);
}

async function ensureSessionTodo(userId: string, todoId: string) {
  const todo = todoDB.getById(todoId, userId);
  if (!todo) {
    return null;
  }
  return todo;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const todo = await ensureSessionTodo(session.userId, id);

  if (!todo) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  return NextResponse.json(ok(serialize(todo)));
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const existing = await ensureSessionTodo(session.userId, id);

  if (!existing) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const now = nowSg();
  const timestamp = toUtcIso(now);
  const updates: Record<string, unknown> = { updatedAt: timestamp };
  let hasChanges = false;

  if (parsed.data.title !== undefined) {
    updates.title = parsed.data.title;
    hasChanges = hasChanges || parsed.data.title !== existing.title;
  }

  if (parsed.data.description !== undefined) {
    const normalized = parsed.data.description === null
      ? null
      : parsed.data.description.trim().length > 0
        ? parsed.data.description.trim()
        : null;
    updates.description = normalized;
    hasChanges = hasChanges || normalized !== existing.description;
  }

  if (parsed.data.priority !== undefined) {
    updates.priority = parsed.data.priority;
    hasChanges = hasChanges || parsed.data.priority !== existing.priority;
  }

  if (parsed.data.isRecurring !== undefined) {
    updates.isRecurring = parsed.data.isRecurring ? 1 : 0;
    hasChanges = hasChanges || (parsed.data.isRecurring ? 1 : 0) !== existing.isRecurring;
  }

  if (parsed.data.recurrencePattern !== undefined) {
    updates.recurrencePattern = parsed.data.recurrencePattern;
    hasChanges = hasChanges || parsed.data.recurrencePattern !== existing.recurrencePattern;
  }

  if (parsed.data.reminderMinutes !== undefined) {
    if (parsed.data.reminderMinutes && !existing.dueAt && parsed.data.dueAt == null) {
      return NextResponse.json(err('E_VALIDATION', 'Reminders require a due date'), { status: 400 });
    }
    updates.reminderMinutes = parsed.data.reminderMinutes ?? null;
    hasChanges = hasChanges || parsed.data.reminderMinutes !== existing.reminderMinutes;
  }

  if (parsed.data.dueAt !== undefined) {
    if (parsed.data.dueAt === null) {
      updates.dueAt = null;
      if (parsed.data.reminderMinutes === undefined) {
        updates.reminderMinutes = null;
      }
      hasChanges = hasChanges || existing.dueAt !== null;
    } else {
      const parsedDue = parseSg(parsed.data.dueAt);
      if (!parsedDue.isValid) {
        return NextResponse.json(err('E_VALIDATION', 'Invalid due date supplied'), { status: 400 });
      }
      if (parsedDue <= now.plus({ minutes: 1 })) {
        return NextResponse.json(
          err('E_VALIDATION', 'Due date must be at least 1 minute in the future'),
          { status: 400 }
        );
      }
      const dueAtUtc = toUtcIso(parsedDue);
      updates.dueAt = dueAtUtc;
      hasChanges = hasChanges || dueAtUtc !== existing.dueAt;
    }
  }

  if (parsed.data.completed !== undefined) {
    updates.completed = parsed.data.completed ? 1 : 0;
    hasChanges = hasChanges || (parsed.data.completed ? 1 : 0) !== existing.completed;
  }

  if (!hasChanges && !parsed.data.tags) {
    return NextResponse.json(ok(serialize(existing)));
  }

  const updated = todoDB.update(id, session.userId, updates) ?? existing;

  if (parsed.data.tags) {
    const invalidTags = parsed.data.tags.filter((tagId) => !tagDB.getById(tagId, session.userId));
    if (invalidTags.length > 0) {
      return NextResponse.json(err('E_VALIDATION', 'Unknown tag provided'), { status: 400 });
    }
    todoTagDB.replace(id, parsed.data.tags);
  }

  const finalTagIds = (parsed.data.tags ?? todoDB.getById(id, session.userId)?.tags.map((tag) => tag.id)) ?? [];

  // Handle recurring completion
  const wasCompleted = existing.completed === 1;
  const nowCompleted = parsed.data.completed ?? (updated.completed === 1);
  if (!wasCompleted && nowCompleted && updated.isRecurring === 1 && updated.recurrencePattern && updated.dueAt) {
    const nextDue = computeNextDueDate(updated.dueAt, updated.recurrencePattern);
    const nextTodoId = createId();
    const nextTodo = todoDB.create({
      id: nextTodoId,
      userId: session.userId,
      title: updated.title,
      description: updated.description,
      priority: updated.priority,
      dueAt: nextDue,
      completed: 0,
      isRecurring: 1,
      recurrencePattern: updated.recurrencePattern,
      reminderMinutes: updated.reminderMinutes,
      lastNotificationSent: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });

    if (finalTagIds.length > 0) {
      todoTagDB.replace(nextTodoId, finalTagIds);
    }

    const subtasks = subtaskDB.listForTodo(id);
    subtasks.forEach((subtask) => {
      subtaskDB.create({
        id: createId(),
        todoId: nextTodoId,
        title: subtask.title,
        completed: 0,
        position: subtask.position,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  const hydrated = todoDB.getById(id, session.userId)!;
  return NextResponse.json(ok(serialize(hydrated)));
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const deleted = todoDB.softDelete(id, session.userId, toUtcIso(nowSg()));
  if (deleted) {
    return NextResponse.json(ok({ success: true }));
  }

  const row = db
    .prepare<[string, string], { deletedAt: string | null }>(
      'SELECT deletedAt FROM todos WHERE id = ? AND userId = ?'
    )
    .get(id, session.userId);
  if (!row) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  if (row.deletedAt !== null) {
    return NextResponse.json(ok({ success: true }));
  }

  return NextResponse.json(err('E_INTERNAL', 'Could not delete todo'), { status: 500 });
}
