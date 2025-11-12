> **Project Context — Todo App**
> We are building a feature-complete, Singapore-timezone-first task manager in Next.js 16.
> Each PRP defines one feature’s behavior and **references `00-core-prp.md`** for cross-cutting rules (API envelope, error codes, DB defaults, auth, testing).
> Goal: fast capture, predictable reminders/due-dates in SG time, clean UI, and testable behavior.

# PRP: Calendar View

## Feature Overview
Deliver a monthly calendar view that visualizes todos by due date, layers Singapore public holidays, and allows seamless month navigation. This feature depends on 01: Todo CRUD (for source data) and 02: Priority System (for color cues) and ships in Phase 4 (Productivity). All API, timezone, and validation rules reference `00-core-prp.md`.

## User Stories & User Flow

### User Stories
- I want to see my todos on a calendar so I can plan around busy days.
- I want public holidays highlighted so I can adjust due dates around SG events.
- I want to navigate months quickly and jump back to today so I stay oriented.
- I want to click a day to view or edit todos without leaving the calendar.
- I want filters (priority, completion, tags) to reflect on the calendar so the view matches my current focus.

### User Flow

#### View Current Month
1. UI loads calendar grid for current SG month with skeleton state.
2. System fetches `GET /api/calendar?month=YYYY-MM` with current filters.
3. API returns aggregated todos per day plus holidays.
4. UI renders calendar grid, marking today, holidays, and due counts.

#### Navigate Months
1. User clicks previous/next buttons or selects from month picker.
2. UI updates query params (`?month=YYYY-MM`) and triggers refetch.
3. System recalculates start/end range in SG time and responds with updated data.
4. UI animates month transition and maintains filter chips.

#### Inspect Day Details
1. User clicks a day cell.
2. UI opens side panel or popover listing todos for that day.
3. System optionally lazy-loads detailed list via `GET /api/calendar/day?date=YYYY-MM-DD` if not cached.
4. UI allows inline status toggle or quick edit (leveraging existing todo endpoints).

#### Highlight Holidays
1. System merges SG public holidays from cache/table with calendar range.
2. UI visually distinguishes holiday cells and shows tooltip with holiday name.
3. User can toggle holiday overlay if desired.

## Technical Requirements

### Database Schema
Default columns adhere to `00-core-prp.md` (UUID PK, UTC timestamps, soft delete). Introduce a cache table for Singapore holidays (pre-seeded yearly) and optional materialized day summaries.

```sql
CREATE TABLE IF NOT EXISTS singaporeHolidays (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  holidayDate TEXT NOT NULL, -- UTC ISO midnight (00:00:00Z)
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date_active
  ON singaporeHolidays(holidayDate)
  WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS calendarDaySummaries (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  summaryDate TEXT NOT NULL, -- UTC ISO day start
  meta TEXT NOT NULL, -- JSON with counts per priority, completed, overdue flags
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_calendar_summary_user_date
  ON calendarDaySummaries(userId, summaryDate)
  WHERE deletedAt IS NULL;
```

### API Endpoints
Routes live under `app/api/calendar` and must use `ok`/`err` from the core PRP.

#### `GET /api/calendar`
**Fetch Month Grid Data**
- Query params:
  ```typescript
  type CalendarQuery = {
    month?: string; // format YYYY-MM, default nowSg()
    includeCompleted?: 'true' | 'false'; // default true
    priority?: 'low' | 'medium' | 'high';
    tags?: string; // comma-separated tag IDs
  };
  ```
- Output:
  ```typescript
  ok<{
    range: { start: string; end: string }; // UTC ISO day boundaries
    days: CalendarDay[];
    holidays: Array<{ date: string; name: string }>;
  }>;
  ```
- Behavior: calculates month grid (6 weeks) in SG time, aggregates todos per day, merges with `singaporeHolidays`.
- Sample errors: `err('E_VALIDATION', 'Month must be YYYY-MM')`, `err('E_RATE_LIMIT', 'Too many calendar requests')`.

#### `GET /api/calendar/day`
**Fetch Detailed Todos for a Day**
- Query params: `{ date: string (YYYY-MM-DD), includeCompleted?: 'true' | 'false' }`.
- Output: `ok<{ date: string; todos: TodoCalendarItem[] }>`.
- Behavior: returns todos whose `dueAt` falls within SG day boundaries, excluding soft-deleted.
- Errors: `err('E_VALIDATION', 'Date must be YYYY-MM-DD')`, `err('E_NOT_FOUND', 'No todos found for date')` (optional, else return empty array).

#### `POST /api/calendar/refresh`
**Recompute Day Summaries** (optional background trigger)
- Input body: `{ month?: string }`.
- Output: `ok<{ refreshed: number }>` once summaries regenerated.
- Should be rate-limited and secured (requires auth session per core conventions).

