import { NextRequest, NextResponse } from 'next/server';
import { holidayDB } from '@/lib/db';

// GET single holiday
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const holiday = holidayDB.getById(Number(id));

    if (!holiday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }

    return NextResponse.json(holiday);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch holiday' }, { status: 500 });
  }
}

// PUT update holiday
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, date, description, isRecurring } = await request.json();

    const existing = holidayDB.getById(Number(id));
    if (!existing) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    if (date !== undefined && typeof date !== 'string') {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    // Validate date format if provided
    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
      }
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedDate = date !== undefined ? date : existing.date;
    const updatedDescription = description !== undefined ? description?.trim() : existing.description;
    const updatedIsRecurring = isRecurring !== undefined ? isRecurring : existing.is_recurring;

    const holiday = holidayDB.update(
      Number(id),
      updatedName,
      updatedDate,
      updatedDescription,
      updatedIsRecurring
    );

    return NextResponse.json(holiday);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update holiday' }, { status: 500 });
  }
}

// DELETE holiday
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = holidayDB.delete(Number(id));

    if (!success) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Holiday deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 });
  }
}
