**Execution Plan**

- **Baseline Audit**
  - Confirm repo state: inspect db.ts, `app/api/**`, page.tsx, `app/calendar`, middleware.ts, current tests, configuration files.
  - Map existing functionality against every checkbox in EVALUATION.md; document gaps (backend, UI, tests, deployment).
  - Verify tooling status (package.json scripts, Playwright config, lint settings, `.env` expectations).

- **Backend Hardening**
  - Reconcile database schema with checklist fields (priority, recurrence, reminders, subtasks, tags, templates, holidays); ensure indexes and cascade rules.
  - Validate API routes meet contract (CRUD, filters, export/import, notifications, templates, holidays, auth); add missing endpoints or behaviors (Singapore timezone checks, validation, optimistic responses).
  - Implement/export helper logic (progress calculation, reminder scheduling, calendar data, search/filter queries) with null-safe handling.
  - Add unit tests for backend utilities (date math, validation, ID remap, progress, reminder logic).

- **Frontend Implementation**
  - Overhaul main dashboard page.tsx: sections (Overdue/Active/Completed), create/edit forms, delete confirmation, optimistic updates, priority badges, tag components, recurring controls, reminder dropdown, subtasks UI with progress bar, notifications opt-in, search & filters, export/import modals.
  - Build supporting client components/hooks (tag manager modal, template modals, filter indicators, debounce search, badge styles with WCAG AA compliance, keyboard/focus handling).
  - Implement calendar view at `app/calendar/page.tsx`: month nav, Singapore holidays, todo counts, modal view, URL sync.
  - Flesh out auth flows (`/login`, logout button, middleware redirects) and global layout (loading/error states, empty states).
  - Ensure dark mode compatibility, responsive design, accessibility annotations (aria-labels, focus trapping).

- **Testing & QA**
  - Expand unit test suite (`tests/unit/**` or similar) covering CRUD helpers, timezone utilities, progress, reminder scheduling, JSON validation.
  - author Playwright E2E specs mirroring features 01-11 plus cross-feature flows; update `tests/helpers.ts`.
  - Configure Playwright virtual authenticator, timezone, and run/flaky triage until 3 consecutive green runs.
  - Add lint/type checks to CI scripts, ensure TypeScript strict compliance and zero ESLint errors.
  - Validate accessibility via automated tooling (Lighthouse/axe) and manual keyboard audit.

- **Performance & Optimization**
  - Measure interactions; optimize list rendering (memoization, virtualization if needed), ensure API calls under targets, debounce/promise batching.
  - Add DB indexes for `user_id`, `due_date`, foreign keys; confirm prepared statements everywhere.
  - Implement pagination or lazy-loading strategies if large datasets; update docs with benchmarks.

- **Deployment Readiness**
  - Finalize environment docs (.env.example, README updates) including WebAuthn RP settings.
  - Add production error boundaries, 404/500 pages, logging hooks, secure cookie options.
  - Verify `npm run build && npm start` success; prepare `vercel.json`, `railway.json`, `nixpacks.toml`, `Procfile` as required.
  - Execute deployments (Vercel + Railway), configure env vars, volumes, and verify post-deploy checklist (auth, API, timezone, persistence).
  - Record Lighthouse/performance/security/cross-browser results; ensure cookies secure, rate limiting or notes.

- **Documentation & Wrap-Up**
  - Update README.md, USER_GUIDE.md, PRPs with new flows, known issues, deployment steps.
  - Complete EVALUATION.md statuses with evidence.
  - Provide final report summarizing completion, test results, deploy URLs, residual risk, and next-step recommendations.

Let me know when you’re ready for Stage 1 (Baseline Audit), and I’ll start working through the steps sequentially.