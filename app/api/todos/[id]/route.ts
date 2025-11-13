import { NextRequest, NextResponse } from 'next/server';
import { todoDB, Priority, RecurrencePattern } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSingaporeNow } from '@/lib/timezone';

// GET single todo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const todo = todoDB.getById(Number(id), session.userId);

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    return NextResponse.json(todo);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch todo' }, { status: 500 });
  }
}

// PUT update todo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { title, completed, dueDate, priority, isRecurring, recurrencePattern, reminderMinutes } = await request.json();

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }

    // Validate priority if provided
    if (priority !== undefined && !['high', 'medium', 'low'].includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority. Must be high, medium, or low' }, { status: 400 });
    }

    // Validate reminder if provided
    if (reminderMinutes !== undefined && reminderMinutes !== null) {
      if (typeof reminderMinutes !== 'number' || reminderMinutes < 0) {
        return NextResponse.json({ error: 'Invalid reminder minutes. Must be a non-negative number' }, { status: 400 });
      }
    }

    // Validate recurrence if provided
    if (isRecurring !== undefined && isRecurring) {
      if (recurrencePattern && !['daily', 'weekly', 'monthly', 'yearly'].includes(recurrencePattern)) {
        return NextResponse.json({ error: 'Invalid recurrence pattern. Must be daily, weekly, monthly, or yearly' }, { status: 400 });
      }
    }

    // Validate due date format if provided (ISO datetime format)
    if (dueDate !== undefined && dueDate !== null && typeof dueDate === 'string') {
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

    const existing = todoDB.getById(Number(id), session.userId);
    if (!existing) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedCompleted = completed !== undefined ? completed : existing.completed;
    const updatedDueDate = dueDate !== undefined ? dueDate : existing.due_date;
    const updatedPriority = priority !== undefined ? priority : existing.priority;
    const updatedIsRecurring = isRecurring !== undefined ? isRecurring : existing.is_recurring;
    const updatedRecurrencePattern = recurrencePattern !== undefined ? recurrencePattern : existing.recurrence_pattern;
    const updatedReminderMinutes = reminderMinutes !== undefined ? reminderMinutes : existing.reminder_minutes;

    const todo = todoDB.update(
      Number(id),
      session.userId,
      updatedTitle,
      updatedCompleted,
      updatedDueDate,
      updatedPriority as Priority,
      updatedIsRecurring,
      updatedRecurrencePattern as RecurrencePattern,
      updatedReminderMinutes
    );
    return NextResponse.json(todo);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 });
  }
}

// PATCH toggle completion status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    // Get the todo before toggling
    const beforeTodo = todoDB.getById(Number(id), session.userId);
    if (!beforeTodo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Toggle completion
    const todo = todoDB.toggleComplete(Number(id), session.userId);

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // If this todo is being completed and it's recurring, create the next occurrence
    let nextTodo = null;
    if (todo.completed && beforeTodo.is_recurring && beforeTodo.recurrence_pattern && beforeTodo.due_date) {
      nextTodo = todoDB.createNextRecurrence(session.userId, beforeTodo);
    }

    return NextResponse.json({
      todo,
      nextTodo,
      message: nextTodo ? 'Todo completed and next occurrence created' : 'Todo toggled'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to toggle todo' }, { status: 500 });
  }
}

// DELETE todo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const success = todoDB.delete(Number(id), session.userId);

    if (!success) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Todo deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
  }
}
