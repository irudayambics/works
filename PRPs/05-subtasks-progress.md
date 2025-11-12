# PRP: Subtasks & Progress Tracking

## Feature Overview

Subtasks & Progress Tracking extends todo records with lightweight checklists so users can break work into actionable items. The feature relies on the conventions in [00-core-prp.md](./00-core-prp.md) for default columns, soft deletes, timezone helpers, and API envelopes while surfacing real-time completion progress on every todo detail view.

## User Stories

### As a user

- I want to add subtasks to a todo so I can break large work into smaller steps.
- I want to reorder subtasks so I can prioritize the sequence of actions.
- I want to check off subtasks and see the parent todo’s progress update immediately.
- I want subtasks to disappear when I delete a todo so the list stays tidy.

## User Flow

### Manage Subtasks

1. UI loads the todo detail drawer and fetches subtasks via `/api/todos/:todoId/subtasks` showing skeleton placeholders.
2. User adds a new subtask by typing a title and pressing Enter or clicking “Add”.
3. System validates the payload, inserts the subtask with default `isCompleted = 0`, and returns the created row.
4. UI appends the item optimistically, reconciles fields on success, and surfaces inline errors on failure.

### Reorder Subtasks

1. User enters reorder mode (drag handle or up/down controls) on the checklist.
2. UI captures the new order locally and sends `PATCH /api/todos/:todoId/subtasks/reorder` with ordered IDs and positions.
3. Server runs a transaction to update `position` values and returns the new ordering.
4. UI reflects the confirmed order and persists it across reloads.

### Track Progress

1. User toggles a subtask checkbox in the checklist view.
2. Client submits `PATCH /api/subtasks/:id` with an updated `isCompleted` value.
3. Server updates the record, optionally stamps `completedAt`, and recalculates todo progress metrics.
4. UI updates the progress bar and optionally auto-collapses completed subtasks based on user preference.

## Technical Requirements

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  todoId TEXT NOT NULL,
  title TEXT NOT NULL,
  isCompleted INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  completedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo_active
  ON subtasks(todoId, position)
  WHERE deletedAt IS NULL;
CREATE INDEX IF NOT EXISTS idx_subtasks_completed
  ON subtasks(todoId, isCompleted)
  WHERE deletedAt IS NULL;
```

- `position` is a zero-based integer maintained per todo; gaps are allowed but reorder operations compact values.
- `completedAt` stores UTC ISO string for analytics; nullable when not completed.
- Application layer ensures subtasks inherit the parent todo’s soft delete (`deletedAt`) during cascading operations.

### API Endpoints

All endpoints require an authenticated session per [00-core-prp.md](./00-core-prp.md) and enforce todo ownership before mutating data.

#### `GET /api/todos/:todoId/subtasks`

Lists active subtasks.

- Input: path `todoId`.
- Output: `ok<Subtask[]>` sorted by `position ASC` then `createdAt DESC`.
- Validation:
  - Todo must exist for the current user or return `E_NOT_FOUND`.
  - Soft-deleted todos respond with an empty array.

#### `POST /api/todos/:todoId/subtasks`

Creates a subtask tied to the todo.

- Input:

  ```typescript
  {
    title: string;
    insertAfterId?: string;
  }
  ```

- Output: `ok<Subtask>` including resolved `position`.
- Validation:
  - `title` required, 1–200 chars trimmed; else `E_VALIDATION`.
  - `insertAfterId` must belong to the same todo or return `E_NOT_FOUND`.
  - Cap at 200 subtasks per todo; exceeding returns `E_CONFLICT`.

#### `PATCH /api/subtasks/:id`

Updates the title or completion state.

- Input:

  ```typescript
  {
    title?: string;
    isCompleted?: boolean;
  }
  ```

- Output: `ok<Subtask>` with refreshed timestamps.
- Validation:
  - Payload must include at least one field; otherwise `E_VALIDATION`.
  - `title` obeys create constraints.
  - Completion toggle sets or clears `completedAt` via timezone helpers.

#### `PATCH /api/todos/:todoId/subtasks/reorder`

Persists drag ordering.

- Input:

  ```typescript
  {
    order: { subtaskId: string; position: number }[];
  }
  ```

- Output: `ok<{ subtaskId: string; position: number }[]>` reflecting stored positions.
- Validation:
  - Payload must include every active subtask once or return `E_CONFLICT`.
  - Positions must be contiguous integers starting at 0; gaps trigger `E_VALIDATION`.
  - Updates run inside a transaction for atomicity.

#### `DELETE /api/subtasks/:id`

Soft deletes a subtask and compacts ordering.

- Input: path `id`.
- Output: `ok({ id: string })` after setting `deletedAt` and compacting positions.
- Validation:
  - Already-deleted subtasks return idempotent success.
  - Cross-user access returns `E_FORBIDDEN`.

### Validation Rules

- **title**: Required on create; trimmed length 1–200 characters. Error: "Subtask title must be between 1 and 200 characters."
- **insertAfterId**: Optional; when present it must reference another active subtask on the same todo. Error: "Subtask insertion target is invalid."
- **isCompleted**: Optional boolean; defaults to `false`. Error: "Completion flag must be true or false."
- **order**: Required array when reordering; must include every active subtask once. Error: "Provide the full ordered list of subtasks."
- **position**: Required integer ≥0; contiguous across the reorder payload. Error: "Positions must be sequential starting from zero."

### Timezone Handling
**Critical:** All date operations use Singapore timezone (`Asia/Singapore`)

```typescript
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone';

