import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { err, ok } from '@/lib/http';
import { todoDB } from '@/lib/db';
import { toUtcIso, nowSg } from '@/lib/timezone';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(err('E_UNAUTHENTICATED', 'Not authenticated'), { status: 401 });
  }

  const todos = todoDB.list({
    userId: session.userId,
    includeCompleted: true,
    limit: 1000,
    offset: 0,
  });

  const tagCatalog = new Map<string, string>();
  const payloadTodos = todos.map((todo) => {
    todo.tags.forEach((tag) => {
      if (!tagCatalog.has(tag.name)) {
        tagCatalog.set(tag.name, tag.color);
      }
    });

    return {
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      dueAt: todo.dueAt,
      completed: todo.completed === 1,
      isRecurring: todo.isRecurring === 1,
      recurrencePattern: todo.recurrencePattern,
      reminderMinutes: todo.reminderMinutes,
      subtasks: todo.subtasks.map((subtask) => ({
        title: subtask.title,
        completed: subtask.completed === 1,
        position: subtask.position,
      })),
      tags: todo.tags.map((tag) => tag.name),
    };
  });

  const tagCatalogArray = Array.from(tagCatalog.entries()).map(([name, color]) => ({ name, color }));

  return NextResponse.json(
    ok({
      version: 1,
      exportedAt: toUtcIso(nowSg()),
      tags: tagCatalogArray,
      todos: payloadTodos,
    })
  );
}
