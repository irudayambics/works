# Outstanding Actions to Satisfy EVALUATION.md

## Core Features

### Feature 02: Priority System
- [ ] Visual test: badge colours remain legible in both light and dark themes—capture screenshots and document results.

### Feature 03: Recurring Todos
- [ ] Add Playwright coverage for creating weekly recurring todos.
- [ ] Add Playwright coverage for creating monthly recurring todos.
- [ ] Add Playwright coverage for creating yearly recurring todos.
- [ ] Add unit tests that exercise `computeNextDueDate` for all recurrence patterns (daily/weekly/monthly/yearly) using Singapore timezone expectations.
- [ ] Extend E2E coverage so the spawned instance is verified to inherit priority, tags, reminders, and recurrence metadata from the completed todo.

### Feature 04: Reminders & Notifications
- [ ] Perform manual QA to request notification permission via the UI and record the result.
- [ ] Perform manual QA to confirm a browser notification fires at the configured reminder time.
- [ ] Add a Playwright test that selects a reminder via the UI and asserts the reminder badge renders with the correct label.
- [ ] Add a Playwright test that the `/api/notifications/check` polling honours duplicates prevention in the UI context.
- [ ] Introduce a dedicated unit test that validates reminder time/offest calculations in Singapore timezone.

### Feature 05: Subtasks & Progress Tracking
- [ ] Add a unit test that exercises the progress computation helper to cover completed/total percentage maths.
- [ ] Add a Playwright scenario that deletes a todo with subtasks and asserts cascading removal (subtasks are gone in follow-up fetch).

### Feature 06: Tag System
- [ ] Add unit-level validation tests that assert duplicate tag names per user are rejected case-insensitively.

### Feature 07: Template System
- [ ] Add Playwright coverage for editing an existing template and verifying persisted changes.
- [ ] Add Playwright coverage for deleting a template and ensuring it is removed from listings.
- [ ] Supplement with a unit test that serialises/deserialises template subtasks payload to guarantee structure and ordering.

### Feature 08: Search & Filtering
- [ ] Add Playwright coverage for searching by tag name (advanced mode) to confirm tag-name matches return associated todos.
- [ ] Add Playwright coverage that combines multiple filters and then clears them via the "Clear" control, asserting the list resets.
- [ ] Capture performance benchmarks (≥1000 todos) to confirm filtering executes < 100 ms and document methodology.

### Feature 09: Export & Import
- [ ] Add Playwright coverage for importing invalid JSON and asserting friendly error feedback.
- [ ] Add Playwright coverage that verifies imported todos (with subtasks/tags) appear immediately in subsequent list fetches.
- [ ] Add unit tests that exercise ID remapping logic during import, including tag deduplication and relationship preservation.
- [ ] Add unit tests that validate the export/import JSON schema (presence of version, todos, subtasks, tags).

### Feature 10: Calendar View
- [ ] Add Playwright coverage that the calendar loads the current month with the correct highlighted day.
- [ ] Add Playwright coverage for navigating to previous/next months and using the Today button to reset.
- [ ] Add Playwright coverage that verifies todos appear on their due dates within the calendar grid.
- [ ] Add Playwright coverage that verifies Singapore public holidays render with their labels.
- [ ] Add Playwright coverage that clicking a day opens a modal listing the day’s todos/holiday details.

### Feature 11: Authentication (WebAuthn)
- [ ] Add Playwright coverage for registering a new user with the virtual authenticator helper.
- [ ] Add Playwright coverage for logging in an existing user with the virtual authenticator.
- [ ] Add Playwright coverage that logout clears the session cookie and protected routes redirect to `/login`.
- [ ] Add Playwright coverage confirming authenticated users visiting `/login` are redirected to `/`.
- [ ] Add unit tests around `createSession`/`verifySessionToken` to validate JWT creation and verification flows.

## Testing & Quality Assurance
- [ ] Add unit tests hitting core database CRUD helpers (users, todos, subtasks, tags) to guarantee prepared statements behave as expected.
- [ ] Extend unit tests to cover validation utilities (e.g., todo schema, tag schema) to catch regressions early.
- [ ] Ensure progress-calculation and import-remapping unit tests (see Feature 05/09) are implemented.
- [ ] Create Playwright specs for Feature 10 (Calendar) and Feature 11 (Authentication) so all 11 feature suites exist.
- [ ] Document or automate three consecutive green Playwright runs (CI artifact or log) to satisfy stability requirement.

