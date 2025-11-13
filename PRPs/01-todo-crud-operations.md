# PRP: Todo CRUD Operations

## Feature Overview
Provide end-to-end create, read, update, and delete capabilities for todos while adhering to the global conventions defined in `00-core-prp.md`. Ensure all time handling uses Singapore timezone helpers and CRUD flows feel immediate with optimistic UI feedback.

## User Stories

### As a user
- I want to create a todo with a title, optional description, priority, and due date so I can track upcoming tasks.
- I want to view my active todos in chronological and priority order so I can understand what to do next.
- I want to edit a todo’s details so I can keep information accurate when plans change.
- I want to mark a todo as completed or revert it so I can track progress.
- I want to delete a todo that I no longer need so my list stays tidy.

## User Flow

### Create Todo
1. UI displays an empty todo creation form with defaults.
2. User enters title, optional description, priority, due date, and submits.
3. System validates input, persists todo, and returns the created record.
4. UI optimistically shows the new todo and reconciles with server response.

### View Todo List
1. UI loads todos with skeleton state while data fetches.
2. System returns active todos sorted by priority then due date.
3. UI renders list with filters, empty state when no todos, and error state on failure.
4. User can click a todo to reveal details inline or in a drawer.

### Update Todo
1. UI displays edit form prefilled with todo data.
2. User changes fields (title, description, priority, due date, completion) and saves.
3. System validates and updates record, returning the latest todo payload.
4. UI updates the list in place and rolls back on failure.

### Delete Todo
1. UI shows delete affordance with confirmation modal.
2. User confirms deletion.
3. System soft-deletes the todo by setting `deletedAt` and returns success status.
4. UI removes the todo, shows toast feedback, and offers undo that triggers restore endpoint (if implemented later).

## Technical Requirements

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
  dueAt TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_dueAt ON todos(dueAt);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
```
- Default columns follow `00-core-prp.md` (UUID IDs, soft delete, UTC ISO timestamps).
- `dueAt` stores UTC ISO strings; nullable when no due date.
- `completed` uses `0/1` integer mapped to boolean in API layer.

### API Endpoints
All endpoints reside under `app/api/todos` and MUST use the shared response envelope from `00-core-prp.md`. Authentication hooks in once PRP 11 ships.

#### `POST /api/todos`
**Create Todo**
- Input:
  ```typescript
  {
    title: string;        // required, 1-200 chars
    description?: string; // optional, max 2000 chars
    priority: 'low' | 'medium' | 'high';
    dueAt?: string;       // optional UTC ISO string
  }
  ```
- Output: Created todo object with all persisted fields.
- Validation:
  - `title` required, trim, length 1-200 (`E_VALIDATION`).
  - `priority` must be enum value; defaults to `'medium'` if omitted (`E_VALIDATION`).
  - `dueAt` (if provided) must parse to valid Singapore date at least **one minute** in the future via timezone helpers (`E_VALIDATION`).
  - Reject duplicate `Idempotency-Key` with `E_CONFLICT`.

#### `GET /api/todos`
**List Todos**
- Input query:
  ```typescript
  {
    cursor?: string; // opaque string from meta.cursor
    limit?: number;  // default 50, max 100
    includeCompleted?: 'true' | 'false'; // default false
  }
  ```
- Output: Paginated list of active todos (optionally completed) sorted by priority DESC, due date ASC, createdAt DESC. Includes `meta.cursor` when more records exist.
- Validation:
  - `limit` numeric 1-100.
  - `includeCompleted` only accepts `'true'` or `'false'`.
  - Cursor integrity errors return `E_VALIDATION`.

#### `GET /api/todos/:id`
**Fetch Single Todo**
- Output: Todo record matching `id` if not soft-deleted.
- Errors: Missing record returns `E_NOT_FOUND` with 404.

#### `PATCH /api/todos/:id`
**Update Todo**
- Input:
  ```typescript
  {
    title?: string;
    description?: string | null; // null clears description
    priority?: 'low' | 'medium' | 'high';
    dueAt?: string | null;       // null clears due date
    completed?: boolean;
  }
  ```
- Output: Updated todo object.
- Validation:
  - Reject empty payload (`E_VALIDATION`).
  - Apply same field-level rules as create.
  - Prevent no-op (no changes) by returning current record with 200.
  - Conflicts on soft-deleted todo return `E_NOT_FOUND`.

#### `DELETE /api/todos/:id`
**Delete Todo**
- Output: `{ ok: true }` with no data payload.
- Validation:
  - Soft delete by setting `deletedAt`; if already deleted, return idempotent success.
  - Missing todo returns `E_NOT_FOUND`.

### Validation Rules
**title**
- Required; trimmed length 1-200 characters.
- Must contain at least one non-whitespace character.
- Error: "Title is required" (`E_VALIDATION`).

**description**
- Optional up to 2000 characters.
- Allow empty string but convert to `null` when persisted.
- Error: "Description is too long" (`E_VALIDATION`).

**priority**
- Required enum `low|medium|high`; default `medium` when omitted on create.
- Store lowercase; reject mixed casing.
- Error: "Priority must be low, medium, or high" (`E_VALIDATION`).

**dueAt**
- Optional UTC ISO string.
- When provided, convert from Singapore-local input via timezone helpers and ensure it is at least one minute later than `nowSg()` (Singapore time).
- Error: "Due date must be at least 1 minute in the future" (`E_VALIDATION`).

**completed**
- Optional boolean; `true` sets `completed = 1`, `false` sets `0`.
- When set to `true`, `completedAt` remains out of scope for this PRP.
- Error: "Completed flag must be boolean" (`E_VALIDATION`).

### Timezone Handling
**Critical:** All date operations use Singapore timezone (`Asia/Singapore`) and helpers defined in `00-core-prp.md`.

```typescript
import { nowSg, parseSg, toUtcIso } from '@/lib/timezone';

