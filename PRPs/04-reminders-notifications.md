# PRP: Reminders & Notifications

## Feature Overview

Reminders & Notifications ensure todos surface at the right moment for Singapore-based users by pairing browser notifications with configurable lead times. The feature respects the shared conventions in [00-core-prp.md](./00-core-prp.md) for API envelopes, error codes, soft deletes, and timezone helpers, and builds on todo due dates defined in the CRUD foundation.

## User Stories

### As a user

- I want to grant browser notification access so the app can alert me before tasks are due.
- I want to set a default reminder window and override it per todo so alerts match each task’s urgency.
- I want reminder delivery to happen exactly once per configured window even if I open multiple sessions.
- I want to review recently sent reminders so I can confirm what was delivered.

## User Flow

### Request Notification Permission

1. UI checks `Notification.permission` on load and renders the permission banner when status is `default` or `denied`.
2. User clicks “Enable notifications”, triggering the browser permission prompt with SG-centric explanation.
3. System records `notificationsEnabled` in reminder preferences when permission is granted.
4. UI hides the banner and shows success feedback; if denied, it persists the banner with guidance.

### Configure Reminder Defaults

1. UI loads reminder preferences via `/api/reminder-preferences` and shows the default lead time selector.
2. User chooses a lead window (15 minutes → 1 week) and toggles notification enablement.
3. Client sends `PUT /api/reminder-preferences` and optimistically updates local state.
4. Server persists the preference row and returns the envelope; UI reconciles or rolls back on failure.

### Schedule Todo Reminder

1. User opens a todo and enables reminders or adjusts the per-todo lead time.
2. Client submits `POST /api/reminders` with todo ID and optional override.
3. Server validates inputs, computes `scheduledAt` using SG timezone helpers, and inserts a pending reminder.
4. UI reflects the reminder status badge and queues background polling.

### Dispatch Reminder Payloads

1. Foreground polling worker calls `POST /api/reminders/dispatch` every 60 seconds with the last cursor.
2. Server selects pending reminders whose `scheduledAt` is within the next minute, marks them sent, and returns payloads.
3. Client displays browser notifications using the returned metadata and writes to the local activity list.
4. UI logs the reminder in history and continues polling with the new cursor.

