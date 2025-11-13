import { NextRequest, NextResponse } from 'next/server';
import { tagDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET single tag
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
    const tag = tagDB.getById(Number(id), session.userId);

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json(tag);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tag' }, { status: 500 });
  }
}

// PUT update tag
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
    const existing = tagDB.getById(Number(id), session.userId);

    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const { name, color } = await request.json();

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedColor = color !== undefined ? color : existing.color;

    // Check if new name conflicts with another tag
    if (updatedName !== existing.name) {
      const conflict = tagDB.getByName(updatedName, session.userId);
      if (conflict && conflict.id !== Number(id)) {
        return NextResponse.json({ error: 'Tag name already exists' }, { status: 400 });
      }
    }

    const tag = tagDB.update(Number(id), session.userId, updatedName, updatedColor);
    return NextResponse.json(tag);
  } catch (error) {
    console.error('Failed to update tag:', error);
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
  }
}

// DELETE tag
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
    const success = tagDB.delete(Number(id), session.userId);

    if (!success) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Tag deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}