##### Example Next.js route handler (`app/api/calendar/route.ts` excerpt)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ok, err } from '@/lib/http';
import { nowSg, toUtcIso, startOfDaySg, endOfDaySg } from '@/lib/timezone';
import { fetchCalendarDays } from '@/lib/calendar/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = validateMonthQuery(searchParams);
    if (!parsed.ok) {
      return NextResponse.json(err('E_VALIDATION', parsed.error), { status: 400 });
    }
    const data = fetchCalendarDays(parsed.value); // synchronous better-sqlite3 queries
    return NextResponse.json(ok(data));
  } catch (error) {
    console.error('calendar.month', { error });
    return NextResponse.json(err('E_INTERNAL', 'Unable to load calendar'), { status: 500 });
  }
}
```

### Types & Interfaces
```typescript
interface CalendarDay {
  date: string; // UTC ISO start of day
  label: number; // day number (1-31)
  isCurrentMonth: boolean;
  isToday: boolean;
  todos: Array<{
    id: string;
    title: string;
    priority: 'low' | 'medium' | 'high';
    completed: boolean;
  }>;
  counts: {
    total: number;
    high: number;
    medium: number;
    low: number;
    completed: number;
    overdue: number;
  };
}

interface TodoCalendarItem {
  id: string;
  title: string;
  description: string | null;
  dueAt: string; // UTC ISO
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  tags: Array<{ id: string; name: string; color: string }>;
}
```

### Validation Rules
**month**
- Optional; must match `/^\d{4}-(0[1-9]|1[0-2])$/`.
- If invalid, respond `E_VALIDATION` with message “Month must be in YYYY-MM format”.

**date** (day endpoint)
- Required; must be a valid calendar date.
- Convert via `parseSg` and ensure resulting DateTime is valid; otherwise `E_VALIDATION` (“Date must be YYYY-MM-DD”).

**includeCompleted**
- Optional; accepted strings `'true'|'false'`. Any other value returns `E_VALIDATION` (“includeCompleted must be true or false”).

**priority**
- Optional single value; must match enum per Priority System or return `E_VALIDATION`.

**tags**
- Optional CSV; ensure each ID exists for user. Unknown tag IDs yield `E_NOT_FOUND` with message “Tag not found”.

### Timezone Logic
- Use `nowSg()` to determine default month and highlight today.
- Derive month boundaries with `toSg` and `.startOf('month')`/`.endOf('month')`, then convert to UTC via `toUtcIso` for querying.
- Day aggregations rely on `startOfDaySg`/`endOfDaySg` wrappers before converting to UTC to fetch from SQLite.
- Public holidays stored as UTC midnight; convert to SG using `toSg(holidayDate)` for display.

### Performance Constraints & Pagination
- `GET /api/calendar` must complete ≤150 ms for 2k todos; leverage indexes on `dueAt` and filtered queries.
- Summaries should reuse cached `calendarDaySummaries` when available, refreshing no more than once every 15 minutes per user.
- Day detail endpoint limited to 200 todos; enforce `LIMIT 200` and return warning in `meta` if truncated.
- Rate limit month endpoint to 40 requests per minute per user (`E_RATE_LIMIT`).

## UI Components
- **CalendarShell** (`<CalendarShell initialMonth filters onFiltersChange>`): orchestrates data fetching, skeleton, and layout.
- **MonthNavigator** (`<MonthNavigator month onChange onToday>`): includes previous/next arrows, month dropdown, “Today” button.
- **CalendarGrid** (`<CalendarGrid days onDaySelect holidays>`): renders 7x6 grid with Tailwind utilities; highlights today with `border-emerald-500`.
- **DayCell** (`<DayCell day isHoliday onSelect>`): supports priority dot indicators using tokens `bg-red-500`, `bg-amber-500`, `bg-slate-500`.
- **DayDetailPanel** (`<DayDetailPanel date todos onClose onTodoToggle>`): slide-over listing todos with status toggle.
- **HolidayLegend** (`<HolidayLegend holidays>`): lists SG holidays for the visible month.

### Empty / Loading / Error States
- Loading: calendar grid shows shimmering placeholders and disabled navigation.
- Empty (no todos in month): display “No scheduled todos this month” message within grid.
- Empty day detail: placeholder text with CTA to create todo (links to existing create flow).
- Error: Inline `Alert` banner at top with API error message and retry button; last successful data cached for display.

### Optimistic Update Behavior
- Toggling completion inside DayDetailPanel optimistically updates day counts and UI, then syncs via todo PATCH endpoint; rollback on failure.
- Month navigation updates header immediately while underlying data fetch occurs; skeleton overlay ensures layout stability.

### React Component Snippet (month navigator)
```tsx
import { useRouter, useSearchParams } from 'next/navigation';

