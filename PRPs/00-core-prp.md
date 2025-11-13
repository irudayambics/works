# 00 – Core Product Requirement Prompt (PRP)

A single source of truth that all feature PRPs must follow. Keep this short, prescriptive, and implementation-ready so AI coding assistants and developers can act on it immediately.

---

## 1) Purpose & Scope

* **Goal:** Standardize conventions across all Todo App features so code, tests, and docs remain consistent.
* **Audience:** Developers and AI assistants (Copilot/ChatGPT) implementing or reviewing any PRP.
* **Applies to:** Entire app (Next.js 16 App Router), API routes, DB access (better-sqlite3), UI patterns (Tailwind CSS 4), testing (Playwright), auth (WebAuthn via `@simplewebauthn`).
* **Non-goal:** Detailed per‑feature behavior (lives in each feature PRP).

---

## 2) How to Use This Core PRP

1. **Read this first** before writing/using any feature PRP.
2. Reference these rules **verbatim** in each feature PRP (don’t copy the text; link back to this core).
3. If a convention needs to change, update this core PRP and then patch only the affected feature PRPs.

**Keywords used in feature PRPs:**

* **MUST** = mandatory; **SHOULD** = recommended; **MAY** = optional.

---

## 3) Global Architecture & Project Conventions

* **Framework:** Next.js **16** (App Router).
* **Styling:** Tailwind **CSS 4**; prefer utility classes; keep components minimal.
* **Database:** SQLite (file DB) via **better-sqlite3** (synchronous).
* **Auth:** WebAuthn/Passkeys via **`@simplewebauthn`**; JWT-backed session for API access.
* **Timezone:** **Asia/Singapore** for all user-facing time rules; **store timestamps in UTC**.
* **Testing:** Playwright for E2E; unit tests with **Vitest** (recommended) or Jest.
* **Folder hints:**

  * `app/` (App Router pages + API route handlers)
  * `app/api/<resource>/route.ts` (REST-like handlers)
  * `lib/` (timezone, validation, id generation, db connection)
  * `data/` (SQLite file `app.db`; keep out of VCS)
  * `sql/` (optional plain-SQL migrations)

**Environment**

* SQLite file path: `DATA_DB_PATH` (default: `./data/app.db`).
* JWT secret: `AUTH_JWT_SECRET`.
* WebAuthn RP ID/Origin/Name: `AUTH_RP_ID`, `AUTH_RP_ORIGIN`, `AUTH_RP_NAME`.
* Cookie configuration: `AUTH_COOKIE_DOMAIN`, `AUTH_COOKIE_SECURE` (optional overrides for production hardening).
* Reminder polling: `NOTIFICATIONS_POLL_INTERVAL_SECONDS` (default 30).
* Export/import quotas: `EXPORT_MAX_PER_HOUR`, `IMPORT_MAX_PER_HOUR` (defaults 3 each).

Maintain `.env.example` in the repo root with every required variable, sensible defaults (non-secret), and short inline documentation. Any new feature PRP adding variables MUST update `.env.example` and note production overrides in the relevant section.

---

## 4) Date & Time (Singapore‑First)

**Single source of truth:** `lib/timezone.ts` utilities.

### 4.1 Storage vs Display

* **Persist** timestamps as **UTC ISO 8601 strings** (e.g., `2025-11-12T07:00:00.000Z`).
* **Compute & display** dates in **Asia/Singapore**. Singapore has no DST, but **do not assume fixed offsets**—always convert via helpers.

### 4.2 Required Helpers (implement in `lib/timezone.ts`)

```ts
// lib/timezone.ts
import { DateTime } from "luxon"; // or a tiny wrapper; choice MUST be consistent app-wide

export const SG_TZ = "Asia/Singapore" as const;

export function nowSg(): DateTime {
  return DateTime.now().setZone(SG_TZ);
}
export function toSg(d: string | number | Date): DateTime {
  return DateTime.fromJSDate(new Date(d)).setZone(SG_TZ);
}
export function parseSg(isoOrLocal: string): DateTime {
  // Accepts ISO or YYYY-MM-DD HH:mm inputs assumed in SG time
  const iso = DateTime.fromISO(isoOrLocal, { zone: SG_TZ });
  if (iso.isValid) return iso;
  return DateTime.fromFormat(isoOrLocal, "yyyy-MM-dd HH:mm", { zone: SG_TZ });
}
export function startOfDaySg(d: string | Date): DateTime {
  return toSg(d).startOf("day");
}
export function endOfDaySg(d: string | Date): DateTime {
  return toSg(d).endOf("day");
}
export function toUtcIso(dt: DateTime): string {
  return dt.toUTC().toISO({ suppressMilliseconds: false });
}
export function fromUtcIso(iso: string): DateTime {
  return DateTime.fromISO(iso).toUTC();
}
```

