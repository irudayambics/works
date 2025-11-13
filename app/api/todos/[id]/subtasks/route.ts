import { NextRequest, NextResponse } from 'next/server';
import { subtaskDB, todoDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET all subtasks for a todo
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

    // Verify the todo belongs to the user
    const todo = todoDB.getById(Number(id), session.userId);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const subtasks = subtaskDB.getByTodoId(Number(id));
    const progress = subtaskDB.getProgress(Number(id));

    return NextResponse.json({ subtasks, progress });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch subtasks' }, { status: 500 });
  }
}

// POST create a new subtask
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

    // Verify the todo belongs to the user
    const todo = todoDB.getById(Number(id), session.userId);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const { title } = await request.json();

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const subtask = subtaskDB.create(Number(id), title.trim());
    const progress = subtaskDB.getProgress(Number(id));

    return NextResponse.json({ subtask, progress }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 });
  }
}
