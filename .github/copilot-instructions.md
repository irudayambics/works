# Todo App - AI Agent Instructions

## Architecture Overview

This is a **Next.js 16** todo application with WebAuthn authentication, using **better-sqlite3** for data persistence and **Playwright** for E2E testing. All operations use **Singapore timezone** (`Asia/Singapore`).

### Core Stack
- **Frontend**: Next.js App Router, React 19, Tailwind CSS 4
- **Backend**: Next.js API routes (no separate server)
- **Database**: SQLite via `better-sqlite3` (`todos.db` in project root)
- **Auth**: WebAuthn/Passkeys with JWT sessions (no passwords)
- **Testing**: Playwright E2E tests

## Critical Patterns

### 1. Authentication Flow
- **WebAuthn only** - no traditional passwords
- Session tokens stored as HTTP-only cookies via `lib/auth.ts`
- Middleware (`middleware.ts`) protects `/` and `/calendar` routes
- When modifying authenticator logic, **always use `?? 0` for counter field** to handle undefined values:
  ```typescript
  counter: authenticator.counter ?? 0
  ```

### 2. Database Architecture
**Single source of truth**: `lib/db.ts` exports all database interfaces and CRUD operations.

Key tables:
- `users` → `authenticators` (one-to-many)
- `users` → `todos` → `subtasks` (one-to-many)
- `todos` ↔ `tags` (many-to-many via `todo_tags`)
- `users` → `templates` (reusable todo patterns)
- `holidays` (Singapore public holidays, timezone-aware)

**When adding database features:**
- Add interface to `lib/db.ts` first
- Export DB object with CRUD methods (e.g., `todoDB`, `tagDB`)
- Use prepared statements for all queries
- Handle migrations with try-catch `ALTER TABLE` blocks

### 3. Singapore Timezone (Mandatory)
All date/time operations **must** use `lib/timezone.ts`:
```typescript
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone';
const now = getSingaporeNow(); // NOT new Date()
```
This applies to: due dates, reminders, recurring todos, holiday calculations.

### 4. API Route Patterns
All API routes follow this structure:
```typescript
export async function GET/POST/PUT/DELETE(request: NextRequest) {
  const session = await getSession(); // Always check auth first
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  
  // For routes with params:
  const { id } = await params; // params is a Promise in Next.js 16
  
  // Use session.userId for all DB queries
}
```

### 5. Feature-Rich Todo Model
Todos support: priority (high/medium/low), recurring patterns (daily/weekly/monthly/yearly), reminders (15m/30m/1h/2h/1d/2d/1w before), subtasks with progress tracking, and tags.

**When completing recurring todos**: Create next instance with same priority, tags, reminder offset, and recurrence pattern. See `app/api/todos/[id]/route.ts` PUT handler.

## Development Workflows

### Setup & Run
```bash
npm install
npm run dev           # Start dev server on :3000
npm run build         # Production build
npm run lint          # ESLint check
```

### Testing
```bash
npx playwright test                    # Run all E2E tests
npx playwright test --ui              # Interactive UI mode
npx playwright test tests/02-todo-crud.spec.ts  # Single test file
npx playwright show-report            # View HTML report
```
Tests use virtual WebAuthn authenticators (enabled via Chromium flags in `playwright.config.ts`).

### Database Management
```bash
# Seed Singapore holidays
npx tsx scripts/seed-holidays.ts

# Inspect database (SQLite CLI)
sqlite3 todos.db
```

## Project-Specific Conventions

### 1. Client vs Server Components
- Main pages (`app/page.tsx`, `app/calendar/page.tsx`) are `'use client'` - they manage state and fetch from API routes
- API routes handle all database operations server-side
- Never import `lib/db.ts` directly in client components

### 2. Error Handling in API Routes
Always use null coalescing for potentially undefined database fields:
```typescript
counter: authenticator.counter ?? 0
reminder_minutes: todo.reminder_minutes ?? null
```
Recent fix: `app/api/auth/login-verify/route.ts` lines 56 and 93.

### 3. Testing Approach
Tests are organized by feature (01-authentication, 02-todo-crud, etc.) mirroring `USER_GUIDE.md` sections. Helper class (`tests/helpers.ts`) provides reusable methods like `createTodo()`, `addSubtask()`, `createTag()`.

### 4. Type Safety
Shared types live in `lib/db.ts` and are imported in both API routes and client components:
```typescript
import { Priority, RecurrencePattern, Todo, Template } from '@/lib/db';
```

## Key Integration Points

### Notification System
- Browser notifications use `lib/hooks/useNotifications.ts` hook
- Backend checks due reminders via `app/api/notifications/check/route.ts`
- Frontend polls this endpoint and triggers browser notifications
- Respects `last_notification_sent` to prevent duplicates

### Template System
- Templates in `templates` table store todo patterns with JSON-serialized subtasks
- `POST /api/templates/[id]/use` creates todo from template, calculating due date from offset
- Subtasks JSON structure: `[{ title: string, position: number }]`

### Export/Import
- `GET /api/todos/export` returns JSON with todos, subtasks, and tags
- `POST /api/todos/import` accepts same format, remaps IDs, preserves relationships

## Common Pitfalls

1. **Don't use `new Date()` directly** - always use `getSingaporeNow()` from `lib/timezone.ts`
2. **params is async in Next.js 16** - use `const { id } = await params`
3. **Database fields can be null/undefined** - use `?? 0` or `|| null` when passing to functions
4. **Recurring todos need special handling** - see PUT `/api/todos/[id]` for completion logic
5. **WebAuthn credentials use base64/base64url encoding** - buffer conversions required

## File Reference

- **Auth**: `lib/auth.ts`, `middleware.ts`, `app/api/auth/**`
- **Database**: `lib/db.ts` (single file, ~700 lines)
- **Timezone**: `lib/timezone.ts`
- **Main UI**: `app/page.tsx` (~2200 lines, feature-rich)
- **API Routes**: `app/api/**/*.ts` (RESTful structure)
- **Tests**: `tests/*.spec.ts`, `tests/helpers.ts`
- **Documentation**: `USER_GUIDE.md` (comprehensive 2000+ line feature guide)