**Rules**

* **All** due date math (recurrence, reminders) MUST use these helpers.
* Sorts and filters by date MUST compute with SG zone then persist/compare in UTC.
* When validating user-supplied due dates, enforce `parseSg(input) > nowSg().plus({ minutes: 1 })` to guarantee at least a one-minute future buffer per evaluation checklist.

---

## 5) Database Conventions (SQLite + better‑sqlite3)

**DB connection**

```ts
// lib/db.ts
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DATA_DB_PATH ?? path.resolve(process.cwd(), "data/app.db");
export const db = new Database(dbPath, { verbose: undefined });
db.pragma("journal_mode = WAL");
```

**Default columns** (apply to every table unless strongly justified):

* `id TEXT PRIMARY KEY` (UUID v4 string generated in app layer)
* `createdAt TEXT NOT NULL` (UTC ISO)
* `updatedAt TEXT NOT NULL` (UTC ISO)
* `deletedAt TEXT NULL` (soft delete; NULL = active)

**Soft delete rule:** features MUST ignore rows where `deletedAt IS NOT NULL` unless explicitly querying archives.

**Transactions:** use `db.transaction((tx) => { ... })` for multi-table ops.

**Migrations:** Keep plain SQL in `sql/` (e.g., `001_init.sql`). Example snippet:

```sql
-- sql/001_init.sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
  dueAt TEXT, -- UTC ISO or NULL
  completed INTEGER NOT NULL DEFAULT 0, -- 0/1
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_dueAt ON todos(dueAt);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
```

**IDs**

```ts
// lib/id.ts
export function createId(): string {
  return crypto.randomUUID(); // Node 18+
}
```

**Cascade expectations**

* Todo deletions MUST cascade in the same transaction to dependent tables (`subtasks`, `todoTags`, `reminders`, recurrence instances) using explicit SQL updates setting `deletedAt` and maintaining referential integrity.
* Foreign-key constraints MAY remain deferrable, but every API that deletes or restores a todo is responsible for downstream clean-up to satisfy acceptance criteria (e.g., delete cascades to subtasks and tags).

---

## 6) API Conventions (App Router Route Handlers)

**File layout:** `app/api/<resource>/route.ts`

**Request/Response envelope** (MUST be used everywhere):

```ts
// lib/http.ts
export type ApiSuccess<T> = { ok: true; data: T; meta?: Record<string, unknown> };
export type ApiError = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiSuccess<T> {
  return { ok: true, data, meta };
}
export function err(code: string, message: string, details?: unknown): ApiError {
  return { ok: false, error: { code, message, details } };
}
```

**Standard error codes (prefix with `E_`)**

* `E_VALIDATION`, `E_UNAUTHORIZED`, `E_FORBIDDEN`, `E_NOT_FOUND`, `E_CONFLICT`, `E_RATE_LIMIT`, `E_INTERNAL`.

**HTTP status mapping**

* 200/201 success; 400 validation; 401/403 authz; 404 missing; 409 conflict; 429 throttled; 500 internal.

**Pagination (cursor-based)**

* Query: `?cursor=<opaque>&limit=50` (default 50, max 100).
* Response `meta.cursor` for the next page or omit if none.

**Example route**

