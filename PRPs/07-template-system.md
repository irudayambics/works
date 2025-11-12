# PRP: Template System

## Feature Overview

Provide reusable todo templates so users can save preconfigured tasks with subtasks, priority, reminders, and category metadata. Templates speed up creation workflows and honour all conventions defined in [00-core-prp.md](./00-core-prp.md).

## User Stories

### As a user

- I want to save a todo (including subtasks and metadata) as a template so I can reuse it later.
- I want to organise templates into categories so I can find them quickly.
- I want to instantiate a template into a new todo with a single click.
- I want due dates generated from templates to respect my scheduling offset preferences.

## User Flow

### Create or Update Template

1. User opens the todo detail view and selects "Save as Template" or edits an existing template.
2. UI pre-fills the template form with todo fields (title, description, priority, subtasks, reminder lead time, tags).
3. User adjusts template name, category, and default due date offset, then submits.
4. API validates payload, persists the template record including serialised subtasks JSON, and returns the saved template. UI confirms success with optimistic updates.

### Instantiate Template

1. User opens the "New Todo" drawer and selects a template card.
2. Client requests `/api/templates/:id/instantiate` with the desired target date (optional) and reminder overrides.
3. Server applies offsets, creates a todo with associated subtasks/tags inside a transaction, and responds with the new todo.
4. UI navigates to the todo detail view, showing generated subtasks and due date.

### Manage Template Library

1. User opens the templates gallery.
2. UI fetches `/api/templates` with pagination, displaying cards grouped by category.
3. User filters by category or searches by name; results update without full reload.
4. User archives (soft deletes) obsolete templates; UI confirms removal and updates list state.

## Technical Requirements

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
  reminderLeadMinutes INTEGER,
  dueOffsetMinutes INTEGER,
  subtasksJson TEXT NOT NULL,
  tagsJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_user_name
  ON templates(userId, name)
  WHERE deletedAt IS NULL;
