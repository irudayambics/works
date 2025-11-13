# Stage 3 – Frontend Implementation Report

## Overview
Stage 3 focused on delivering the feature-rich client experience described in `EVALUATION.md`. The dashboard (`app/page.tsx`) was rebuilt around authenticated session state, and a dedicated calendar view (`app/calendar/page.tsx`) now visualises todos alongside Singapore public holidays. Supporting hooks and utilities were refreshed to maintain Singapore-time semantics and notification behaviour.

## Feature Highlights
- **Dashboard overhaul**: Todos load in authenticated contexts and render across Overdue, Active, and Completed sections with priority-first sorting. Create/edit modals capture priority, recurrence, reminders, tags, subtasks, and template metadata in a single form. Deletion confirms prior to removal and updates the UI optimistically with rollback on failure.
- **Search, filters, and tags**: Priority dropdown, debounced search (title + tag names), and clickable tag chips drive AND-composed filtering. A Manage Tags modal supports tag CRUD with colour swatches and duplicate name validation.
- **Subtasks and progress**: Each todo exposes inline subtask management with add/edit/delete, checkbox toggles, and a live progress bar that turns green at 100%. Ordering persists through the API payload.
- **Recurring + reminder UX**: Repeat toggle unlocks pattern selection and enforces due-date presence; reminder options disable without a due date. Badges surface selected recurrence/pacing and display reminder timing in Singapore timezone via `formatSingaporeDate`.
- **Templates workflow**: Saving the active form state produces reusable templates with category metadata. The template picker supports category filtering, previews inherited metadata, and allows due date offsets before creating a new todo.
- **Export / import**: Dashboard header buttons export the current dataset (download blob) or import JSON through a hidden file input with validation/error toasts. Relationships are rehydrated via API callbacks.
- **Notifications integration**: `lib/hooks/useNotifications.ts` now respects the new payload shape (`data.todos`, `remindAt`), honours a persisted mute flag, and calculates reminder diffs with `getSingaporeNow`. Fetches POST back to `/api/notifications/check` after triggering a browser notification for de-duplication.
- **Calendar page**: `/app/calendar/page.tsx` renders a six-week grid aligned to Mondays, highlights today, weekends, and Singapore holidays, and counts todos per priority. Clicking a day opens a modal summarising todos (with tags and recurrence context). Month navigation syncs to `?month=YYYY-MM` query params with `Today` reset support.

## Technical Notes
- All date handling uses `nowSg`, `fromUtcIso`, and `formatSingaporeDate` helpers to preserve Asia/Singapore semantics when parsing, formatting, or persisting timestamps.
- Client requests centralise through `/api/todos`, `/api/tags`, `/api/templates`, and `/api/holidays`, with guards preventing fetches until the session resolves.
- Toast notifications rely on a lightweight in-component queue keyed by `createId()` and automatically clear after 4 seconds.
- Calendar generation produces 42 cells (6 weeks) to maintain a stable layout regardless of month length and caches todos/holidays in lookup maps for performant rerenders.

## Testing Status
- `npm run lint` now fails because Next.js 16 removed the `next lint` subcommand; migrating to an explicit `eslint.config.js` is required before linting can be automated again.
- `npx eslint --max-warnings=0 . --ext .ts,.tsx` currently errors for the same reason (no flat-config present). No linting has been recorded for Stage 3 until the configuration is updated.
- Playwright E2E suites were not executed in this pass; manual validation covered dashboard interactions, filtering, notifications toggle, and calendar navigation.

## Follow-up Work
1. Add a project-level `eslint.config.js` (or revert to ESLint 8 with `.eslintrc`) so CI and local `npm run lint` succeed under Next.js 16.
2. Expand Playwright coverage to hit Stage 3 scenarios (subtasks, tag management, template save/use, export/import, calendar drill-down).
3. Consider extracting modal/button primitives into `components/` to reduce duplication between dashboard and calendar interfaces.