export function MonthNavigator({ month }: { month: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function navigate(delta: number) {
    const current = new Date(`${month}-01T00:00:00Z`);
    current.setUTCMonth(current.getUTCMonth() + delta);
    const nextMonth = current.toISOString().slice(0, 7);
    const search = new URLSearchParams(params);
    search.set('month', nextMonth);
    router.push(`?${search.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button className="rounded-md border px-2 py-1" onClick={() => navigate(-1)}>Prev</button>
      <span className="text-sm font-semibold">{month}</span>
      <button className="rounded-md border px-2 py-1" onClick={() => navigate(1)}>Next</button>
      <button className="rounded-md border px-2 py-1" onClick={() => navigate(0)}>Today</button>
    </div>
  );
}
```

## Edge Cases
- Selected month with zero todos and zero holidays: grid still renders; counts show 0 without errors.
- Todos spanning midnight SG (dueAt near 00:30 SG) appear on correct day via timezone conversion.
- Holidays falling on weekend: still highlighted; tooltip clarifies observance rules if stored in metadata.
- Day detail exceeding 200 todos: API returns truncated list with `meta.warning`, UI shows “Showing first 200 todos”.
- Navigation beyond supported range (e.g., before data retention window): API responds `E_VALIDATION` (“Month out of supported range (2019-2030)”).
- Tag filter referencing deleted tag: month endpoint returns `E_NOT_FOUND`; UI removes tag filter chip.

## Acceptance Criteria
- [ ] Month view loads with current SG month and correctly highlights today.
- [ ] Public holidays appear with distinct styling and tooltip text from `singaporeHolidays`.
- [ ] Todos display in day cells with priority-colored markers and accurate counts.
- [ ] Month navigation updates URL, fetches new data, and renders within 300 ms perceived time.
- [ ] Day detail panel lists todos with completion toggle; optimistic updates reconcile with API responses.
- [ ] Filters (priority, includeCompleted, tags) apply consistently across grid and day detail endpoints.
- [ ] API responses conform to `ok/err` envelope and use appropriate `E_*` codes for validation and rate-limit errors.

## Testing Requirements

### Playwright E2E Scenarios
`tests/10-calendar-view.spec.ts`
- [ ] `should render current month with today highlighted`
- [ ] `should navigate to next month and fetch new data`
- [ ] `should display Singapore holiday badge on National Day`
- [ ] `should filter calendar by high priority`
- [ ] `should toggle todo completion from day detail`
- [ ] `should show empty state when month has no todos`
- [ ] `should respect due today filter under SG timezone boundaries`

**Example test snippet**
```ts
test('should display Singapore holiday badge on National Day', async ({ page }) => {
  await page.goto('/calendar?month=2025-08');
  const dayCell = page.getByRole('button', { name: /9\s+Sat/ });
  await expect(dayCell).toHaveAttribute('data-holiday', 'National Day');
  await dayCell.hover();
  await expect(page.getByText('National Day')).toBeVisible();
});
```

### Unit Tests
- `lib/calendar/service.test.ts`: SG timezone month calculation, day aggregation, holiday merge.
- `lib/calendar/validate.test.ts`: month/date parameter validation, filter parsing.
- `app/api/calendar/route.test.ts`: ensures `ok/err` responses and rate limit behavior.
- `components/CalendarGrid.test.tsx`: renders correct number of cells, highlights today, handles empty states.
- `components/DayDetailPanel.test.tsx`: optimistic toggle behavior and error rollback.

### Fixtures & Mocks Guidance
- Seed SQLite test DB with todos spanning multiple priorities, tags, and due dates across SG month boundaries.
- Provide fixture data for SG public holidays (JSON import into `singaporeHolidays`).
- Mock timezone helpers (`nowSg`) to a fixed date during tests for determinism.
- Use network interception in Playwright to stub calendar API responses for edge-case testing (e.g., no todos, rate limit).

## Out of Scope
- Weekly or agenda views (only monthly grid in this PRP).
- Drag-and-drop rescheduling (handled by future enhancements).
- External calendar sync (Google, Outlook).
- Recurring todo visualization beyond due date markers (no series arcs yet).

## Success Metrics
- ≥60% of active weekly users open the calendar view within first month of release.
- Calendar API p95 latency ≤150 ms, p99 ≤250 ms.
- Error rate (`E_INTERNAL`, `E_VALIDATION`, `E_RATE_LIMIT`) <1% of calendar requests.
- ≥40% of calendar sessions interact with at least one day detail panel, indicating engagement.
