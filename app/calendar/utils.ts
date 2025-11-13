import { DateTime } from 'luxon';

import { nowSg, SG_TZ } from '@/lib/timezone';

import type { ApiHoliday, ApiTodo, CalendarCell } from './types';

export function getInitialMonth(monthParam: string | null): DateTime {
  const now = nowSg();
  if (!monthParam) return now.startOf('month');
  const parsed = DateTime.fromFormat(monthParam, 'yyyy-LL', { zone: SG_TZ });
  if (!parsed.isValid) return now.startOf('month');
  return parsed.startOf('month');
}

export function generateCalendarCells(
  month: DateTime,
  todosByDate: Record<string, ApiTodo[]>,
  holidaysByDate: Record<string, ApiHoliday | undefined>
): CalendarCell[] {
  const startOfMonth = month.startOf('month');
  const daysToSubtract = startOfMonth.weekday - 1;
  const gridStart = startOfMonth.minus({ days: daysToSubtract });
  const totalCells = 42;
  const gridEnd = gridStart.plus({ days: totalCells - 1 });
  const today = nowSg().startOf('day');

  const cells: CalendarCell[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = cursor.plus({ days: 1 })) {
    const isoDate = cursor.toISODate() ?? '';
    cells.push({
      date: cursor,
      isoDate,
      isCurrentMonth: cursor.month === month.month,
      isToday: cursor.hasSame(today, 'day'),
      todos: todosByDate[isoDate] ?? [],
      holiday: holidaysByDate[isoDate],
    });
  }
  return cells;
}
