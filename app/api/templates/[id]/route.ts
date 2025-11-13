import { NextRequest, NextResponse } from 'next/server';
import { templateDB, Priority, RecurrencePattern, SubtaskTemplate } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET single template
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
    const template = templateDB.getById(Number(id), session.userId);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

// PUT update template
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

    // Verify template exists and belongs to user
    const existing = templateDB.getById(Number(id), session.userId);
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const {
      name,
      titleTemplate,
      description,
      category,
      priority,
      dueDateOffsetMinutes,
      reminderMinutes,
      isRecurring,
      recurrencePattern,
      subtasks
    } = await request.json();

    // Validate required fields
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (titleTemplate !== undefined && (typeof titleTemplate !== 'string' || titleTemplate.trim() === '')) {
      return NextResponse.json({ error: 'Title template is required' }, { status: 400 });
    }

    // Validate priority if provided
    if (priority !== undefined && !['high', 'medium', 'low'].includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority. Must be high, medium, or low' }, { status: 400 });
    }

    // Validate recurrence if provided
    if (isRecurring !== undefined && isRecurring) {
      if (recurrencePattern && !['daily', 'weekly', 'monthly', 'yearly'].includes(recurrencePattern)) {
        return NextResponse.json({ error: 'Invalid recurrence pattern. Must be daily, weekly, monthly, or yearly' }, { status: 400 });
      }
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedTitleTemplate = titleTemplate !== undefined ? titleTemplate.trim() : existing.title_template;
    const updatedPriority = priority !== undefined ? priority : existing.priority;
    const updatedDescription = description !== undefined ? description?.trim() : existing.description;
    const updatedCategory = category !== undefined ? category?.trim() : existing.category;
    const updatedDueDateOffsetMinutes = dueDateOffsetMinutes !== undefined ? dueDateOffsetMinutes : existing.due_date_offset_minutes;
    const updatedReminderMinutes = reminderMinutes !== undefined ? reminderMinutes : existing.reminder_minutes;
    const updatedIsRecurring = isRecurring !== undefined ? isRecurring : existing.is_recurring;
    const updatedRecurrencePattern = recurrencePattern !== undefined ? recurrencePattern : existing.recurrence_pattern;
    const updatedSubtasks = subtasks !== undefined ? subtasks : (existing.subtasks_json ? JSON.parse(existing.subtasks_json) : undefined);

    const template = templateDB.update(
      Number(id),
      session.userId,
      updatedName,
      updatedTitleTemplate,
      updatedPriority as Priority,
      updatedDescription,
      updatedCategory,
      updatedDueDateOffsetMinutes,
      updatedReminderMinutes,
      updatedIsRecurring,
      updatedRecurrencePattern as RecurrencePattern,
      updatedSubtasks as SubtaskTemplate[]
    );

    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE template
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
    const success = templateDB.delete(Number(id), session.userId);

    if (!success) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Template deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
