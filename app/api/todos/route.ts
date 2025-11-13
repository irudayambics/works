import { NextRequest, NextResponse } from 'next/server';
import { todoDB, tagDB, Priority, RecurrencePattern } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSingaporeNow } from '@/lib/timezone';

// GET all todos
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const todos = todoDB.getAll(session.userId);

    // Add tags to each todo
    const todosWithTags = todos.map(todo => ({
      ...todo,
      tags: tagDB.getTagsForTodo(todo.id)
    }));

    return NextResponse.json(todosWithTags);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

// POST new todo
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { title, dueDate, priority, isRecurring, recurrencePattern, reminderMinutes } = await request.json();

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Validate priority if provided
    if (priority && !['high', 'medium', 'low'].includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority. Must be high, medium, or low' }, { status: 400 });
    }

    // Validate reminder if provided
    if (reminderMinutes !== undefined && reminderMinutes !== null) {
      if (!dueDate) {
        return NextResponse.json({ error: 'Due date is required when setting a reminder' }, { status: 400 });
      }
      if (typeof reminderMinutes !== 'number' || reminderMinutes < 0) {
        return NextResponse.json({ error: 'Invalid reminder minutes. Must be a non-negative number' }, { status: 400 });
      }
    }

    // Validate recurrence if provided
    if (isRecurring) {
      if (!dueDate) {
        return NextResponse.json({ error: 'Due date is required for recurring todos' }, { status: 400 });
      }
      if (!recurrencePattern || !['daily', 'weekly', 'monthly', 'yearly'].includes(recurrencePattern)) {
        return NextResponse.json({ error: 'Invalid recurrence pattern. Must be daily, weekly, monthly, or yearly' }, { status: 400 });
      }
    }

    // Validate due date format if provided (ISO datetime format)
    if (dueDate && typeof dueDate === 'string') {
      const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      if (!dateTimeRegex.test(dueDate)) {
        return NextResponse.json({ error: 'Invalid datetime format. Use YYYY-MM-DDTHH:mm' }, { status: 400 });
      }

      // Check if date is in the past (using Singapore timezone)
      const dueDateObj = new Date(dueDate);
      const nowSG = getSingaporeNow();

      if (dueDateObj <= nowSG) {
        return NextResponse.json({ error: 'Due date must be in the future (Singapore time)' }, { status: 400 });
      }
    }

    const todo = todoDB.create(
      session.userId,
      title.trim(),
      dueDate,
      priority as Priority,
      isRecurring || false,
      recurrencePattern as RecurrencePattern,
      reminderMinutes
    );
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
