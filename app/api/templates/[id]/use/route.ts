import { NextRequest, NextResponse } from 'next/server';
import { templateDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST create todo from template
export async function POST(
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
    const template = templateDB.getById(Number(id), session.userId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create todo from template
    const todo = templateDB.createTodoFromTemplate(session.userId, template);

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error('Failed to create todo from template:', error);
    return NextResponse.json({ error: 'Failed to create todo from template' }, { status: 500 });
  }
}
