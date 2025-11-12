# PRP: Recurring Todos

## Feature Overview
Add recurrence capabilities to todos so users can schedule tasks on daily, weekly, monthly, or yearly cadences. The system must automatically create upcoming instances, calculate due dates using Singapore timezone helpers, and ensure each occurrence inherits relevant metadata from the recurrence template while remaining editable as an individual todo. All standards in `00-core-prp.md` continue to apply.

## User Stories

### As a user
- I want to convert a todo into a recurring series so repeating work shows up automatically.
- I want to specify how often a todo repeats (daily, weekly, monthly, yearly) with flexible intervals so schedules fit my routine.
- I want new occurrences to copy details like title, description, priority, and tags so I do not re-enter information.
- I want to mark a recurring occurrence as complete without affecting future instances so tracking stays accurate.
- I want to skip or end recurrence instances when plans change.

## User Flow

### Create Recurrence
1. UI shows "Make recurring" action on a todo detail view.
2. User selects frequency, interval, anchor date/time, and optional end conditions.
3. System validates inputs, creates recurrence rule, and generates the next occurrence if needed.
4. UI displays recurrence badge and schedule summary on the todo.

### Complete Occurrence
1. UI shows checkbox or complete action for upcoming occurrence.
2. User marks occurrence as completed.
3. System updates occurrence todo, triggers recurrence engine to schedule the next instance, and returns updated data.
4. UI reflects completion, optionally hides past occurrence, and shows new future todo.

### Skip Occurrence
1. UI offers "Skip this occurrence" in the recurrence actions menu.
2. User confirms skip.
3. System marks occurrence as skipped, logs audit metadata, and schedules the next occurrence using same rule.
4. UI removes skipped occurrence from active list and shows toast confirmation.

### End Recurrence
1. UI exposes "End recurrence" option.
2. User chooses to end immediately or after a specific date/occurrence.
3. System updates recurrence rule with `endAt` or sets `deletedAt`, preventing new occurrences.
4. UI updates recurrence badge and indicates series ended while keeping historical occurrences intact.

## Technical Requirements

### Database Schema
```sql
ALTER TABLE todos
  ADD COLUMN recurrenceRuleId TEXT,
  ADD COLUMN recurrenceSequence INTEGER;

CREATE TABLE IF NOT EXISTS todoRecurrenceRules (
  id TEXT PRIMARY KEY,
  rootTodoId TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  interval INTEGER NOT NULL DEFAULT 1,
  weeklyWeekdays TEXT, -- JSON array of ISO weekday numbers (1=Monday)
  monthlyStrategy TEXT NOT NULL DEFAULT 'same-day' CHECK (monthlyStrategy IN ('same-day','last-day','roll-forward')),
  startAt TEXT NOT NULL,
  endAt TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Singapore',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recurrence_root_active
  ON todoRecurrenceRules(rootTodoId)
  WHERE deletedAt IS NULL;

CREATE INDEX IF NOT EXISTS idx_todos_recurrence
  ON todos(recurrenceRuleId, recurrenceSequence)
  WHERE deletedAt IS NULL;
```
- `rootTodoId` references the original template todo (the first occurrence).
- `recurrenceSequence` increments starting at 0 for the template; future occurrences use 1, 2, …
- `weeklyWeekdays` stores JSON array; only used for weekly frequency.
- `monthlyStrategy` handles months with fewer days: `same-day` keeps anchor date when possible, `last-day` snaps to month end, `roll-forward` moves to next valid business day (Weekday Monday-Friday).
- `startAt` stores the anchor due date/time in UTC ISO; `endAt` optional for series termination.

### API Endpoints
Reuse todo base endpoints and introduce recurrence-focused handlers. All responses must follow the core API envelope and error codes.

#### `POST /api/todos/:id/recurrence`
**Attach Recurrence to Existing Todo**
- Input:
  ```typescript
  {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;               // default 1
    weeklyWeekdays?: number[];       // required when frequency === 'weekly'
    monthlyStrategy?: 'same-day' | 'last-day' | 'roll-forward';
    startAt?: string;                // optional override; defaults to todo.dueAt
    endAt?: string | null;           // optional UTC ISO for last occurrence generation
  }
  ```