```

- `subtasksJson` stores an ordered JSON array: `{ id: string; title: string; isCompleted: false; position: number }[]`.
- `tagsJson` stores an array of tag IDs associated with the template; server validates they belong to the user at save time.
- `dueOffsetMinutes` represents the default due date offset from instantiation time; nullable when no due date should be set.

### API Endpoints

All endpoints enforce authentication and filter by `userId`.

#### `GET /api/templates`

Lists active templates with pagination and optional category/name filters.

- Input: query params `cursor`, `limit`, `category`, `q` (case-insensitive search on name).
- Output: `ok<{ items: TemplateSummary[] }>` with `meta.cursor`.
- Validation:
  - `limit` 1–50 or `E_VALIDATION`.
  - `category` optional; when provided must be ≤40 chars.

#### `POST /api/templates`

Creates a template.

- Input:

  ```typescript
  {
    name: string;
    category: string;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    reminderLeadMinutes?: number;
    dueOffsetMinutes?: number;
    subtasks: { title: string; position: number }[];
    tagIds: string[];
  }
  ```

- Output: `ok<Template>`.
- Validation:
  - `name` required, trimmed 1–60 chars, unique per user (case-insensitive).
  - `category` required; trimmed 1–40 chars.
  - `reminderLeadMinutes` optional; must be in {15, 30, 60, 180, 720, 1440, 10080}.
  - `dueOffsetMinutes` optional integer between -43200 and 43200 (±30 days).
  - Subtasks list max 50 items; positions must be contiguous starting at 0.
  - `tagIds` deduplicated; all IDs must exist for the user or return `E_NOT_FOUND`.

#### `PATCH /api/templates/:id`

Updates template metadata.

- Input: same shape as create but all fields optional.
- Output: `ok<Template>`.
- Validation: at least one mutable field required; uniqueness and range rules reused.

#### `DELETE /api/templates/:id`

Soft deletes a template.

- Input: path `id`.
- Output: `ok({ id: string })`.
- Validation: nonexistent templates return `E_NOT_FOUND`; already deleted templates respond idempotently with success.

#### `POST /api/templates/:id/instantiate`

Creates a todo from the template.

- Input:

  ```typescript
  {
    targetDate?: string; // ISO string in SG timezone
    overrideDueOffsetMinutes?: number;
    reminderLeadMinutes?: number;
  }
  ```

- Output: `ok<{ todoId: string }>` with the created todo snapshot in `data.todo`.
- Validation:
  - Template must exist and not be soft deleted.
  - `targetDate` optional ISO; defaults to now in SG timezone.
  - `overrideDueOffsetMinutes` must be within the same bounds as `dueOffsetMinutes`.
  - Reminder optional; if omitted, template value is used; if both absent, no reminder scheduled.
  - Operation runs in a transaction to insert todo, subtasks, tags, and reminder job.

### Validation Rules

- **name**: Required on create; unique per user; trims whitespace. Message: "Template name must be unique and between 1 and 60 characters."
- **category**: Required; trimmed 1–40 characters. Message: "Provide a template category between 1 and 40 characters."
- **subtasks**: Array length 0–50; titles 1–200 chars; contiguous positions. Message: "Each subtask needs a title and sequential position."
- **tagIds**: Array length 0–10; IDs must exist for the user. Message: "Templates can include up to 10 valid tags."
- **dueOffsetMinutes**: Optional integer between -43200 and 43200. Message: "Due offset must be within ±30 days."
- **reminderLeadMinutes**: Optional; must match allowed lead times. Message: "Choose a supported reminder lead time."
- **targetDate**: Optional ISO string; when present must parse in SG timezone. Message: "Target date is invalid."

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

- Template gallery shows grouped cards by category with skeleton, empty, and error states.
- Template editor uses JSON preview for subtasks to highlight serialization issues and disables submit while validation runs.
- Instantiating a template triggers optimistic todo creation; on failure, UI rolls back and surfaces a toast with retry.
- Category filter persists in query string/local storage so the gallery reopens in the last viewed category.
- Subtasks ordering UI mirrors the Subtasks PRP drag controls and writes positions before submission.

## Acceptance Criteria

### Template CRUD

- [ ] Saving a template stores all fields, including subtasks JSON, and returns the persisted data.
- [ ] Updating a template reflects changes in subsequent instantiations without affecting existing todos.
- [ ] Soft-deleted templates disappear from the gallery and instantiation endpoints.

### Instantiation

- [ ] Instantiating a template creates a todo with copied subtasks, tags, priority, and reminder settings.
- [ ] Due date calculation respects template `dueOffsetMinutes` relative to SG now or provided target date.
- [ ] Users can override reminder lead time during instantiation; overrides persist on the new todo only.

### Category & Search

- [ ] Templates can be filtered by category and searched by name concurrently.
- [ ] Gallery empty state appears when no templates match filters and offers a CTA to create one.
- [ ] Category renames propagate to template cards immediately.

## Error Handling

### Client Errors

- Validation failures annotate fields inline and keep form data for correction.
- Attempting to instantiate a deleted template shows a toast "Template no longer available" and refreshes the gallery.
- Subtask position gaps detected client-side prompt users to reorder before saving.

### Server Errors

- Transactions that fail during instantiation roll back all inserts and return `E_INTERNAL`; client shows retry CTA.
- Unauthorized access returns `E_UNAUTHORIZED` and redirects to login.
- Rate limiting returns `E_RATE_LIMIT`; UI backs off and surfaces "Too many template actions. Try again soon." message.

## Testing Requirements

### E2E Tests (Playwright)

```text
tests/07-template-system.spec.ts
```

Test cases:

- [ ] Create, update, and delete templates, verifying gallery refresh and uniqueness rules.
- [ ] Instantiate a template with and without overrides, confirming todo creation and due date offsets.
- [ ] Filter templates by category and search term simultaneously.
- [ ] Attempt to instantiate a soft-deleted template and verify user-facing error handling.

Unit/integration coverage:

- Serialization utilities converting subtasks to/from JSON with position validation.
- Due date offset calculation helper ensuring SG timezone correctness.
- Template instantiation transaction (todo + subtasks + tags + reminders) including rollback scenarios.

## Performance Requirements

- Template list endpoints return within 100 ms p95 for 200 templates.
- Instantiation transaction completes within 180 ms p95 for templates with up to 50 subtasks and 10 tags.
- Gallery renders without blocking main thread >16 ms when displaying up to 20 cards.
- Search and filter operations reuse cached results and only request server updates when criteria change.

## Out of Scope

- Template sharing between users or organisations.
- Version history or draft states for templates.
- Automatic template recommendations based on activity.
- Editing subtasks after instantiation via template linkage (templates do not update existing todos).

## Success Metrics

- ≥50% of weekly active users create at least one template within 60 days of launch.
- ≥40% of new todos during the period originate from templates.
- Template instantiation failure rate <1% over rolling 7 days.
- Average instantiation round-trip latency ≤500 ms at p95.
