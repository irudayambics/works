import { Buffer } from 'node:buffer';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  idempotencyDB,
  todoDB,
  todoTagDB,
  tagDB,
  subtaskDB,
  type TodoWithRelations,
} from '@/lib/db';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';
import { getSession } from '@/lib/auth';
import { nowSg, parseSg, toUtcIso } from '@/lib/timezone';

type CursorPayload = {
  offset: number;
  includeCompleted: boolean;
  priority?: 'low' | 'medium' | 'high';
  search?: string;
  tagIds?: string[];
};

const allowedReminderMinutes = [15, 30, 60, 120, 1440, 2880, 10080] as const;

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isInteger(value) && value >= 1 && value <= 100, {
      message: 'Limit must be between 1 and 100',
    })
    .optional(),
  includeCompleted: z.enum(['true', 'false']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  search: z.string().trim().min(1).optional(),
  tags: z.string().trim().min(1).optional(),
});

const subtaskInputSchema = z.object({
  title: z.string().trim().min(1, 'Subtask title is required').max(200),
  position: z.number().int().min(0).max(9999).default(0),
});

const todoCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z
    .string()
    .max(2000, 'Description is too long')
    .transform((value) => value.trim())
    .optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueAt: z.string().trim().min(1).optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  reminderMinutes: z
    .number()
    .optional()
    .refine((value) => value == null || allowedReminderMinutes.includes(value as any), {
      message: 'Reminder must be one of the allowed values',
    }),
  tags: z.array(z.string().trim().min(1)).optional(),
  subtasks: z.array(subtaskInputSchema).optional(),
});

const todoUpdateSchema = todoCreateSchema
  .partial()
  .extend({
    completed: z.boolean().optional(),
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

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(value: string): CursorPayload | null {
  try {
    const raw = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as CursorPayload;
    if (typeof parsed.offset !== 'number' || Number.isNaN(parsed.offset)) {
      return null;
    }
    if (typeof parsed.includeCompleted !== 'boolean') {
      return null;
    }
    if (parsed.priority && !['low', 'medium', 'high'].includes(parsed.priority)) {
      return null;
    }
    if (parsed.tagIds && !Array.isArray(parsed.tagIds)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listQuerySchema.safeParse(query);

  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid query parameters', parsed.error.issues), {
      status: 400,
    });
  }

  const { cursor, limit, includeCompleted, priority, search, tags } = parsed.data;
  const includeCompletedBool = includeCompleted === 'true';
  const tagIds = tags ? tags.split(',').filter(Boolean) : [];
  let offset = 0;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      return NextResponse.json(err('E_VALIDATION', 'Invalid cursor value'), { status: 400 });
    }

    const mismatch =
      decoded.includeCompleted !== includeCompletedBool ||
      decoded.priority !== (priority ?? decoded.priority ?? undefined) ||
      (search ?? '') !== (decoded.search ?? '') ||
      JSON.stringify(tagIds) !== JSON.stringify(decoded.tagIds ?? []);

    if (mismatch) {
      return NextResponse.json(err('E_VALIDATION', 'Cursor does not match current filters'), {
        status: 400,
      });
    }

    offset = decoded.offset;
  }

  const size = limit ?? 20;
  const todos = todoDB.list({
    userId: session.userId,
    includeCompleted: includeCompletedBool,
    priority: priority as any,
    search: search ?? undefined,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    limit: size + 1,
    offset,
  });

  const hasMore = todos.length > size;
  const data = todos.slice(0, size).map(serialize);

  const meta = hasMore
    ? {
        cursor: encodeCursor({
          offset: offset + size,
          includeCompleted: includeCompletedBool,
          priority: priority as any,
          search: search ?? undefined,
          tagIds: tagIds.length > 0 ? tagIds : undefined,
        }),
      }
    : undefined;

  return NextResponse.json(ok(data, meta));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = todoCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    const cached = idempotencyDB.find(idempotencyKey);
    if (cached) {
      const parsedCache = JSON.parse(cached) as { status: number; body: unknown };
      return NextResponse.json(parsedCache.body, { status: parsedCache.status });
    }
  }

  const now = nowSg();
  let dueAtUtc: string | null = null;

  if (parsed.data.dueAt) {
    const date = parseSg(parsed.data.dueAt);
    if (!date.isValid) {
      return NextResponse.json(err('E_VALIDATION', 'Invalid due date supplied'), { status: 400 });
    }
    if (date <= now.plus({ minutes: 1 })) {
      return NextResponse.json(
        err('E_VALIDATION', 'Due date must be at least 1 minute in the future'),
        { status: 400 }
      );
    }
    dueAtUtc = toUtcIso(date);
  }

  if (parsed.data.isRecurring && (!parsed.data.recurrencePattern || !dueAtUtc)) {
    return NextResponse.json(
      err('E_VALIDATION', 'Recurring todos require a due date and recurrence pattern'),
      { status: 400 }
    );
  }

  if (parsed.data.reminderMinutes && !dueAtUtc) {
    return NextResponse.json(err('E_VALIDATION', 'Reminders require a due date'), {
      status: 400,
    });
  }

  const timestamp = toUtcIso(now);
  const todoId = createId();

  const todo = todoDB.create({
    id: todoId,
    userId: session.userId,
    title: parsed.data.title.trim(),
    description:
      parsed.data.description && parsed.data.description.length > 0
        ? parsed.data.description
        : null,
    priority: parsed.data.priority,
    dueAt: dueAtUtc,
    completed: 0,
    isRecurring: parsed.data.isRecurring ? 1 : 0,
    recurrencePattern: parsed.data.recurrencePattern ?? null,
    reminderMinutes: parsed.data.reminderMinutes ?? null,
    lastNotificationSent: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });

  const tagIds = parsed.data.tags ?? [];
  if (tagIds.length > 0) {
    const missing = tagIds.filter((tagId) => !tagDB.getById(tagId, session.userId));
    if (missing.length > 0) {
      return NextResponse.json(err('E_VALIDATION', 'Unknown tag provided'), { status: 400 });
    }
    todoTagDB.replace(todoId, tagIds);
  }

  const subtasks = parsed.data.subtasks ?? [];
  if (subtasks.length > 0) {
    const stmt = subtaskDB.create;
    subtasks
      .sort((a, b) => a.position - b.position)
      .forEach((item, index) => {
        stmt({
          id: createId(),
          todoId,
          title: item.title.trim(),
          completed: 0,
          position: item.position ?? index,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });
  }

  const hydrated = todoDB.getById(todoId, session.userId)!;
  const response = ok(serialize(hydrated));

  if (idempotencyKey) {
    idempotencyDB.save(idempotencyKey, { status: 201, body: response }, timestamp);
  }

  return NextResponse.json(response, { status: 201 });
}
