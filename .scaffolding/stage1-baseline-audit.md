# Stage 1 – Baseline Audit

## Repository Snapshot
- Branch: `ai-sdlc-todo-app-dev`
- Git status: modified core backend files (`lib/db.ts`, `lib/auth.ts`, `app/api/todos/**/*`) plus numerous new REST routes and middleware; UI untouched for new features
- Tooling: `package.json` scripts present (`dev`, `build`, `start`, `lint`, `test:e2e`); Tailwind config still v3; Playwright configured but only one API-focused spec exists

## Alignment With EVALUATION.md

| Feature | Backend | Frontend | Tests | Notes |
|---------|---------|----------|-------|-------|
| 01 Todo CRUD | Schema + REST cover validation, optimistic helpers | UI lacks sections (Overdue/Active/Completed), modals, confirmation, full optimistic flow | Single API Playwright spec | Needs full UI overhaul & comprehensive tests |
| 02 Priority System | Priority column/validation present | Badges/dropdowns minimal, no filters/contrast audit | None | Sorting/filter UI missing, WCAG TBD |
| 03 Recurring Todos | Recurrence fields + auto-clone logic implemented | No repeat controls/badges or disable flow in UI | None | Need UI/UX, unit tests on date math |
| 04 Reminders & Notifications | Reminder fields + `/api/notifications` endpoints | No enable button or reminder dropdown; hook mismatched with API response | None | Hook expects `{ todos }`, API returns nested data |
| 05 Subtasks & Progress | Subtask CRUD endpoints ready | No subtask UI/progress bar | None | Must wire cascade visuals and tests |
| 06 Tag System | Tag/table CRUD, todo-tag links | No manage tags modal, badges, or filter chips | None | UI creation + validation tests required |
| 07 Template System | Templates CRUD & use endpoint complete | Lacking save/use modals, previews, category filter | None | Need serialization UI + tests |
| 08 Search & Filtering | `todoDB.list` supports search/tags | No search input, debounce, indicators | None | Build UI w/ combined filters |
| 09 Export & Import | REST endpoints exist | No buttons, status messaging | None | Import uses `new Date` (TZ), lacks validation tests |
| 10 Calendar View | Holidays table/API ready | `/calendar` route missing entirely | None | Build calendar UI + tests |
| 11 Authentication | WebAuthn flows, middleware, `/login` | Main shell ignores session, no logout, tests bypass auth | None | Must integrate auth-aware UI + Playwright passkeys |

## Testing, Quality & Deployment
- Unit tests: none for DB helpers, timezone, import remapping, progress, validation
- Playwright: single API spec; no WebAuthn, browser flows, or UI assertions; virtual authenticator not configured
- Accessibility: no dedicated coverage; UI missing modals/focus management, contrast audit pending
- Performance: DB indexes partly present; frontend lacks pagination optimization and measurement; reminder polling interval hardcoded vs env
- Deployment: `.env.example` exists but no `vercel.json`/`railway.json`; SQLite persistence strategy for serverless undeclared; production smoke tests undocumented

## Immediate Risks
- Middleware now blocks unauthenticated Playwright/API usage; future tests must obtain session via WebAuthn
- `useNotifications` hook expects different payload structure (`data.todos` vs `todos`) and uses snake_case keys; will break when mounted
- Import/export rely on `new Date()` bypassing Singapore timezone helpers, risking invalid validation
- Massive UI feature gaps mean most checklist items remain unchecked despite backend readiness

## Recommended Next Steps
1. Design comprehensive frontend architecture covering todos dashboard, tags/templates management, reminders, and calendar, all auth-aware.
2. Align notification hook + API contract, ensure timezone helpers used consistently (no raw `new Date()`).
3. Expand automated tests: unit suites for helper logic, Playwright specs for each evaluation feature with virtual passkeys.
4. Plan accessibility/performance workstreams and deployment configs before Stage 4.
