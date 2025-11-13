import { NextResponse } from 'next/server';
import { todoDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET todos that need notifications
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const todos = todoDB.getTodosNeedingNotification(session.userId);
    return NextResponse.json({ todos });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST mark notification as sent
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { todoId } = await request.json();

    if (!todoId || typeof todoId !== 'number') {
      return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 });
    }

    // Verify the todo belongs to the user
    const todo = todoDB.getById(todoId, session.userId);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    todoDB.updateNotificationSent(todoId, session.userId);
    return NextResponse.json({ message: 'Notification marked as sent' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to mark notification as sent' }, { status: 500 });
  }
}
