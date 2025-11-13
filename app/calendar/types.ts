import type { DateTime } from 'luxon';

export type Priority = 'high' | 'medium' | 'low';

export type ApiTag = {
  id: string;
  name: string;
  color: string;
};

export type ApiTodo = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueAt: string | null;
  completed: boolean;
  reminderMinutes: number | null;
  isRecurring: boolean;
  recurrencePattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  tags: ApiTag[];
};

export type ApiHoliday = {
  id: number;
  date: string;
  name: string;
};

export type CalendarCell = {
  date: DateTime;
  isoDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  todos: ApiTodo[];
  holiday?: ApiHoliday;
};
