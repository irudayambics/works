import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';

import { generateCalendarCells, getInitialMonth } from '@/app/calendar/utils';
import type { ApiHoliday, ApiTodo } from '@/app/calendar/types';

const SG_ZONE = 'Asia/Singapore';

test('getInitialMonth falls back to current month on invalid input', () => {
  const fallback = getInitialMonth(null);
  assert.equal(fallback.startOf('month').toISODate(), fallback.toISODate());

  const parsed = getInitialMonth('2025-05');
  assert.equal(parsed.year, 2025);
  assert.equal(parsed.month, 5);
  assert.equal(parsed.day, 1);
});

test('generateCalendarCells produces six rows and maps todos/holidays', () => {
  const month = DateTime.fromISO('2025-05-01', { zone: SG_ZONE });
  const todosByDate: Record<string, ApiTodo[]> = {
    '2025-05-15': [
      {
        id: 'todo-1',
        title: 'Monthly check-in',
        description: null,
        priority: 'high',
        dueAt: '2025-05-15T04:00:00.000Z',
        completed: false,
        reminderMinutes: null,
        isRecurring: false,
        recurrencePattern: null,
        tags: [],
      },
    ],
  };

  const holidaysByDate: Record<string, ApiHoliday | undefined> = {
    '2025-05-01': {
      id: 1,
      date: '2025-05-01',
      name: 'Labour Day',
    },
  };

  const cells = generateCalendarCells(month, todosByDate, holidaysByDate);
  assert.equal(cells.length, 42);
  assert.equal(cells[0].date.weekday, 1);

  const todoCell = cells.find((cell) => cell.isoDate === '2025-05-15');
  assert.ok(todoCell);
  assert.equal(todoCell!.todos.length, 1);
  assert.equal(todoCell!.todos[0].title, 'Monthly check-in');

  const holidayCell = cells.find((cell) => cell.isoDate === '2025-05-01');
  assert.ok(holidayCell?.holiday);
  assert.equal(holidayCell!.holiday!.name, 'Labour Day');
});
