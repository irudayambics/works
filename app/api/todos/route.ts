import { Buffer } from 'node:buffer';

import { NextRequest, NextResponse } from 'next/server';

import { idempotencyDB, todoDB } from '@/lib/db';
import type { TodoRecord } from '@/lib/db';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';
import { nowSg, parseSg, toUtcIso } from '@/lib/timezone';
import { todoSchemas, validate } from '@/lib/validate';

type CursorPayload = {
  offset: number;
  includeCompleted: boolean;
  priority?: 'low' | 'medium' | 'high';
};

function serializeTodo(record: TodoRecord | undefined | null) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    priority: record.priority,
    dueAt: record.dueAt,
    completed: record.completed === 1,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
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
    return parsed;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = Object.fromEntries(searchParams.entries());
  const validation = validate(todoSchemas.listQuery, query);

  if (!validation.ok) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid query parameters', validation.errors), {
      status: 400,
    });
  }

  const { cursor, limit, includeCompleted, priority } = validation.data;
  const resolvedLimit = limit ?? 50;
  const includeCompletedBool = includeCompleted === 'true';

  let offset = 0;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      return NextResponse.json(err('E_VALIDATION', 'Invalid cursor value'), { status: 400 });
    }

    if (
      decoded.includeCompleted !== includeCompletedBool ||
      decoded.priority !== (priority ?? decoded.priority ?? undefined)
    ) {
      return NextResponse.json(err('E_VALIDATION', 'Cursor does not match current filters'), {
        status: 400,
      });
    }

    offset = decoded.offset;
  }

  const rows = todoDB.list({
    includeCompleted: includeCompletedBool,
    priority: priority as 'low' | 'medium' | 'high' | undefined,
    limit: resolvedLimit + 1,
    offset,
  });

  const hasMore = rows.length > resolvedLimit;
  const data = rows
    .slice(0, resolvedLimit)
    .map((record: TodoRecord) => serializeTodo(record)!)
    .filter(Boolean);

  const meta = hasMore
    ? {
        cursor: encodeCursor({
          offset: offset + resolvedLimit,
          includeCompleted: includeCompletedBool,
          priority: priority as 'low' | 'medium' | 'high' | undefined,
        }),
      }
    : undefined;

  return NextResponse.json(ok(data, meta));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const validation = validate(todoSchemas.create, body);
  if (!validation.ok) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', validation.errors), {
      status: 400,
    });
  }

  const payload = validation.data;
  const idempotencyKey = request.headers.get('Idempotency-Key');

  if (idempotencyKey) {
    const cached = idempotencyDB.find(idempotencyKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { status: number; body: unknown };
      return NextResponse.json(parsed.body, { status: parsed.status });
    }
  }

  const now = nowSg();
  let dueAtUtc: string | null = null;

  if (payload.dueAt) {
    const date = parseSg(payload.dueAt);
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

  const id = createId();
  const timestamp = toUtcIso(now);

  const record = todoDB.create({
    id,
    title: payload.title.trim(),
    description: payload.description && payload.description.length > 0 ? payload.description : null,
    priority: payload.priority,
    dueAt: dueAtUtc,
    completed: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  });

  const response = ok(serializeTodo(record)!);

  if (idempotencyKey) {
    idempotencyDB.save(idempotencyKey, { status: 201, body: response }, timestamp);
  }

  return NextResponse.json(response, { status: 201 });
}