- Behavior:
  - Validates todo exists and is not already bound to an active recurrence rule.
  - Creates rule, updates root todo with `recurrenceRuleId` and `recurrenceSequence = 0`.
  - Generates and inserts the next occurrence via helper (unless `endAt` reached).
- Validation:
  - `interval` integer ≥1.
  - Weekly frequency requires 1-7 unique weekday values (1-7).
  - `startAt` must resolve to future SG time; fallback to existing due date or `nowSg().startOf('day')`.
  - `endAt`, if provided, must be after `startAt`.
  - Returns `E_CONFLICT` if recurrence already exists.

#### `GET /api/recurrences/:id`
**Fetch Recurrence Rule**
- Output: Recurrence rule details plus next scheduled occurrence preview.
- Include computed `nextOccurrenceAt` as UTC ISO based on rule and last occurrence state.
- `E_NOT_FOUND` for missing or deleted rule.

#### `PATCH /api/recurrences/:id`
**Update Recurrence Rule**
- Input: Partial fields (`interval`, `weeklyWeekdays`, `monthlyStrategy`, `endAt`). Frequency changes allowed with caution.
- Behavior: Applies updates, recalculates future schedule, potentially regenerates next occurrence.
- Validation: Ensure changes do not create past-due schedule; adjust upcoming occurrences accordingly.

#### `POST /api/recurrences/:id/skip`
**Skip Current Occurrence**
- Input: `{ occurrenceId: string }` referencing todo occurrence to skip.
- Marks occurrence with `deletedAt` (soft delete) and logs `skip` metadata (optional future table).
- Immediately generate next occurrence; response returns new upcoming occurrence.

#### `POST /api/recurrences/:id/end`
**End Recurrence**
- Input: `{ endAt?: string | null }` (null → end immediately).
- Updates rule `endAt` or sets `deletedAt` to stop future generation.
- Returns rule summary and remaining active occurrences.

### Recurrence Engine Logic
- Implement `lib/recurrence.ts` (new helper module) with pure functions:
  - `computeNextOccurrence(rule, lastOccurrenceDueAt)` returning DateTime in SG zone.
  - `projectOccurrences(rule, count)` for previews (used by UI).
  - `applyMonthlyStrategy(date, strategy)` to adjust invalid dates.
- Engine triggered during:
  - Creation of recurrence rule (seed at least one future occurrence if within `endAt`).
  - Completion, skip, or deletion of an occurrence.
  - Scheduled daily background job (CRON or serverless scheduled trigger) to catch missed generations; log errors with `traceId`.

### Validation Rules
**frequency**
- Required enum; error message "Frequency must be daily, weekly, monthly, or yearly".

**interval**
- Optional integer ≥1 (default 1).
- For yearly frequency, limit to ≤5 to avoid excessive scheduling; else `E_VALIDATION`.

**weeklyWeekdays**
- Required for weekly frequency; array of integers 1-7 without duplicates.
- Return `E_VALIDATION` if missing or invalid.

**startAt/endAt**
- Accept Singapore local date/time strings; convert via `parseSg` and persist using `toUtcIso`.
- `startAt` must be >= current SG time minus 5 minutes tolerance; `endAt` must be null or after `startAt`.
- On update, ensure `endAt` not before last generated occurrence; else `E_CONFLICT` prompting user to complete or delete outstanding occurrences.

**occurrenceId**
- Must belong to recurrence rule when skipping; otherwise `E_NOT_FOUND`.

### Timezone Handling
**Critical:** All recurrence calculations use Singapore timezone (`Asia/Singapore`).

```typescript
import { nowSg, parseSg, toUtcIso, fromUtcIso } from '@/lib/timezone';

const anchor = body.startAt ? parseSg(body.startAt) : toSg(todo.dueAt ?? nowSg());
if (!anchor.isValid || anchor <= nowSg()) {
  return err('E_VALIDATION', 'Start date must be in the future');
}

const nextOccurrence = computeNextOccurrence(rule, fromUtcIso(lastDueAt));
const dueAtUtc = toUtcIso(nextOccurrence);
```
- Persist all generated occurrences with `dueAt` in UTC; UI converts back via `toSg`.
- When computing monthly/yearly rollovers, rely on Luxon’s `plus` with SG zone to avoid DST assumptions.