## Technical Requirements

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS reminder_preferences (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE,
  defaultLeadMinutes INTEGER NOT NULL CHECK (defaultLeadMinutes IN (15,30,60,180,360,720,1440,2880,4320,10080)),
  notificationsEnabled INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_preferences_user
  ON reminder_preferences(userId) WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  todoId TEXT NOT NULL,
  userId TEXT NOT NULL,
  leadMinutes INTEGER NOT NULL CHECK (leadMinutes IN (15,30,60,180,360,720,1440,2880,4320,10080)),
  scheduledAt TEXT NOT NULL,
  sentAt TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','cancelled','skipped')),
  channel TEXT NOT NULL DEFAULT 'browser' CHECK (channel IN ('browser','email')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_reminders_due_pending
  ON reminders(status, scheduledAt) WHERE deletedAt IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_unique
  ON reminders(todoId, leadMinutes) WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS reminder_dispatch_log (
  id TEXT PRIMARY KEY,
  reminderId TEXT NOT NULL,
  dispatchedAt TEXT NOT NULL,
  deliveryStatus TEXT NOT NULL CHECK (deliveryStatus IN ('delivered','errored')),
  responseMeta TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_reminder
  ON reminder_dispatch_log(reminderId);
```

### Configuration

- Document `NOTIFICATIONS_POLL_INTERVAL_SECONDS` (default `30`) in `.env.example` and align client/server polling intervals with this value.

### API Endpoints

#### `GET /api/reminder-preferences`

Purpose: Retrieve the current user’s reminder defaults.

Input:

```typescript
{}
```

Output: `ok({ defaultLeadMinutes: number; notificationsEnabled: boolean })`

Validation:

- Requires authenticated user (JWT per core conventions) or returns `E_UNAUTHORIZED`.
- Missing record returns defaults `{ defaultLeadMinutes: 60, notificationsEnabled: false }`.

#### `PUT /api/reminder-preferences`

Purpose: Update reminder defaults for the signed-in user.

Input:

```typescript
{
  defaultLeadMinutes: number;
  notificationsEnabled: boolean;
}
```

Output: `ok({ defaultLeadMinutes: number; notificationsEnabled: boolean })`

Validation:

- `defaultLeadMinutes` must match the allowed enum or return `E_VALIDATION`.
- `notificationsEnabled` must be boolean; coercion failures return `E_VALIDATION`.
- Concurrent updates rely on SQLite constraint; conflicts return `E_INTERNAL` with retry guidance.

#### `POST /api/reminders`

Purpose: Schedule a reminder for a todo.

Input:

```typescript
{
  todoId: string;
  leadMinutes?: number;
  scheduledAt?: string; // UTC ISO override, rarely used
}
```

Output: `ok<Reminder>` containing the new reminder row.

Validation:

- Todo must exist and not be soft-deleted; otherwise `E_NOT_FOUND`.
- Duplicate reminders per `(todoId, leadMinutes)` are rejected with `E_CONFLICT`.
- Computed or provided fire time must be in the future (no past-due reminders) or returns `E_VALIDATION`.

#### `GET /api/reminders`

Purpose: List reminders for the current user.

Input:

```typescript
{
  status?: 'pending' | 'sent';
  limit?: number;
  cursor?: string;
}
```

Output: `ok<{ data: Reminder[]; meta: { cursor?: string } }>` with pagination metadata.

Validation:

- `limit` defaults to 20 and caps at 50; exceeding cap returns `E_VALIDATION`.
- `status` must be `pending` or `sent`; omitted returns both ordered by `scheduledAt`.
- Cursor integrity failures return `E_VALIDATION` and do not advance pagination.

#### `DELETE /api/reminders/:id`

Purpose: Cancel a pending reminder.

Input: path parameter `id` (string).

Output: `ok({ id: string })` after marking reminder `cancelled` and setting `deletedAt`.

Validation:

- If reminder already cancelled or deleted, returns idempotent success.
- Reminder belonging to another user returns `E_FORBIDDEN`.

#### `POST /api/reminders/dispatch`

Purpose: Dispatch and mark due reminders as sent.

Input:

```typescript
{
  lastCursor?: string;
}
```

Output:

```typescript
{
  reminders: {
    reminderId: string;
    todoId: string;
    title: string;
    body: string;
    scheduledAtUtc: string;
    scheduledAtSg: string;
    leadMinutes: number;
  }[];
  cursor?: string;
}
```

Validation:

- Enforces rate limiting (60 requests per minute per user) returning `E_RATE_LIMIT` with `Retry-After`.
- Ensures reminders are only returned once by using a transaction that updates `status` to `sent` and logs to `reminder_dispatch_log`.

### Validation Rules

- defaultLeadMinutes:
  - Required when updating preferences; must be one of `[15, 30, 60, 180, 360, 720, 1440, 2880, 4320, 10080]`.
  - Friendly message: `"Choose one of the available reminder windows."`
- notificationsEnabled:
  - Required boolean flag; accepts `true` or `false`.
  - Friendly message: `"Toggle notifications on or off."`
- todoId:
  - Required UUID string corresponding to an existing todo owned by the user.
  - Friendly message: `"Todo not found or inaccessible."`
- leadMinutes:
  - Optional override; must use same enum as `defaultLeadMinutes`.
  - Friendly message: `"Reminder window is not supported."`
- scheduledAt:
  - Optional ISO timestamp; when provided it must not be in the past relative to `nowSg()`.
  - Friendly message: `"Scheduled time must be in the future."`

### Timezone Handling

Critical: All date operations use Singapore timezone (`Asia/Singapore`).

```typescript
import { nowSg, parseSg, toUtcIso, toSg } from '@/lib/timezone';

const now = nowSg();
const dueDateSg = todo.dueAt ? parseSg(todo.dueAt) : now.plus({ minutes: leadMinutes });
if (!dueDateSg.isValid || dueDateSg <= now.plus({ minutes: 1 })) {
  return err('E_VALIDATION', 'Due date must be at least 1 minute in the future.');
}

const scheduledAtSg = dueDateSg.minus({ minutes: leadMinutes });
if (scheduledAtSg <= now) {
  return err('E_VALIDATION', 'Scheduled time must be in the future.');
}

const scheduledAtUtc = toUtcIso(scheduledAtSg);
const scheduledAtLabel = toSg(scheduledAtUtc).toFormat('dd MMM yyyy, HH:mm');
```

## UI Components
- **NotificationPermissionBanner** displays callouts when `Notification.permission !== 'granted'`, persists dismissal after successful preference updates, and shows inline validation errors.
- **ReminderSettingsPanel** offers lead-time selects and enable toggles with optimistic updates guarded by `Idempotency-Key` headers.
- **TodoReminderToggle** attaches to each todo detail view, exposing lead-time overrides, handling `E_CONFLICT` gracefully, and reconciling state after refresh.
- **ReminderActivityList** paginates recent reminders with SG-formatted timestamps, skeleton placeholders, and cursor-based "Load more" controls.
- **DispatchStatusToast** surfaces feedback when the polling worker triggers reminder deliveries or hits errors/rate limits.

## Edge Cases
- Permission denied (`Notification.permission === 'denied'`) should keep the banner visible with guidance and avoid repeated permission prompts.
- Scheduling reminders for todos due within one minute must return `E_VALIDATION`; the UI keeps control state and highlights the lead-time field.
- Duplicate schedules for the same `(todoId, leadMinutes)` return `E_CONFLICT`; clients refresh the reminder list instead of retrying endlessly.
- Concurrent polling across multiple tabs must not duplicate notifications; dispatch endpoint and client dedupe logic should handle this gracefully.
- Timezone conversions around SG midnight must ensure `scheduledAt` never falls in the past after conversion; clients surface any validation failure clearly.

## Acceptance Criteria

### Notification Permission Flow

- [ ] Permission banner appears when notifications are not granted and hides immediately after enabling.
- [ ] Toggling notifications updates `reminder_preferences` and reflects state within 1 second.
- [ ] Denied permissions persist guidance without causing repeated permission prompts.

### Reminder Scheduling

- [ ] Scheduling a reminder inserts exactly one pending record per `(todoId, leadMinutes)` combination.
- [ ] Reminders compute `scheduledAt` using SG timezone helpers and store UTC ISO values.
- [ ] Cancelling or deleting a todo cascades to cancel its pending reminders.
- [ ] Attempting to schedule a reminder for a todo due within the next minute returns `E_VALIDATION` and surfaces inline feedback.

### Reminder Dispatch

- [ ] Foreground polling retrieves due reminders and updates their status to `sent` atomically.
- [ ] Duplicate notifications are prevented even with concurrent polling sessions.
- [ ] Dispatch logs capture each attempt with delivery status for audit.

### Reminder Activity

- [ ] History view lists the most recent 20 reminders with SG-formatted timestamps.
- [ ] Loading, empty, and error states match project-wide patterns from the core PRP.
- [ ] Pagination retrieves additional history without duplicating entries.

## Error Handling

### Client Errors

- Validation errors display inline near the triggering control and surface a summary toast.
- Duplicate scheduling attempts show a warning toast `"Reminder already scheduled"` and refresh data.
- When notifications are denied, UI explains how to re-enable them in browser settings.

### Server Errors

- Database failures return `E_INTERNAL`; client logs the `traceId` and offers retry.
- Unauthorized access due to missing JWT returns `E_UNAUTHORIZED` and routes users to the auth flow when available.
- Rate limiting on dispatch returns `E_RATE_LIMIT` and the client backs off according to `Retry-After`.

## Testing Requirements

### E2E Tests (Playwright)

```text
tests/04-reminders-notifications.spec.ts
```

Test cases:

- [ ] Enable notifications from default permission state and verify preference persistence.
- [ ] Schedule a reminder 30 minutes before due time and observe dispatch firing within ±1 minute.
- [ ] Cancel a reminder and confirm it no longer appears in the pending list.
- [ ] Simulate concurrent tabs to ensure only one notification fires per reminder.
- [ ] Verify history pagination returns distinct entries across cursor fetches.
- [ ] Attempt to schedule a reminder for a todo due within one minute and assert validation messaging is shown with no reminder created.

Unit and integration coverage:

- Reminder validation helper (lead window, scheduledAt logic).
- Dispatch handler marking reminders `sent` and logging responses.
- Timezone utilities subtracting lead minutes without drift.

## Performance Requirements

- Dispatch endpoint completes within 200 ms p95 for batches up to 20 reminders.
- Preference read/write operations respond within 100 ms under typical load.
- Client polling interval fixed at 60 seconds and must not exceed two active requests simultaneously per user.
- SQLite indices keep reminder selection queries under 10k pending rows under 10 ms.

## Out of Scope

- Email, SMS, or push notification channels beyond browser notifications.
- Server-side cron or background workers; relies on client-driven polling.
- Advanced sequencing such as multiple reminders per todo or escalation rules.
- Reminder snooze functionality.

## Success Metrics

- ≥70% of weekly active users enable notifications within 30 days of release.
- Reminder dispatch success rate (deliveryStatus `delivered`) ≥98% daily.
- <1% of reminder scheduling attempts result in `E_CONFLICT` after the first week.
- Average reminder latency from scheduled time to notification display ≤60 seconds.
