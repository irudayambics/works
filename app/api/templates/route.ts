import { NextRequest, NextResponse } from 'next/server';
import { templateDB, Priority, RecurrencePattern, SubtaskTemplate } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET all templates
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const templates = templateDB.getAll(session.userId);
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST create new template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!titleTemplate || typeof titleTemplate !== 'string' || titleTemplate.trim() === '') {
      return NextResponse.json({ error: 'Title template is required' }, { status: 400 });
    }

    // Validate priority if provided
    if (priority && !['high', 'medium', 'low'].includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority. Must be high, medium, or low' }, { status: 400 });
    }

    // Validate recurrence if provided
    if (isRecurring) {
      if (!recurrencePattern || !['daily', 'weekly', 'monthly', 'yearly'].includes(recurrencePattern)) {
        return NextResponse.json({ error: 'Invalid recurrence pattern. Must be daily, weekly, monthly, or yearly' }, { status: 400 });
      }
    }

    // Validate subtasks if provided
    if (subtasks && !Array.isArray(subtasks)) {
      return NextResponse.json({ error: 'Subtasks must be an array' }, { status: 400 });
    }

    const template = templateDB.create(
      session.userId,
      name.trim(),
      titleTemplate.trim(),
      priority as Priority || 'medium',
      description?.trim(),
      category?.trim(),
      dueDateOffsetMinutes,
      reminderMinutes,
      isRecurring || false,
      recurrencePattern as RecurrencePattern,
      subtasks as SubtaskTemplate[]
    );

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
