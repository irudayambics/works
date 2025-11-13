import { NextRequest, NextResponse } from 'next/server';
import { holidayDB } from '@/lib/db';

// GET all holidays or filter by date range
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let holidays;

    if (year && month) {
      holidays = holidayDB.getByMonth(Number(year), Number(month));
    } else if (startDate && endDate) {
      holidays = holidayDB.getByDateRange(startDate, endDate);
    } else {
      holidays = holidayDB.getAll();
    }

    return NextResponse.json(holidays);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 });
  }
}

// POST new holiday
export async function POST(request: NextRequest) {
  try {
    const { name, date, description, isRecurring } = await request.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!date || typeof date !== 'string') {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    const holiday = holidayDB.create(
      name.trim(),
      date,
      description?.trim(),
      isRecurring || false
    );

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 });
  }
}
