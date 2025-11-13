# PRP: Priority System

## Feature Overview
Implement a three-level priority system (high, medium, low) that influences sorting, filtering, and visual distinction of todos. This PRP extends the CRUD foundation per `00-core-prp.md`, ensuring priority metadata drives both backend ordering and consistent UI presentation.

## User Stories

### As a user
- I want to assign a priority to each todo so I can highlight urgent work.
- I want to quickly filter todos by priority so I can focus on the most important items.
- I want priorities to reorder my list automatically so high-priority tasks stay visible.
- I want visually distinct priority indicators so I can scan the list at a glance.

## User Flow

### Assign Priority During Create/Edit
1. UI shows segmented control or select for priority with default `Medium`.
2. User picks a priority when creating or editing a todo.
3. System validates enum, persists change, recalculates sort order.
4. UI updates badge styling and list position optimistically.

### Filter by Priority
1. UI exposes filter chips or dropdown for `All`, `High`, `Medium`, `Low`.
2. User selects a filter value.
3. System requests list endpoint with `priority` query or filter locally using cached data.
4. UI displays filtered list, updates empty/filter badge states.

### Auto-Sorting by Priority
1. UI requests todo list (initial load or refetch).
2. System sorts by priority rank (High→Medium→Low) then due date and created date.
3. UI renders list in consistent order and animates repositioning when priority changes.
4. User sees updated ordering immediately with toast confirmation on edits.

## Technical Requirements

### Database Schema
```sql
-- Priority column exists from PRP 01 but ensure supporting index.
CREATE INDEX IF NOT EXISTS idx_todos_priority_status ON todos(priority, completed, deletedAt);
```
- Maintain `priority TEXT NOT NULL CHECK (priority IN ('low','medium','high'))` column.
- Optional migration step populates existing rows with default `'medium'` if null.

### API Endpoints
All endpoints reuse `app/api/todos` routes and envelopes defined in `00-core-prp.md`.

#### `GET /api/todos`
**Priority Filter & Sort**
- Input additions:
  ```typescript
  {
    priority?: 'low' | 'medium' | 'high';
  }
  ```
- Output: List constrained to requested priority (if provided) sorted High→Low via deterministic rank mapping.
- Validation:
  - Reject invalid priority values (`E_VALIDATION`).
  - When combined with pagination, ensure cursor encodes priority criteria to avoid cross-priority leakage.

#### `PATCH /api/todos/:id`
**Update Priority**
- Input allows `priority` change with same validation as create.
- Upon update, recompute `updatedAt` timestamp and ensure response includes new priority.
- Validation: Prevent setting priority identical to current when no other changes (optional warning but still 200).

#### `GET /api/todos/summary`
**Priority Counts**
- Optional endpoint returning aggregate counts for each priority to power filter badges.
- Output:
  ```typescript
  {
    high: number;
    medium: number;
    low: number;
  }
  ```
- Validation: Only accessible to authenticated user once auth lands; respond 200 with zeros when no todos.

### Validation Rules
**priority**
- Required on create; optional on update.
- Accept only lowercase `low|medium|high`; convert UI selections accordingly.
- Provide message "Priority must be high, medium, or low".

**priority filter param**
- Optional query string; must match allowed enum.
- Unknown value triggers `E_VALIDATION` with guidance.

### Timezone Handling
Priorities themselves are timezone-agnostic, but due date calculations triggered during sorting MUST continue to use `nowSg`, `toSg`, and `toUtcIso` helpers from `00-core-prp.md`. When comparing due dates while sorting, convert to Singapore time before computing relative ordering to handle cross-midnight edge cases.

## UI Components
- **PrioritySelector** renders an accessible segmented control (or select on mobile) defaulting to `medium`, highlighting API validation errors inline and triggering optimistic reorders.
- **PriorityBadge** maps priorities to Tailwind tokens (`bg-red-500`, `bg-amber-500`, `bg-slate-500`) and updates immediately after optimistic mutations with reconciliation to server responses.
- **PriorityFilterChips** sync with URL search params, expose clear-all actions, and handle pagination cursors derived from the active priority.
- **PrioritySummaryCounters** (paired with `/summary`) display count badges for each level and revalidate via SWR after mutations.
- **ErrorBanner / Toast** components surface validation, conflict, or rate-limit messaging without disrupting list focus per project guidelines.

## Edge Cases
- Submitting invalid priority values (e.g., uppercase "High") must return `E_VALIDATION`; UI lowercases input or prompts correction.
- Switching filters while paginated requires cursor invalidation to avoid cross-priority leakage; mismatched cursors trigger `E_VALIDATION` and a clean refetch.
- Updating a priority on a soft-deleted todo returns `E_NOT_FOUND`; clients remove the todo from view and notify the user.
- Hitting the `/summary` endpoint before any todos exist should return zeros rather than 404 to keep badges stable.
- Rapid toggling of priorities can hit rate limits; UI should debounce updates and surface cooldown messaging when receiving `E_RATE_LIMIT`.

## Acceptance Criteria

### Priority Assignment
- [ ] Creating or editing todos allows selecting priority; defaults to medium.
- [ ] Priority validation errors surface inline and prevent submission.
- [ ] Successful updates return todo with new priority and refreshed timestamps.

### Sorting & Display
- [ ] List endpoint sorts High→Medium→Low, then due date ASC, then createdAt DESC.
- [ ] UI reflects new ordering within 200 ms of mutation (optimistic then server reconcile).
- [ ] Priority badges render with correct color tokens and accessible labels.

### Filtering
- [ ] API supports `priority` query param with pagination-compatible cursors.
- [ ] UI filter toggles list data without full page reload.
- [ ] Empty state messaging adapts to active priority filter.

### Aggregation (if `/summary` implemented)
- [ ] Endpoint returns accurate counts for each priority excluding deleted todos.
- [ ] UI badge counts update on mutation without requiring full reload (SWR revalidation).

## Error Handling

### Client Errors
- Invalid priority selection: display inline helper text and revert to previous value.
- Filter errors (e.g., tampered query): reset filter to `All` and toast a warning.
- Not found (updating deleted todo): remove item from list and notify user.

### Server Errors
- Database constraint violation: log with `traceId`, respond `E_INTERNAL`, prompt user to retry.
- Rate limit on repeated priority toggles: disable controls briefly and surface countdown toast.
- Unauthorized (future auth): redirect to login while preserving intended filter state.

## Testing Requirements

### E2E Tests (Playwright)
```
tests/02-priority-system.spec.ts
```

Test cases:
- [ ] Create todos with different priorities and verify list ordering high→low.
- [ ] Update priority from low to high and confirm immediate repositioning.
- [ ] Apply priority filter and ensure only matching todos render; remove filter restores full list.
- [ ] Tamper with query param to invalid value and confirm fallback plus warning.
- [ ] (If `/summary` active) Verify badge counts update after creating/deleting todos.

## Performance Requirements
- Sorting and filtering queries execute in ≤ 120 ms for 500 active todos using indexed lookup.
- Client re-render after priority mutation completes within a single animation frame (~16 ms) via virtualization or list diffing.
- Summary endpoint (if used) caches results per user for 5 seconds to reduce load.

## Out of Scope
- Custom priority levels beyond the three defined tiers.
- Automatic priority escalation or reminders (handled by future PRPs).
- Cross-user priority sharing; each user manages their own set.

## Success Metrics
- ≥90% of todos have explicit priority set after one week (indicates adoption).
- Priority filter usage accounts for ≥30% of list interactions (tracked via telemetry).
- Less than 1% of mutations result in priority-related validation errors post-launch.
