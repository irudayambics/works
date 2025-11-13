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
- Output: `ok({ id: string })` after marking the template `deletedAt` and removing associated cached summaries.
- Validation:
  - Missing or already-deleted templates return idempotent success.
  - Templates belonging to another user return `E_FORBIDDEN`.
  - Active instantiations referencing the template should continue working; no hard delete allowed.

### Timezone Handling

**Critical:** All date operations use Singapore timezone (`Asia/Singapore`). Template due date offsets must convert through the shared helpers so instantiated todos align with SG expectations.

```typescript
import { nowSg, parseSg, toUtcIso } from '@/lib/timezone';

const target = body.targetDate ? parseSg(body.targetDate) : nowSg();
if (!target.isValid) {
  return err('E_VALIDATION', 'Target date is invalid');
}

const dueAt = template.dueOffsetMinutes != null
  ? toUtcIso(target.plus({ minutes: template.dueOffsetMinutes }))
  : null;
```

## UI Components
- **TemplateGallery** displays category-grouped cards with skeletons, empty states, and error banners, persisting the last viewed category in query params/local storage.
- **TemplateFormDialog** pre-fills from an existing todo, previews serialized subtasks, blocks submission while validation runs, and shows inline errors.
- **TemplateInstantiateDrawer** lets users choose target date and overrides, triggers optimistic todo creation, and rolls back on failure with contextual toasts.
- **TemplateCategoryFilter** offers pill-based filters and search, syncing state to the URL for shareable views.
- **SubtaskOrderEditor** mirrors the Subtasks PRP drag/keyboard interactions to maintain contiguous positions before serialization.
- **FeedbackToast / InlineError** surfaces validation, conflict, or forbidden responses using consistent design language.

## Edge Cases
- Saving templates with duplicate names (case-insensitive) must return `E_CONFLICT`; UI prompts the user to adjust the name while preserving form state.
- Serializing more than 50 subtasks or providing non-contiguous positions should fail validation; the editor highlights offending entries.
- Instantiating a template whose tags were deleted must return `E_NOT_FOUND`; clients refresh tag data and present corrective messaging.
- Due date offsets producing past times relative to SG `now` should trigger `E_VALIDATION`, guiding users to adjust offsets or target dates.
- Instantiating a soft-deleted template should yield `E_NOT_FOUND`; gallery must refresh and remove the card while notifying the user.

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

## Testing Requirements

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