const now = nowSg();
const dueDateSg = body.dueAt ? parseSg(body.dueAt) : null;
if (dueDateSg && !dueDateSg.isValid) {
  return err('E_VALIDATION', 'Invalid due date');
}
if (dueDateSg && dueDateSg <= now.plus({ minutes: 1 })) {
  return err('E_VALIDATION', 'Due date must be at least 1 minute in the future');
}
const dueAtUtc = dueDateSg ? toUtcIso(dueDateSg) : null;
```

## UI Components
- **TodoCreateForm** renders title, description, priority, and due date inputs with inline helper text. Disabled states cover invalid data or pending submission, and the component adds an `Idempotency-Key` header on every POST while optimistically inserting the placeholder todo.
- **TodoListView** shows skeleton rows, empty illustrations, or the sorted todo list. It integrates completion toggles and filter controls while keeping SWR-style caches fresh after mutations.
- **TodoDetailDrawer** pre-fills editable fields, displays optimistic saving indicators, and rolls back field changes when the PATCH call fails. It only sends diffed fields to the API.
- **DeleteConfirmationModal** guards destructive actions with SG-friendly copy, offers undo, and triggers cascaded soft deletes so dependent resources (subtasks, tags, reminders, recurrence instances) stay in sync.
- **ToastBanner / ErrorAlert** components surface validation and server errors using the shared design language from `.github/copilot-instructions.md`.

## Edge Cases
- Due dates within one minute of `nowSg()` return `E_VALIDATION`; UI must surface friendly copy and keep user input intact.
- Duplicate submissions caused by network retries rely on `Idempotency-Key`; server returns `E_CONFLICT` while the UI should display a non-blocking warning and retain optimistic state.
- Attempting to edit or delete a soft-deleted todo returns `E_NOT_FOUND`; clients need to refresh the list and show "Todo not found" messaging.
- Pagination cursors tampered in the URL return `E_VALIDATION`; UI clears the cursor and fetches the default page.
- Cascading deletes must soft-delete dependent subtasks, tags, reminders, and recurrence instances in the same transaction to avoid orphaned rows.

## Acceptance Criteria

### Create Todo
- [ ] Form validates required title and priority before POST.
- [ ] Successful creation persists todo with UTC timestamps and SG-derived due date.
- [ ] UI applies optimistic insert and reconciles with server response envelope.

### View Todo List
- [ ] API pagination respects limit and cursor contract.
- [ ] List defaults to active (non-completed) todos and hides soft-deleted entries.
- [ ] Empty, loading, and error states satisfy core UI conventions.

### Update Todo
- [ ] PATCH updates only provided fields and refreshes `updatedAt`.
- [ ] Completed flag toggles between 0/1 and UI reflects state immediately.
- [ ] Validation errors bubble to user with friendly messaging.
- [ ] Reject due dates less than one minute ahead (server response `E_VALIDATION`).

### Delete Todo
- [ ] DELETE sets `deletedAt` and returns success in core envelope.
- [ ] Subsequent GET requests exclude deleted todo.
- [ ] Deleting already-deleted todo remains idempotent.

## Error Handling

### Client Errors
- Validation errors: Highlight fields, show inline messages, toast summary when multiple.
- Conflict errors: Display retry hint when idempotency conflict occurs.
- Not found: Show toast "Todo not found" and refresh list.

### Server Errors
- Database failure: Return `E_INTERNAL`; client surfaces toast and retry option.
- Unauthorized (future auth): Redirect to login when `E_UNAUTHORIZED` seen.
- Rate limit: Show countdown toast and disable mutation buttons briefly.

## Testing Requirements

### E2E Tests (Playwright)
```
tests/01-todo-crud-operations.spec.ts
```

Test cases:
- [ ] Create todo with future due date; verify list ordering and optimistic update.
- [ ] Validation failure on empty title shows inline message without creating record.
- [ ] Update todo title and mark completed; confirm persistence after reload.
- [ ] Delete todo and ensure it no longer appears; deleting twice stays idempotent.
- [ ] Attempt to create todo with due date less than one minute ahead shows validation error inline and no record is persisted.
- [ ] Pagination smoke: seed >50 todos and verify cursor fetch loads next page.

## Performance Requirements
- List endpoint response ≤ 150 ms for 50 items on dev hardware.
- Create/Update/Delete mutations ≤ 200 ms end-to-end (API call + DB write).
- Client list rendering maintains 60fps when managing up to 200 todos via virtualization if needed.

## Out of Scope
- Recurring todos, reminders, tags, subtasks, templates, and calendar views.
- Bulk operations (multi-select, batch delete) and drag-and-drop reordering.
- Completed timestamp tracking and activity history.

## Success Metrics
- 95% of todo mutations complete without retry.
- Average time from mutation to UI confirmation < 300 ms.
- Less than 1% of API responses return `E_VALIDATION` after initial launch (indicates intuitive UI).
