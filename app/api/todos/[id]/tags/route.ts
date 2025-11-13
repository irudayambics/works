import { NextRequest, NextResponse } from 'next/server';
import { todoDB, tagDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET tags for a todo
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

    // Verify todo belongs to user
    const todo = todoDB.getById(Number(id), session.userId);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const tags = tagDB.getTagsForTodo(Number(id));
    return NextResponse.json(tags);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

// PUT set tags for a todo
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

    // Verify todo belongs to user
    const todo = todoDB.getById(Number(id), session.userId);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const { tagIds } = await request.json();

    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 });
    }

    // Verify all tags belong to user
    for (const tagId of tagIds) {
      const tag = tagDB.getById(tagId, session.userId);
      if (!tag) {
        return NextResponse.json({ error: `Tag ${tagId} not found` }, { status: 404 });
      }
    }

    tagDB.setTagsForTodo(Number(id), tagIds);
    const tags = tagDB.getTagsForTodo(Number(id));

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Failed to set tags:', error);
    return NextResponse.json({ error: 'Failed to set tags' }, { status: 500 });
  }
}
