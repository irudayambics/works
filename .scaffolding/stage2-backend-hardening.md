# Stage 2 – Backend Hardening

## Changes Implemented
- **Reminder scheduling**: `todoDB.listDueForReminder` now evaluates reminder windows in Singapore time, preventing premature notifications and duplicate sends.
- **Notifications API**: `/api/notifications/check` returns reminder timestamps (`remindAt`) and relies on the updated reminder logic.
- **Import normalisation**: `/api/todos/import` converts due dates via Singapore-time helpers, trims descriptions, ignores reminders without valid due dates, and preserves recurrence rules safely.

## Impacts
- Reminder delivery aligns with UX expectations (fires at `dueAt - reminderMinutes`, single send).
- Import/export flows no longer bypass timezone utilities, avoiding inconsistent UTC/Singapore handling.
- Client hook still expects old response shape (`todos` vs `data.todos`); adjust alongside frontend refresh in Stage 3.

## Follow-ups
- Update `useNotifications` hook to consume `data.todos` and new `remindAt` field.
- Extend automated tests (unit + E2E) to cover reminder scheduling and import parsing once frontend is wired.
