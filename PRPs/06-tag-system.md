# PRP: Tag System

## Feature Overview

Enable users to organise todos with reusable, color-coded tags. The feature provides tag CRUD, many-to-many associations between todos and tags, and list filtering by tag while reusing core conventions from [00-core-prp.md](./00-core-prp.md).

## User Stories

### As a user

- I want to create and edit tags so I can organise todos by category.
- I want to assign multiple tags to a todo so I can filter by topics quickly.
- I want the tags to display consistent colors so I can recognise categories at a glance.
- I want to filter the todo list by one or more tags so I can focus on related work.

## User Flow

### Manage Tags

1. User opens the tag management panel from settings or the todo composer.
2. UI fetches `/api/tags` and shows existing tags with a loading skeleton.
3. User creates, renames, or recolors a tag; client validates and calls the relevant endpoint.
4. Server persists the change and returns the updated tag; UI reconciles optimistic state or shows inline errors.

### Assign Tags to a Todo

1. User opens a todo editor or detail drawer.
2. UI loads assigned tags and available tags, keeping local state of selections.
3. User picks or removes tags; client sends `PUT /api/todos/:todoId/tags` with the full tag list.
4. Server upserts associations in a transaction, returns current tag IDs, and UI updates chips immediately.

### Filter Todos by Tag

1. User selects one or more tags from filter controls in the list view.
2. Client updates URL search params and calls `/api/todos?tagIds=...` with cursor pagination.
3. Server joins against the `todoTags` table to return todos matching all chosen tags.
4. UI renders filtered results with empty and error states, updating breadcrumb/filter pills.