```ts
// app/api/todos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/http";
import { nowSg, toUtcIso } from "@/lib/timezone";
import { createId } from "@/lib/id";
import { validate } from "@/lib/validate";

export async function GET(req: NextRequest) {
  try {
    const rows = db.prepare(
      "SELECT id, title, description, priority, dueAt, completed, createdAt, updatedAt FROM todos WHERE deletedAt IS NULL ORDER BY createdAt DESC LIMIT 100"
    ).all();
    return NextResponse.json(ok(rows));
  } catch (e) {
    return NextResponse.json(err("E_INTERNAL", "Unexpected error"), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = validate(body, {
      title: ["string", { min: 1, max: 200 }],
      description: ["string", { optional: true, max: 2000 }],
      priority: ["enum", ["low", "medium", "high"]],
      dueAt: ["iso", { optional: true }], // UTC ISO string or omitted
    });
    if (!parse.ok) return NextResponse.json(err("E_VALIDATION", "Invalid input", parse.errors), { status: 400 });

    const id = createId();
    const nowIso = toUtcIso(nowSg());

    db.prepare(
      `INSERT INTO todos (id, title, description, priority, dueAt, completed, createdAt, updatedAt)
       VALUES (@id, @title, @description, @priority, @dueAt, 0, @now, @now)`
    ).run({ id, ...parse.data, now: nowIso });

    const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
    return NextResponse.json(ok(todo), { status: 201 });
  } catch (e) {
    return NextResponse.json(err("E_INTERNAL", "Unexpected error"), { status: 500 });
  }
}
```

**CORS:** same-origin. If exposing public APIs later, define explicit CORS allowlist in this core.

**Idempotency:** For create endpoints that clients might retry, support an optional `Idempotency-Key` header (store short-lived key in SQLite and reject duplicates with 409).

---

## 7) Validation Conventions

* Keep validation centralized in `lib/validate.ts` (simple hand-rolled or Zod—pick one and be consistent). The index doesn’t require a library; **a minimal schema helper is acceptable**.

**Minimal helper example**

```ts
// lib/validate.ts
export function validate<T extends Record<string, unknown>>(input: any, schema: Record<string, any>) {
  // Implement strict checks as needed. Return { ok: true, data } or { ok: false, errors }.
  // For brevity here; real implementation should produce field-level errors.
  return { ok: true, data: input } as const;
}
```

**Error messages** MUST be short, user-friendly, and not leak internals.

---

## 8) Auth & Security (WebAuthn + JWT)

* **Registration/Login:** Implement with `@simplewebauthn` per feature PRP 11.
* **Session:** After login, issue short-lived JWT (HTTP-only secure cookie).
* **API protection:** Protected routes MUST verify JWT. Public routes (if any) must be explicitly documented.
* **Dev mode:** Until Auth is shipped, a **DEV fallback** MAY set `req.user = { id: 'dev-user' }` behind `NODE_ENV!=='production'` only.
* **Rate limiting:** Recommend basic per-IP limit for write endpoints (e.g., 60/min). Store counters in SQLite.

---

## 9) UI/UX Conventions (Client Components)

* **Optimistic UI**: For CRUD, optimistically update lists; on failure, rollback and toast an error.
* **State**: Prefer local state + SWR-style invalidation; keep global stores minimal.
* **Empty/Loading/Error**: Every list/detail view MUST implement all three states.
* **A11y**: Keyboard-focusable controls, `aria-*` for checklists and calendars.
* **Color tokens** (priority badges):

  * high → red-*, medium → amber-*, low → slate-* (exact Tailwind shades defined in the UI kit).

---

## 10) Testing Baseline

**Playwright (E2E) MUST cover:**

* Happy-path CRUD (create/read/update/delete).
* Timezone-sensitive scenarios: due‑today (SG), crossing midnight SG.
* Auth flow (once implemented): register, login, protected route access.
* Accessibility smoke: tab traversal to key controls.
* Dedicated spec per feature PRP stored under `tests/` (e.g., `tests/01-todo-crud-operations.spec.ts` → `tests/11-authentication-webauthn.spec.ts`) plus shared helpers in `tests/helpers.ts`.
* Configure Playwright to use the Singapore timezone (`timezone: 'Asia/Singapore'`) and virtual WebAuthn authenticators for Feature 11 specs.
* Maintain three consecutive green runs in CI before a feature is marked `Verified` in evaluation tracking.

**Unit tests SHOULD cover:**

* Time utilities (`lib/timezone.ts`) edge cases.
* Validation (`lib/validate.ts`) positive/negative cases.
* API handlers: validation failure, not found, success.
* Progress, ID remapping, and date-math helpers introduced by feature PRPs (subtask progress, export/import remapping, recurrence calculators, reminder lead-time math).

**Fixtures:** Reuse a clean DB per test run (create a temp SQLite file in `tmp/`).
Provide seeds for 1) baseline todos (mix of priorities/tags), 2) SG holidays, and 3) authentication mocks. Clean up generated files post-test to keep CI idempotent.