## Performance & Optimization
- [ ] Collect frontend performance metrics (page load, TTI, FCP) using Lighthouse/Chrome profiler and document results, ensuring targets (<2 s load, etc.) are met.
- [ ] Benchmark todo CRUD/search operations to confirm API latency averages <300 ms and document query plans.
- [ ] Audit bundle size and introduce optimisations (code splitting, tree shaking) if gzipped bundle exceeds 500 KB.
- [ ] Confirm database indexes support due date, priority, and user queries under load; capture EXPLAIN outputs.

## Accessibility
- [ ] Execute a WCAG AA audit (axe/Lighthouse) and resolve contrast, semantic, or focus issues discovered.
- [ ] Validate full keyboard navigation for all interactive controls, adding ARIA roles/labels where necessary.
- [ ] Document screen reader labelling coverage for buttons, inputs, and modals; patch gaps.
- [ ] Ensure visible focus indicators for all actionable elements in both light and dark themes.
- [ ] Add polite live-region announcements for optimistic mutations to improve SR feedback.

## Browser Compatibility
- [ ] Manually test Chrome, Edge, Firefox, and Safari on desktop; log any WebAuthn quirks.
- [ ] Manually test Chrome (Android) and Safari (iOS) to confirm touch interactions and notifications operate.

## Deployment Readiness & Security
- [ ] Confirm environment variable documentation includes production values for `JWT_SECRET`, `RP_ID`, `RP_NAME`, and `RP_ORIGIN`.
- [ ] Add guidance for configuring rate limiting (or implement middleware) to mitigate brute-force attempts.
- [ ] Verify CORS configuration (if deploying APIs separately) and document the policy.
- [ ] Review logging to ensure no sensitive data is emitted; substitute structured logging where necessary.
- [ ] Provide explicit instructions for enabling HTTPS-only cookies in all deployment environments.

## Vercel Deployment
- [ ] Provision the app on Vercel (CLI or dashboard) and connect the GitHub repository.
- [ ] Configure environment variables (`JWT_SECRET`, `RP_ID`, `RP_NAME`, `RP_ORIGIN`) within Vercel.
- [ ] Commit a `vercel.json` matching the evaluation requirements (build/dev/install commands, `regions: ["sin1"]`).
- [ ] Perform preview and production deployments via `vercel` CLI, documenting URLs.
- [ ] Validate WebAuthn flows against the Vercel domain, adjusting RP settings as needed.
- [ ] Address SQLite persistence by migrating to a hosted database (e.g., Vercel Postgres) or documenting limitations.
- [ ] Post-deployment, verify APIs, timezone handling, and console cleanliness on Vercel.

## Railway Deployment
- [ ] Create/link a Railway project using the CLI, ensuring repository integration is enabled.
- [ ] Configure Railway environment variables (`JWT_SECRET`, `RP_ID`, `RP_NAME`, `RP_ORIGIN`).
- [ ] Add deployment configuration (`railway.json`, `Procfile`, `nixpacks.toml`) aligning with evaluation checklist.
- [ ] Provision a persistent volume for SQLite (or migrate to Railway Postgres) and update `lib/db.ts` accordingly.
- [ ] Deploy via `railway up` and document the live URL.
- [ ] Validate authentication, todos CRUD, reminders, export/import, and calendar features on the Railway deployment.

## Post-Deployment Checklist
- [ ] Run functional smoke tests in production (register/login, todo CRUD, recurring, reminders, subtasks, tags, templates, search, export/import, calendar, logout) and log outcomes.
- [ ] Execute Lighthouse audits (performance/accessibility/SEO) and remediate findings to exceed 90 where required.
- [ ] Load-test with ≥100 todos to ensure responsiveness under realistic data volumes.
- [ ] Validate security controls post-deploy (HTTPS enforcement, cookie flags, auth redirects, injection/XSS resilience).
- [ ] Complete cross-browser checks in production environments and capture evidence.
- [ ] Update README/USER_GUIDE with deployment URLs, environment instructions, known issues, and changelog entries.
- [ ] Implement monitoring/analytics (or document the plan) to achieve “Excellent Implementation” targets.
