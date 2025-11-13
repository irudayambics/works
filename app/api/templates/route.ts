import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { createId } from '@/lib/id';
import { templateDB, tagDB } from '@/lib/db';
import { nowSg, toUtcIso } from '@/lib/timezone';

const payloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']),
  isRecurring: z.boolean().default(false),
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
    .default([]),
  tagIds: z.array(z.string().trim().min(1)).default([]),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  payload: payloadSchema,
});

function parseTemplate(template: ReturnType<typeof templateDB.list>[number]) {
  const payload = JSON.parse(template.payload) as z.infer<typeof payloadSchema>;
  return {
    ...template,
    description: template.description ?? null,
    category: template.category ?? null,
    payload,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const templates = templateDB.list(session.userId).map(parseTemplate);
  return NextResponse.json(ok(templates));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(err('E_VALIDATION', 'Invalid request body', parsed.error.issues), {
      status: 400,
    });
  }

  const tags = parsed.data.payload.tagIds;
  const invalidTags = tags.filter((tagId) => !tagDB.getById(tagId, session.userId));
  if (invalidTags.length > 0) {
    return NextResponse.json(err('E_VALIDATION', 'Unknown tag provided'), { status: 400 });
  }

  const timestamp = toUtcIso(nowSg());
  const template = templateDB.create({
    id: createId(),
    userId: session.userId,
    name: parsed.data.name.trim(),
    description: parsed.data.description?.trim() ?? null,
    category: parsed.data.category?.trim() ?? null,
    payload: JSON.stringify({
      ...parsed.data.payload,
      description: parsed.data.payload.description?.trim() ?? null,
    }),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return NextResponse.json(ok(parseTemplate(template)), { status: 201 });
}