---

## 11) Performance, Accessibility & Browser Budgets

**Frontend**
- First contentful paint < 1 s, time to interactive < 3 s, total page load < 2 s on mid-tier hardware.
- Todo mutations, reminder scheduling, and template instantiation resolve < 500 ms end-to-end; search/filter updates respond < 100 ms.
- Virtualize or paginate when rendering > 100 todos; default list page size 50 items.
- Bundle (gzipped) stays < 500 KB per route; lazy-load non-critical components (calendar, template gallery, reminder drawers).

**Backend**
- Average API response < 300 ms; 95th percentile < 500 ms for heavy endpoints (calendar, export preview).
- Use prepared statements everywhere; avoid N+1 queries by pre-joining tags/subtasks when feasible.
- Implement indexes on foreign keys, `dueAt`, and high-cardinality filters (`priority`, `completed` per evaluation checklist).

**Database**
- Keep SQLite file size < 100 MB for 10k todos; vacuum during maintenance if exceeded.
- Enforce WAL mode and short transactions; long-running jobs (export/import) stream results to avoid locking.
- Maintain covering indexes defined by feature PRPs (tags, subtasks, reminders) and audit them quarterly.

**Accessibility**
- Achieve Lighthouse accessibility score ≥ 90 on key routes (`/`, `/calendar`, `/login`).
- Ensure WCAG AA color contrast, visible focus rings, ARIA labels for interactive elements, and keyboard navigability for modals, lists, and drag/drop alternatives.
- Provide screen-reader announcements for optimistic mutations (todo created, reminder scheduled) via polite live regions.

**Browser & Device Support**
- Verify core flows in latest Chrome/Edge (Chromium), Firefox, Safari (desktop), and Chrome/Safari (mobile).
- Validate WebAuthn on supported browsers (including virtual authenticator in CI) and gracefully degrade when unavailable.
- Ensure responsive layouts for breakpoints ≥320 px; calendar view switches to agenda summary on narrow widths.

---

## 12) Observability & Logging

* Log **errors only** in production (PII-free). Dev may log debug.
* Include `traceId` (random) per request for correlation across client ↔ server.

---

## 13) Canonical PRP Template (Paste into new feature PRPs)

```md
# Feature: <Name>

## Feature Overview
Why this exists. SG timezone notes if relevant.

## User Stories & User Flow
- As a <role>, I want…
Flow diagram or steps.

## Technical Requirements
- DB schema (tables/columns, default columns from Core).
- API routes (paths, verbs, request/response using Core envelope).
- Types/interfaces.
- Validation rules (ref Core).
- Timezone logic (ref Core helpers).
- Performance constraints.

## UI Components
States, props, examples, priority colors if relevant.

## Edge Cases
List unusual scenarios and exact handling.

## Acceptance Criteria
- Checklist of verifiable outcomes (use Core error codes & envelope).

## Testing Requirements
Playwright scenarios + unit tests (time matrix when applicable).

## Out of Scope
Explicitly excluded features.

## Success Metrics
- Adoption/latency/error-rate targets.
- Document latest unit/E2E test run identifiers (CI job URL or timestamp) when marking features complete.
- Capture accessibility (Lighthouse) and performance audit results in the associated PRP or release checklist entry.
```

---

## 14) Change Management

* Any change to API envelope, error codes, timezone utilities, or DB defaults MUST be updated here first, then reflected in impacted PRPs.
* Record changes in a short **Changelog** at the end of this doc.

---

## 15) Core Acceptance Criteria (for every feature PRP & implementation)

* Uses **Core API envelope** and **Core error codes**.
* Stores timestamps as **UTC ISO**, computes & displays in **SG zone** using `lib/timezone.ts`.
* Tables include **default columns** and respect **soft delete**.
* Implements **empty/loading/error** UI states.
* Provides **Playwright** E2E and **unit tests** per this baseline.
* Respects **auth** and **rate limiting** conventions (or explicitly documents exceptions).

---

## 16) Out of Scope (Core)

* Feature-specific fields, recurrence math details, calendar rendering specifics, etc. (See respective feature PRPs.)

---

## 17) Changelog (brief)

* **2025-11-12:** Initial version created.
* **2025-11-13:** Added environment catalog, cascade expectations, expanded testing/performance budgets, and documentation guidance per evaluation checklist.