// When validating due date
const nowSG = getSingaporeNow();  // NOT new Date()
const dueDateObj = new Date(dueDate);
if (dueDateObj <= nowSG) {
  // Error: past date
}
```

### Client-Side Behavior

- Checklist rendering:
  - UI shows a skeleton list while fetching subtasks and swaps to content with empty/error states per design system.
  - Completed subtasks optionally collapse behind a toggle that persists in local storage.
- Subtask creation form:
  - Input trims whitespace and disables submit until valid; duplicate submissions are prevented via pending state.
  - Optimistic updates append the new subtask with a temporary ID reconciled against the response.
- Reorder interactions:
  - Drag-and-drop uses pointer-safe handles and keyboard accessible move controls.
  - Client sends a single reorder payload after the user commits changes; optimistic UI updates roll back on error.
- Progress indicator:
  - Todo detail panel shows a progress bar with percentage derived from completed/total subtasks.
  - Parent todo list chips reflect progress without waiting for a page reload by updating shared state.

## Acceptance Criteria

### Subtask CRUD

- [ ] Creating a subtask inserts a row tied to the todo and reflects immediately in the UI.
- [ ] Editing the title updates the record and shows the trimmed value without a full reload.
- [ ] Deleting a todo soft-deletes associated subtasks within the same transaction.

### Reordering

- [ ] Dragging or using keyboard controls persists new positions and matches the server response order.
- [ ] Position gaps are eliminated after reorder operations.
- [ ] Concurrency conflicts display an error and prompt the user to refresh the list.

### Progress Tracking

- [ ] Toggling completion updates the subtask `isCompleted` flag and `completedAt` timestamp when true.
- [ ] Parent todo progress percentage updates within 500 ms of the toggle response.
- [ ] Completed subtasks remain visible in history if the user expands the collapsed section.

## Error Handling

### Client Errors

- Validation failures render inline helper messages under the offending input and keep any optimistic item in a pending state until resolved.
- Reorder conflicts surface a toast "Subtasks changed elsewhere. Refresh and try again." and re-fetch data.
- Missing parent todos redirect back to the todo list with a warning toast.

### Server Errors

- Database or transaction failures return `E_INTERNAL`; client logs the `traceId` and shows a retry option.
- Unauthorized requests return `E_UNAUTHORIZED` and forward users to the sign-in flow.
- Rate limiting (if applied globally) responds with `E_RATE_LIMIT` and the client backs off per `Retry-After`.

## Testing Requirements

### E2E Tests (Playwright)

```text
tests/05-subtasks-progress.spec.ts
```

Test cases:

- [ ] Add, edit, complete, and delete subtasks while verifying optimistic UI reconciliation.
- [ ] Reorder subtasks via drag-and-drop and confirm persisted order after reload.
- [ ] Simulate concurrent completion toggles to ensure progress bar remains correct.
- [ ] Delete a todo and confirm subtasks no longer appear in list responses.

Unit and integration coverage:

- Subtask validation utilities (title length, reorder payload checks).
- Data access layer ensuring positions remain contiguous after mutations.
- Progress computation helper that calculates percentage from subtask aggregates.

## Performance Requirements

- Listing subtasks returns within 100 ms p95 for up to 200 items due to covering indices.
- Reorder transaction completes within 150 ms p95; payload size capped at 200 entries.
- Progress recalculation reuses cached aggregates or batched SQL to avoid N+1 queries.
- Client renders checklist updates without blocking main thread longer than 16 ms per frame.

## Out of Scope

- Nested subtasks or multi-level hierarchies.
- Assigning different owners to subtasks than the parent todo.
- Offline support for subtask edits beyond standard optimistic updates.
- Automatic progress-based status changes on the parent todo.

## Success Metrics

- ≥60% of todos with three or more checklist items created within 30 days of launch.
- ≥80% of subtask completion toggles sync successfully without manual refresh.
- <2% of reorder requests return `E_CONFLICT` after the first week in production.
- Average time between toggling a subtask and progress indicator update ≤500 ms at p95.

