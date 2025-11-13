import { NextRequest, NextResponse } from 'next/server';
import { subtaskDB, todoDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Helper to verify subtask access
async function verifySubtaskAccess(subtaskId: number, userId: number) {
  const subtask = subtaskDB.getById(subtaskId);
  if (!subtask) {
    return null;
  }

  // Verify the parent todo belongs to the user
  const todo = todoDB.getById(subtask.todo_id, userId);
  if (!todo) {
    return null;
  }

  return subtask;
}

// PUT update subtask
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
    const subtask = await verifySubtaskAccess(Number(id), session.userId);

    if (!subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    const { title, completed } = await request.json();

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }

    const updatedTitle = title !== undefined ? title.trim() : subtask.title;
    const updatedCompleted = completed !== undefined ? completed : subtask.completed;

    const updatedSubtask = subtaskDB.update(Number(id), updatedTitle, updatedCompleted);
    const progress = subtaskDB.getProgress(subtask.todo_id);

    return NextResponse.json({ subtask: updatedSubtask, progress });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update subtask' }, { status: 500 });
  }
}

// PATCH toggle subtask completion
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
    const subtask = await verifySubtaskAccess(Number(id), session.userId);

    if (!subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    const updatedSubtask = subtaskDB.toggleComplete(Number(id));
    const progress = subtaskDB.getProgress(subtask.todo_id);

    return NextResponse.json({ subtask: updatedSubtask, progress });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to toggle subtask' }, { status: 500 });
  }
}

// DELETE subtask
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
    const subtask = await verifySubtaskAccess(Number(id), session.userId);

    if (!subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    const todoId = subtask.todo_id;
    const success = subtaskDB.delete(Number(id));

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete subtask' }, { status: 404 });
    }

    const progress = subtaskDB.getProgress(todoId);

    return NextResponse.json({ message: 'Subtask deleted', progress });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete subtask' }, { status: 500 });
  }
}
