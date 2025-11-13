import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { templateDB, tagDB } from '@/lib/db';
import { nowSg, toUtcIso } from '@/lib/timezone';

const colorlessPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().optional(),
  reminderMinutes: z.number().nullable().optional(),
  dueOffsetMinutes: z.number().int().nullable().optional(),
  subtasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        position: z.number().int().min(0).default(0),
      })
    )
    .optional(),
  tagIds: z.array(z.string().trim().min(1)).optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    category: z.string().max(100).nullable().optional(),
    payload: colorlessPayloadSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

function parsePayload(raw: string) {
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const existing = templateDB.getById(id, session.userId);
  if (!existing) {
    return NextResponse.json(err('E_NOT_FOUND', 'Template not found'), { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  let mergedPayload = existing.payload ? parsePayload(existing.payload) : {};
  if (parsed.data.payload) {
    if (parsed.data.payload.tagIds) {
      const invalid = parsed.data.payload.tagIds.filter((tagId) => !tagDB.getById(tagId, session.userId));
      if (invalid.length > 0) {
        return NextResponse.json(err('E_VALIDATION', 'Unknown tag provided'), { status: 400 });
      }
    }
    mergedPayload = {
      ...mergedPayload,
      ...parsed.data.payload,
    };
  }

  const updated = templateDB.update(id, session.userId, {
    name: parsed.data.name ?? undefined,
    description: parsed.data.description ?? undefined,
    category: parsed.data.category ?? undefined,
    payload: parsed.data.payload ? JSON.stringify(mergedPayload) : undefined,
    updatedAt: toUtcIso(nowSg()),
  });

  const hydrated = templateDB.getById(id, session.userId)!;
  return NextResponse.json(
    ok({
      ...hydrated,
      description: hydrated.description ?? null,
      category: hydrated.category ?? null,
      payload: JSON.parse(hydrated.payload),
    })
  );
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const { id } = await context.params;
  const existing = templateDB.getById(id, session.userId);
  if (!existing) {
    return NextResponse.json(err('E_NOT_FOUND', 'Template not found'), { status: 404 });
  }

  templateDB.delete(id, session.userId);
  return NextResponse.json(ok({ success: true }));
}
