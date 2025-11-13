'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { DateTime } from 'luxon';
import { useRouter, useSearchParams } from 'next/navigation';

import { useSession } from '@/lib/hooks/useSession';
import { formatSingaporeDate, fromUtcIso, nowSg, SG_TZ } from '@/lib/timezone';

import type { ApiHoliday, ApiTag, ApiTodo, CalendarCell, Priority } from './types';
import { generateCalendarCells, getInitialMonth } from './utils';

const priorityChipStyles: Record<Priority, string> = {
  high: 'border-red-500/60 bg-red-500/10 text-red-200',
  medium: 'border-amber-500/60 bg-amber-500/10 text-amber-200',
  low: 'border-slate-500/60 bg-slate-500/10 text-slate-300',
};

function Modal({
  title,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/80" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-600 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="mt-4 max-h-[70vh] overflow-y-auto pr-2 text-sm text-slate-200">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="mt-20 text-center text-slate-400">
          <p>Loading your calendar…</p>
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}

function CalendarContent() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedDate, setSelectedDate] = useState<DateTime | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() =>
    getInitialMonth(searchParams.get('month'))
  );
  const [todos, setTodos] = useState<ApiTodo[]>([]);
  const [holidays, setHolidays] = useState<ApiHoliday[]>([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const monthParam = searchParams.get('month');
    const desired = getInitialMonth(monthParam);
    if (!desired.hasSame(currentMonth, 'month')) {
      setCurrentMonth(desired);
    }
  }, [searchParams, currentMonth]);

  const fetchTodos = useCallback(async () => {
    setIsLoadingTodos(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('includeCompleted', 'true');
      params.set('limit', '300');
      const response = await fetch(`/api/todos?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        setError('Failed to load todos');
        return;
      }
      const json = await response.json();
      if (!json.ok) {
        setError(json.error?.message ?? 'Failed to load todos');
        return;
      }
      setTodos(json.data as ApiTodo[]);
    } finally {
      setIsLoadingTodos(false);
    }
  }, []);

  const fetchHolidays = useCallback(async () => {
    setIsLoadingHolidays(true);
    try {
      const response = await fetch('/api/holidays', { cache: 'no-store' });
      if (!response.ok) return;
      const json = await response.json();
      if (!json.ok) return;
      setHolidays(json.data as ApiHoliday[]);
    } finally {
      setIsLoadingHolidays(false);
    }
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) return;
    fetchTodos();
    fetchHolidays();
  }, [fetchHolidays, fetchTodos, sessionLoading, user]);

  const todosByDate = useMemo(() => {
    const map: Record<string, ApiTodo[]> = {};
    todos.forEach((todo) => {
      if (!todo.dueAt) return;
      const due = fromUtcIso(todo.dueAt).setZone(SG_TZ);
      const key = due.toISODate();
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(todo);
    });
    Object.values(map).forEach((items) => {
      items.sort((a, b) => {
        const aDue = a.dueAt ? fromUtcIso(a.dueAt).toMillis() : Number.POSITIVE_INFINITY;
        const bDue = b.dueAt ? fromUtcIso(b.dueAt).toMillis() : Number.POSITIVE_INFINITY;
        if (aDue !== bDue) return aDue - bDue;
        const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
        return priorityRank[a.priority] - priorityRank[b.priority];
      });
    });
    return map;
  }, [todos]);

  const holidaysByDate = useMemo(() => {
    const map: Record<string, ApiHoliday | undefined> = {};
    holidays.forEach((holiday) => {
      map[holiday.date] = holiday;
    });
    return map;
  }, [holidays]);

  const calendarCells = useMemo(
    () => generateCalendarCells(currentMonth, todosByDate, holidaysByDate),
    [currentMonth, todosByDate, holidaysByDate]
  );

  const selectedIsoDate = selectedDate?.toISODate();
  const selectedTodos = selectedIsoDate ? todosByDate[selectedIsoDate] ?? [] : [];
  const selectedHoliday = selectedIsoDate ? holidaysByDate[selectedIsoDate] : undefined;

  const applyMonth = useCallback(
    (next: DateTime) => {
      setCurrentMonth(next);
      const params = new URLSearchParams(searchParams.toString());
      const nowMonth = nowSg().startOf('month');
      if (next.hasSame(nowMonth, 'month')) {
        params.delete('month');
      } else {
        params.set('month', next.toFormat('yyyy-LL'));
      }
      const query = params.toString();
      router.replace(query ? `/calendar?${query}` : '/calendar', { scroll: false });
    },
    [router, searchParams]
  );

  const changeMonth = useCallback(
    (delta: number) => {
      applyMonth(currentMonth.plus({ months: delta }));
    },
    [applyMonth, currentMonth]
  );

  const goToToday = useCallback(() => {
    const today = nowSg().startOf('day');
    applyMonth(today.startOf('month'));
    setSelectedDate(today);
  }, [applyMonth]);

  if (sessionLoading || !user) {
    return (
      <div className="mt-20 text-center text-slate-400">
        <p>Loading your calendar…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
            >
              Next →
            </button>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Viewing month</p>
            <p className="text-lg font-semibold text-slate-100">
              {formatSingaporeDate(currentMonth, { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-red-200">
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden /> High priority
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden /> Medium priority
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-500/40 bg-slate-500/10 px-3 py-1 text-slate-300">
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden /> Low priority
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-sky-200">
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden /> Singapore holiday
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 shadow-xl">
        <div className="grid grid-cols-7 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
            <div key={label} className="px-2 py-2 text-center">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarCells.map((cell) => {
            const prioritySummary = cell.todos.reduce(
              (acc, todo) => {
                acc[todo.priority] += 1;
                return acc;
              },
              { high: 0, medium: 0, low: 0 } as Record<Priority, number>
            );
            const hasTodos = cell.todos.length > 0;
            return (
              <button
                key={cell.isoDate + (cell.isCurrentMonth ? '-current' : '-other')}
                type="button"
                onClick={() => {
                  setSelectedDate(cell.date.startOf('day'));
                }}
                className={clsx(
                  'flex min-h-[110px] flex-col rounded-xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500',
                  cell.isCurrentMonth
                    ? 'border-slate-800 bg-slate-900/60 text-slate-100 hover:border-sky-500/40'
                    : 'border-slate-900/80 bg-slate-950/60 text-slate-500 hover:border-slate-700/40',
                  cell.isToday && 'border-sky-500/60 bg-sky-500/10',
                  selectedIsoDate === cell.isoDate && 'border-purple-500/60 bg-purple-500/10'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {cell.date.day}
                  </span>
                  {cell.holiday && (
                    <span className="rounded-full border border-sky-500/60 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
                      Holiday
                    </span>
                  )}
                </div>
                {cell.holiday && (
                  <p className="mt-1 text-[11px] text-sky-200">{cell.holiday.name}</p>
                )}
                {hasTodos ? (
                  <div className="mt-2 space-y-1">
                    {(['high', 'medium', 'low'] as Priority[]).map((priority) =>
                      prioritySummary[priority] > 0 ? (
                        <span
                          key={priority}
                          className={clsx(
                            'inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[11px]',
                            priorityChipStyles[priority]
                          )}
                        >
                          <span className="capitalize">{priority}</span>
                          <span className="rounded-full bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-200">
                            {prioritySummary[priority]}
                          </span>
                        </span>
                      ) : null
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-[11px] text-slate-500">No todos</p>
                )}
              </button>
            );
          })}
        </div>
        {(isLoadingTodos || isLoadingHolidays) && (
          <p className="mt-4 text-center text-xs text-slate-500">Refreshing calendar…</p>
        )}
        {error && <p className="mt-4 text-center text-xs text-red-300">{error}</p>}
      </section>

      <Modal
        title={selectedDate ? formatSingaporeDate(selectedDate, { dateStyle: 'full' }) : ''}
        open={selectedDate != null}
        onClose={() => setSelectedDate(null)}
        footer={
          selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
            >
              Close
            </button>
          )
        }
      >
        {selectedDate && (
          <div className="space-y-4">
            {selectedHoliday && (
              <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                <strong>Public holiday:</strong> {selectedHoliday.name}
              </div>
            )}
            {selectedTodos.length === 0 ? (
              <p className="text-sm text-slate-400">No todos scheduled for this day.</p>
            ) : (
              <ul className="space-y-3">
                {selectedTodos.map((todo) => {
                  const dueTimeLabel = todo.dueAt
                    ? formatSingaporeDate(fromUtcIso(todo.dueAt).setZone(SG_TZ), {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'No time set';
                  return (
                    <li
                      key={todo.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{todo.title}</p>
                          <p className="text-xs text-slate-400">{dueTimeLabel}</p>
                        </div>
                        <span className={clsx(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-wide',
                          priorityChipStyles[todo.priority]
                        )}>
                          {todo.priority} priority
                        </span>
                      </div>
                      {todo.description && (
                        <p className="mt-2 text-sm text-slate-300">{todo.description}</p>
                      )}
                      {todo.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-200">
                          {todo.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>{todo.completed ? 'Completed' : 'Pending'}</span>
                        {todo.isRecurring && todo.recurrencePattern && (
                          <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-purple-200">
                            Recurs {todo.recurrencePattern}
                          </span>
                        )}
                        {todo.reminderMinutes != null && (
                          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-200">
                            Reminder {todo.reminderMinutes}m before
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