### Client-Side Behavior
**Recurrence Editor Modal**
- UI displays frequency selection, interval input, weekday multi-select, start/end date pickers.
- State validates client-side (e.g., ensure weekday selection when weekly) before hitting API.
- API errors show inline field feedback; modal prevents closing on failure unless user cancels intentionally.

**Recurrence Badge and Summary**
- UI displays readable summary (e.g., "Repeats every 2 weeks on Tue, Thu") generated using shared formatter.
- State keeps recurrence info in todo object; SWR caches rule details keyed by `recurrenceRuleId`.
- API updates re-fetch rule and upcoming occurrences upon success.

**Occurrence Lifecycle**
- Completing occurrence triggers optimistic complete and background creation of next instance; UI shows spinner on series header while waiting.
- Skipping uses confirmation dialog; on success, UI inserts new occurrence card with fade animation.
- Ending recurrence updates badge to "Ended" state and removes future scheduled occurrences list.

**Upcoming Occurrences List (Optional UI)**
- UI may show table of next N occurrences for transparency.
- State fetches via `/api/recurrences/:id` preview data.
- API errors display inline alert; fallback message encourages retry.

## Acceptance Criteria

### Recurrence Creation
- [ ] Users can attach recurrence to a todo with valid combination of frequency, interval, and anchor date.
- [ ] Backend prevents multiple active recurrence rules per todo.
- [ ] System generates next occurrence immediately unless `endAt` reached.

### Occurrence Management
- [ ] Completing an occurrence marks it done and creates the next occurrence adhering to rule.
- [ ] Skipping removes current occurrence without counting as completion and schedules the subsequent one.
- [ ] Ending recurrence stops new generation while preserving historical occurrences.

### Schedule Accuracy
- [ ] Daily/weekly/monthly/yearly schedules respect interval and timezone expectations (e.g., monthly on 31st handles shorter months per strategy).
- [ ] Recurrence engine never creates occurrences past `endAt` or more than 12 months ahead (safety cap).
- [ ] Weekly rules honor selected weekdays even across week boundaries and daylight changes (noting SG has no DST).

### Metadata Inheritance
- [ ] New occurrences copy title, description, priority, tags (future PRPs), and reminders (future PRPs) from root todo.
- [ ] Editing an occurrence allows local changes (e.g., adjust due time) without altering rule or template unless explicitly chosen.
- [ ] Updating root todo optional flag `propagate=true` pushes changes to future unsatisfied occurrences.

## Error Handling

### Client Errors
- Validation failures highlight problematic fields and keep modal open.
- Attempting to create a second recurrence on same todo shows inline warning and disables submit.
- Skipping/ending with stale data (occurrence already completed) triggers list refresh and informational toast.

### Server Errors
- `E_INTERNAL` from recurrence generation logs `traceId`; client shows retry toast and leaves UI unchanged.
- Database transaction failure when creating occurrence rolls back both rule creation and todo updates.
- Scheduled job failures emit structured log for observability and trigger alert if repeated.

## Testing Requirements

### E2E Tests (Playwright)
```
tests/03-recurring-todos.spec.ts
```

Test cases:
- [ ] Create daily recurrence and verify automatic creation of next occurrence upon completion.
- [ ] Configure weekly recurrence with multiple weekdays; confirm occurrences appear on correct dates.
- [ ] Create monthly recurrence on 31st using different strategies and verify due dates in shorter months.
- [ ] Skip an occurrence and confirm the next scheduled date aligns with rule.
- [ ] End recurrence and ensure no additional occurrences are generated afterward.

## Performance Requirements
- Recurrence creation (rule + first generation) completes ≤ 250 ms.
- Recurrence engine batch job processes 500 rules in ≤ 5 seconds using synchronous SQLite operations with transactions.
- Client recurrence modal opens and renders summary formatter in ≤ 100 ms for perceived responsiveness.

## Out of Scope
- Complex RRULE support beyond listed frequencies/intervals.
- Time-of-day variations per occurrence (only single anchor time handled).
- Multi-user shared recurrences or delegation.
- Automatic reminder scheduling (covered in PRP 04).

## Success Metrics
- ≥80% of recurring series generate next occurrence within 1 second of completing the previous one.
- Less than 0.5% of generated occurrences require manual correction (support tickets or skips immediately following create).
- Reduction in manually created duplicate todos by ≥30% compared to baseline week before launch.