## Technical Requirements

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name
  ON tags(userId, name)
  WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS todoTags (
  id TEXT PRIMARY KEY,
  todoId TEXT NOT NULL,
  tagId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_todoTags_unique
  ON todoTags(todoId, tagId)
  WHERE deletedAt IS NULL;

CREATE INDEX IF NOT EXISTS idx_todoTags_tag
  ON todoTags(tagId)
  WHERE deletedAt IS NULL;
```

- `userId` references the authenticated user; all tag queries filter by this field.
- Tag colors use predefined Tailwind token keys (e.g., `tag-blue`, `tag-amber`). Validation enforces membership.
- Removing a tag soft-deletes both the tag and its `todoTags` rows inside a transaction.

### API Endpoints

All endpoints require authentication per the core PRP and scope queries by `userId`.

#### `GET /api/tags`

Returns paginated active tags for the current user.

- Input: optional `cursor` and `limit` query parameters (default 50, max 100).
- Output: `ok<{ items: Tag[] }>` with `meta.cursor` when additional results exist.
- Validation:
  - `limit` must be within 1–100 or return `E_VALIDATION`.
  - Cursor must be a valid opaque token issued by the API.

#### `POST /api/tags`

Creates a new tag.

- Input:

  ```typescript
  {
    name: string;
    color: string;
  }
  ```

- Output: `ok<Tag>`.
- Validation:
  - `name` required, trimmed 1–40 chars; unique per user (case-insensitive).
  - `color` required; must be in the allowed palette list or return `E_VALIDATION`.
  - Reaches max 200 active tags per user returns `E_CONFLICT`.

#### `PATCH /api/tags/:id`

Updates tag metadata.

- Input:

  ```typescript
  {
    name?: string;
    color?: string;
  }
  ```

- Output: `ok<Tag>`.
- Validation:
  - Payload must include at least one mutable field or return `E_VALIDATION`.
  - Fields reuse create constraints.
  - Updating to an existing active name returns `E_CONFLICT`.

#### `DELETE /api/tags/:id`

Soft deletes a tag and cascades to associations.

- Input: path `id`.
- Output: `ok({ id: string })`.
- Validation:
  - Nonexistent tags return `E_NOT_FOUND`.
  - Cascade removes related `todoTags` rows in the same transaction.

#### `PUT /api/todos/:todoId/tags`

Replaces the full tag set for a todo.

- Input:

  ```typescript
  {
    tagIds: string[];
  }
  ```

- Output: `ok<{ tagIds: string[] }>` reflecting active associations.
- Validation:
  - `tagIds` required array; deduplicated client-side and validated server-side.
  - All tags must exist for the current user; unknown IDs return `E_NOT_FOUND` with the offending IDs.
  - Operation runs in a transaction to soft-delete missing associations and insert new ones.

#### `GET /api/todos`

Supports tag filtering alongside existing pagination.

- Input: existing query params plus optional `tagIds=tag1,tag2`.
- Output: unchanged `ok<Todo[]>` envelope limited to todos containing all specified tags.
- Validation:
  - Tag filters must refer to active tags or return `E_NOT_FOUND`.
  - Reject more than 10 tag filters to protect performance with `E_VALIDATION`.

### Validation Rules

- **name**: Required on create; trimmed length 1–40; case-insensitive unique per user. Message: "Tag name must be unique and between 1 and 40 characters."
- **color**: Required; must match predefined palette keys (`tag-blue`, `tag-emerald`, etc.). Message: "Choose a color from the available tag palette."
- **tagIds**: Required array on assignment; max 10 per request, deduplicated. Message: "Provide up to 10 valid tag IDs."
- **cursor**: Optional; opaque string issued by the server. Message: "Pagination cursor is invalid or expired."
- **limit**: Optional number 1–100. Message: "Limit must be between 1 and 100."

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

- Tag management panel renders skeletons, empty state, and error retry per design system.
- Tag creation form trims input, debounces uniqueness checks, and prevents duplicate submissions while pending.
- Todo editors expose searchable multi-select with keyboard navigation; optimistic updates adjust chips immediately and roll back on failure.
- Filtering control syncs with URL query params and resets pagination when filters change.
- Chips use Tailwind token classes derived from `color`; client enforces palette to prevent arbitrary injection.

## Acceptance Criteria

### Tag CRUD

- [ ] Users can create up to 200 active tags; exceeding the limit surfaces an inline error.
- [ ] Editing a tag updates name and color everywhere without page reload.
- [ ] Deleting a tag removes it from all todos and hides it from filters instantly.

### Tag Assignment

- [ ] Assigning tags to a todo persists on the server and reflects immediately in list/detail views.
- [ ] Removing a tag from a todo disassociates it without affecting other todos.
- [ ] Assigning an invalid tag ID returns `E_NOT_FOUND` and leaves UI state unchanged.

### Tag Filtering

- [ ] Filtering by one or more tags returns only todos containing all selected tags.
- [ ] Empty results show the standard empty state with a clear "No todos match" message.
- [ ] Clearing filters restores the default todo list order.

## Error Handling

### Client Errors

- Validation failures highlight the affected form fields and keep the dialog open for correction.
- Attempting to assign stale tags triggers a toast "Selected tag no longer exists" and refreshes available tags.
- Filter requests with too many tags display a non-blocking toast instructing to reduce selections.

### Server Errors

- Database failures return `E_INTERNAL`; client logs the `traceId` and offers retry.
- Unauthorized access returns `E_UNAUTHORIZED`, pushing users to the login flow.
- Rate limiting sends `E_RATE_LIMIT`; UI backs off and shows "Too many requests, try again soon." message.

## Testing Requirements

### E2E Tests (Playwright)

```text
tests/06-tag-system.spec.ts
```

Test cases:

- [ ] Create, update, and delete tags while verifying optimistic UI rollbacks on forced failures.
- [ ] Assign multiple tags to a todo and ensure persistence across reloads.
- [ ] Filter by single and multiple tags, including empty state coverage.
- [ ] Delete a tag and ensure it disappears from todos and filters immediately.

Unit/integration coverage:

- Tag validation helpers (name uniqueness, palette enforcement).
- Data access layer ensuring transactional integrity when replacing tag associations.
- Todo listing query builder verifying tag filter semantics and pagination compatibility.

## Performance Requirements

- Tag list endpoints respond within 80 ms p95 for 200 tags.
- Replacing todo tags completes within 120 ms p95 with up to 10 tags.
- Filtering queries execute within 150 ms p95 when joining on up to 5 tags due to covering indexes.
- Client tag picker renders without blocking main thread >16 ms per interaction.

## Out of Scope

- Nested tag hierarchies or tag groups.
- Public or shared tag libraries across users.
- Tag suggestions powered by AI or natural language categorisation.
- Bulk tag assignment across multiple todos in one request.

## Success Metrics

- ≥70% of active users create at least one tag within 30 days.
- ≥60% of todos created in the period have at least one tag assigned.
- Tag-filtered todo views show <2% error rate over rolling 7 days.
- Average tag assignment latency ≤400 ms round-trip at p95.
