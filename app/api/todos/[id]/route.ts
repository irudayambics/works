import { NextRequest, NextResponse } from 'next/server';

import { db, todoDB } from '@/lib/db';
import type { Priority, TodoRecord } from '@/lib/db';
import { err, ok } from '@/lib/http';
import { nowSg, parseSg, toUtcIso } from '@/lib/timezone';
import { todoSchemas, validate } from '@/lib/validate';

function serialize(record: TodoRecord) {
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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const record = todoDB.getById(id);

  if (!record) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  return NextResponse.json(ok(serialize(record)));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const existing = todoDB.getById(id);

  if (!existing) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const validation = validate(todoSchemas.update, body);

  if (!validation.ok) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', validation.errors), {
      status: 400,
    });
  }

  const payload = validation.data;
  const now = nowSg();
  const updates: Partial<Omit<TodoRecord, 'id' | 'createdAt'>> & { updatedAt: string } = {
    updatedAt: toUtcIso(now),
  };

  let hasChanges = false;

  if (payload.title !== undefined) {
    const rawTitle = payload.title;
    if (typeof rawTitle !== 'string') {
      return NextResponse.json(err('E_VALIDATION', 'Title is required'), { status: 400 });
    }
    const title = rawTitle.trim();
    if (title.length === 0) {
      return NextResponse.json(err('E_VALIDATION', 'Title is required'), { status: 400 });
    }
    if (title !== existing.title) {
      updates.title = title;
      hasChanges = true;
    }
  }

  if (payload.description !== undefined) {
    if (payload.description !== null && typeof payload.description !== 'string') {
      return NextResponse.json(err('E_VALIDATION', 'Invalid description'), { status: 400 });
    }
    const description = payload.description === null ? null : payload.description.trim();
    const normalized = description && description.length > 0 ? description : null;
    if (normalized !== existing.description) {
      updates.description = normalized;
      hasChanges = true;
    }
  }

  if (payload.priority !== undefined) {
    const priority = payload.priority as Priority;
    if (priority !== existing.priority) {
      updates.priority = priority;
      hasChanges = true;
    }
  }

  if (payload.dueAt !== undefined) {
    if (payload.dueAt === null) {
      if (existing.dueAt !== null) {
        updates.dueAt = null;
        hasChanges = true;
      }
    } else {
      if (typeof payload.dueAt !== 'string') {
        return NextResponse.json(err('E_VALIDATION', 'Invalid due date supplied'), { status: 400 });
      }
      const parsed = parseSg(payload.dueAt);
      if (!parsed.isValid) {
        return NextResponse.json(err('E_VALIDATION', 'Invalid due date supplied'), { status: 400 });
      }
      if (parsed <= now.plus({ minutes: 1 })) {
        return NextResponse.json(
          err('E_VALIDATION', 'Due date must be at least 1 minute in the future'),
          { status: 400 }
        );
      }
      const dueAtUtc = toUtcIso(parsed);
      if (dueAtUtc !== existing.dueAt) {
        updates.dueAt = dueAtUtc;
        hasChanges = true;
      }
    }
  }

  if (payload.completed !== undefined) {
    const completed = payload.completed ? 1 : 0;
    if (completed !== existing.completed) {
      updates.completed = completed as 0 | 1;
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return NextResponse.json(ok(serialize(existing)));
  }

  const updated = todoDB.update(id, updates);
  if (!updated) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  return NextResponse.json(ok(serialize(updated)));
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const now = toUtcIso(nowSg());

  const deleted = todoDB.softDelete(id, now);
  if (deleted) {
    return NextResponse.json(ok({ success: true }));
  }

  const row = db
    .prepare<[string], { deletedAt: string | null }>('SELECT deletedAt FROM todos WHERE id = ?')
    .get(id);
  if (!row) {
    return NextResponse.json(err('E_NOT_FOUND', 'Todo not found'), { status: 404 });
  }

  if (row.deletedAt !== null) {
    return NextResponse.json(ok({ success: true }));
  }

  return NextResponse.json(err('E_INTERNAL', 'Could not delete todo'), { status: 500 });
}
