> **Project Context — Todo App**
> We are building a feature-complete, Singapore-timezone-first task manager in Next.js 16.
> Each PRP defines one features behavior and **references `00-core-prp.md`** for cross-cutting rules (API envelope, error codes, DB defaults, auth, testing).
> Goal: fast capture, predictable reminders/due-dates in SG time, clean UI, and testable behavior.

# PRP: Search & Filtering

## Feature Overview
Enable fast, reliable discovery of todos through real-time text search, tag-aware filtering, and compound criteria while respecting the conventions in `00-core-prp.md`. Depends on 01: Todo CRUD, 02: Priority System, and 06: Tag System; scheduled for Phase 3 (Organization). The feature delivers responsive UI feedback, leverages SQLite FTS for relevance scoring, and keeps all API behavior wrapped in the shared `ok/err` envelope.

## User Stories

### As a user
- I want to type in a search box and instantly see todos that match the text so I can find items without scrolling.
- I want to combine filters like priority, due range, completion, and tags so I can narrow results to exactly what I need.
- I want searches to persist in the URL so I can refresh or share a filtered view.
- I want clear states when no results or errors occur so I know what to do next.
- I want search to feel fast even on my mobile device so I keep using the app for daily planning.

## User Flow

### Real-Time Text Search
1. UI displays the search bar with placeholder copy and keyboard shortcut hint (`/`).
2. User types a query; UI debounces input and issues `GET /api/todos` with `q` after 200 ms idle.
3. System validates query, executes FTS-backed search, and returns paginated results.
4. UI updates results list, highlights matching terms, and preserves scroll position.

### Multi-Criteria Filtering
1. UI renders filter panel with chips for priority, completion toggle, due date range, and tag picker.
2. User selects filters; UI updates URL search params and triggers refetch.
3. System applies server-side filters (priority, completion, due range, tags) and returns cursor-based page.
4. UI shows applied filters summary, enabling quick removal and combination.

### Persisted & Shared Views
1. UI reflects current query state in URL (e.g., `?q=invoice&priority=high&tags=finance,urgent`).
2. User reloads or shares the URL; on mount, UI hydrates filter state from search params.
3. System replays same query, ensuring consistent data.
4. UI shows a saved search banner with option to “clear all”.

### Zero / Error States
1. System returns empty dataset.
2. UI presents zero-state illustration with suggestions to broaden search.
3. If API returns error, UI shows inline banner with retry CTA; previous results remain cached until replaced.

## Technical Requirements

### Database Schema
- Continue using `todos` defaults from `00-core-prp.md` (UUID PK, soft delete, UTC timestamps).
- Introduce dedicated search cache table plus FTS virtual table to support relevance scoring.

```sql
CREATE TABLE IF NOT EXISTS todoSearch (
  todoId TEXT PRIMARY KEY REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  updatedAt TEXT NOT NULL -- UTC ISO mirror of todos.updatedAt
);

CREATE VIRTUAL TABLE IF NOT EXISTS todoSearch_fts USING fts5(
  todoId UNINDEXED,
  title,
  description,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS trg_todo_search_insert
AFTER INSERT ON todos
WHEN NEW.deletedAt IS NULL
BEGIN
  INSERT INTO todoSearch (todoId, title, description, updatedAt)
  VALUES (NEW.id, NEW.title, NEW.description, NEW.updatedAt);
  INSERT INTO todoSearch_fts (rowid, todoId, title, description)
  VALUES ((SELECT rowid FROM todoSearch WHERE todoId = NEW.id), NEW.id, NEW.title, NEW.description);
END;

CREATE TRIGGER IF NOT EXISTS trg_todo_search_update
AFTER UPDATE ON todos
BEGIN
  DELETE FROM todoSearch WHERE todoId = NEW.id;
  DELETE FROM todoSearch_fts WHERE todoId = NEW.id;
  CASE WHEN NEW.deletedAt IS NULL THEN
    INSERT INTO todoSearch (todoId, title, description, updatedAt)
    VALUES (NEW.id, NEW.title, NEW.description, NEW.updatedAt);
    INSERT INTO todoSearch_fts (rowid, todoId, title, description)
    VALUES ((SELECT rowid FROM todoSearch WHERE todoId = NEW.id), NEW.id, NEW.title, NEW.description);
  END;
END;

CREATE INDEX IF NOT EXISTS idx_todos_dueAt_active
  ON todos(dueAt)
  WHERE deletedAt IS NULL;

CREATE INDEX IF NOT EXISTS idx_todos_priority_completed
  ON todos(priority, completed)
  WHERE deletedAt IS NULL;
```

### API Endpoints
All routes live under `app/api/todos` and must use `ok`/`err` from the core PRP.

#### `GET /api/todos`
**List with Search & Filters**
- Input (query params):
  ```typescript
  type TodoListQuery = {
    cursor?: string; // encrypted JSON containing last id, dueAt, priority, filters
    limit?: string; // parsed to number, default 20, max 50
    q?: string; // UTF-8 text, max 200 chars
    priority?: 'low' | 'medium' | 'high';
    completed?: 'true' | 'false';
    tags?: string; // comma-separated tag ids from Tag System
    dueFrom?: string; // ISO or YYYY-MM-DD (SG local)
    dueTo?: string;   // same as dueFrom
  };
  ```
- Output: `ok<{ items: TodoResult[] }>` with `meta.cursor` when more results exist.
- Behavior: combines FTS rank, tag joins, and deterministic ordering (priority DESC, dueAt ASC, createdAt DESC) limited to authenticated user’s todos once auth lands.
- Sample error messages: `err('E_VALIDATION', "Query too long")`, `err('E_VALIDATION', "Invalid due date range")`.

#### `GET /api/todos/suggest`
**Typeahead Suggestions**
- Input (query params):
  ```typescript
  type SuggestQuery = {
    q: string; // required, max 100 chars
    limit?: string; // default 5, max 10
  };
  ```
- Output: `ok<{ suggestions: Array<{ todoId: string; title: string }> }>`.
- Behavior: returns top matches based on FTS rank; used for quick navigation.
- Errors: `E_VALIDATION` on empty query, `E_RATE_LIMIT` when >30 requests/minute per user (backed by in-memory token bucket).

#### `POST /api/todos/search/saved`
**Persist Saved Filters** (optional but recommended)
- Input body:
  ```typescript
  interface SaveSearchPayload {
    name: string; // 1-60 chars
    config: {
      q?: string;
      priority?: 'low' | 'medium' | 'high';
      completed?: boolean;
      tagIds?: string[];
      dueFrom?: string; // ISO
      dueTo?: string;   // ISO
    };
  }
  ```
- Output: `ok<{ savedSearchId: string; createdAt: string }>`.
- Validation: duplicates by same user + identical config return `E_CONFLICT`.
- Persistence: new `savedSearches` table (inherits Core default columns).

##### Example Next.js route handler (`app/api/todos/route.ts` extract)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/http';
import { nowSg, parseSg, toUtcIso } from '@/lib/timezone';
import { decodeCursor, encodeCursor, applyFilters } from '@/lib/todos/search';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(searchParams);
    if (!validation.ok) {
      return NextResponse.json(err('E_VALIDATION', validation.error), { status: 400 });
    }
    const { filters, limit } = validation.value;
    const rows = runSearchQuery(db, filters, limit + 1); // sync better-sqlite3 call
    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? encodeCursor(rows.at(-1)!) : undefined;
    return NextResponse.json(ok({ items }, nextCursor ? { cursor: nextCursor } : undefined));
  } catch (error) {
    console.error('todo.search', { error });
    return NextResponse.json(err('E_INTERNAL', 'Unable to search todos'), { status: 500 });
  }
}
```

### Types & Interfaces
```typescript
interface TodoResult {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  dueAt: string | null; // UTC ISO persisted
  completed: boolean;
  tags: Array<{ id: string; name: string; color: string }>;
  score?: number; // optional FTS rank for debugging
}

interface SearchFilters {
  text?: string;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
  tagIds?: string[];
  dueFromUtc?: string | null;
  dueToUtc?: string | null;
  cursor?: string;
  limit: number;
}
```

### Validation Rules
**q**
- Optional; when present, trim, collapse whitespace, length 2-200 characters.
- Reject disallowed characters (control chars) with `E_VALIDATION` (“Query contains invalid characters”).

**tags**
- Optional CSV; each tag id must be UUID format supplied by Tag System.
- Reject unknown tag ids with `E_NOT_FOUND`.

**dueFrom / dueTo**
- Optional; accept SG-local `YYYY-MM-DD` or ISO string.
- Convert via `parseSg`, persist as UTC using `toUtcIso`.
- `dueFrom` must be <= `dueTo`; else `E_VALIDATION` (“Due range is invalid”).

**cursor**
- Base64-encoded JSON; decode using `safeJsonParse`. Invalid cursor returns `E_VALIDATION`.

**limit**
- Default 20; min 1, max 50. Over limit returns `E_VALIDATION` (“Limit must be between 1 and 50”).

**name** (saved search)
- Required 1-60 chars; unique per user (case-insensitive). Duplicate triggers `E_CONFLICT` (“Saved search already exists”).

### Timezone Logic
- All date filtering uses helpers from `lib/timezone.ts` defined in the core PRP.
- Convert user-supplied `dueFrom`/`dueTo` with `parseSg`, clamp to start/end of day via `startOfDaySg`/`endOfDaySg`, then convert to UTC with `toUtcIso` before querying.
- When highlighting “Due today” filters, compute relative comparisons using `nowSg()` to avoid UTC midnight drift.

### Performance Constraints & Pagination
- `GET /api/todos` must respond ≤120 ms for 1k active todos with mixed filters.
- Use LIMIT/OFFSET avoided; rely on cursor containing `dueAt` + `id` to keep pagination stable.
- FTS queries must leverage `bm25(todoSearch_fts)` to rank; restrict to 50 results per page to cap CPU.
- Client debounces search input to 200 ms; aborts in-flight fetch requests when a new search starts.

## UI Components
- **SearchInput** (`<SearchInput value onChange onClear isLoading error>`)
  - States: idle, searching (spinner), error (red underline + tooltip).
  - Keyboard: `/` focuses input, `Esc` clears.
- **FilterPanel** (`<FilterPanel value onChange availableTags>`)
  - Renders priority chips using Tailwind tokens (`bg-red-500`, `bg-amber-500`, `bg-slate-500`) from Priority System.
  - Tag selector uses combobox pattern with async suggestions.
- **ResultsList** (`<ResultsList todos isLoading isEmpty error highlightTerms>`)
  - Displays skeleton rows during initial load; virtualization recommended for >100 items.
- **FilterChipsBar** shows applied filters with dismiss icons.
- **SavedSearchDropdown** lists saved searches and fallback “Manage saved searches”.
- **EmptyStateCard** & **ErrorBanner** provide messaging.

### Empty / Loading / Error States
- Loading: shimmer skeleton for list + disabled filters.
- Empty (no matches): illustration + “No todos match these filters” + “Clear filters” button.
- Error: inline banner with retry; keep last successful data cached.

### Optimistic Behavior
- Saving a search optimistically adds entry to dropdown; revert if API fails.
- Removing a filter is instant client-side; server response reconciles on completion.

### React Snippet (search input with debounced fetch)
```tsx
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function TodoSearchBar({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(window.location.search);
        if (query.length >= 2) {
          params.set('q', query.trim());
        } else {
          params.delete('q');
        }
        router.replace(`?${params.toString()}`);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, router]);

  return (
    <div className="relative">
      <input
        className="w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm"
        placeholder="Search todos..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isPending && <span className="absolute right-3 top-2 text-sm text-slate-400">Searching…</span>}
    </div>
  );
}
```

## Edge Cases
- Search query below 2 chars: UI blocks request, shows helper message.
- Cursor tampering: server returns `E_VALIDATION`; UI clears cursor and refetches with safe defaults.
- Tag filter referencing deleted tag: server drops filter and returns warning in `meta` (log for telemetry).
- Due date range spanning timezone midnight: `parseSg` ensures consistent start/end boundaries.
- FTS result containing long description: truncate to 200 chars with ellipsis on UI.
- Saved search deleted elsewhere: dropdown detects 404, removes entry client-side.

## Acceptance Criteria
- [ ] Typing a 3+ character query triggers debounced search and updates results within 300 ms perceived time.
- [ ] Combining priority, completion, due range, and tags sends correct query params and returns expected set.
- [ ] URL reflects active filters and rehydration on reload matches server output.
- [ ] Empty, loading, and error states render according to design and core conventions.
- [ ] FTS ranking prioritizes title matches over description; manual QA spot-check passes for common samples.
- [ ] Saved search creation persists config, appears in dropdown, and is reusable.
- [ ] API responses use `ok/err` shape with accurate error codes and HTTP statuses.

## Testing Requirements

### E2E Tests (Playwright)
`tests/08-search-filtering.spec.ts`
- [ ] `should display results for text query "invoice"`
- [ ] `should combine high priority and tag filters`
- [ ] `should persist filters across reload`
- [ ] `should show empty state when no matches`
- [ ] `should handle invalid cursor by resetting pagination`
- [ ] `should respect due today filter using SG timezone`
- [ ] `should create and reuse saved search`

**Example test snippet**
```ts
test('should respect due today filter using SG timezone', async ({ page }) => {
  await page.goto('/todos');
  await page.getByRole('button', { name: 'Due today' }).click();
  await expect(page).toHaveURL(/dueFrom=/);
  const cards = page.getByTestId('todo-card');
  await expect(cards).toHaveCount(2);
  await cards.all(async (card) => {
    await expect(card).toContainText('Due Today (SG)');
  });
});
```

### Unit Tests
- `lib/todos/search.test.ts`: cursor encoding/decoding, FTS ranking fallback, filter composition.
- `lib/todos/validate-search.test.ts`: validation of query params, due range, tag IDs.
- `app/api/todos/route.test.ts`: ensures correct SQL bindings per filter combination (Vitest with better-sqlite3 in-memory DB).
- `components/TodoSearchBar.test.tsx`: debounce behavior, URL updates.

### Fixtures & Mocks
- Seed test DB with todos covering combinations of priority, tags, completion, and due dates (including SG midnight boundaries).
- Provide mock Tag API responses for component tests.
- Use timezone helper mocks to pin `nowSg()` to fixed DateTime during tests.

## Out of Scope
- Cross-collection search (e.g., tags, templates) beyond todos.
- Natural-language date parsing beyond fixed ranges (`today`, `tomorrow`).
- Offline caching of search results.
- Role-based visibility rules (deferred until auth enforced in PRP 11).

## Success Metrics
- ≥70% of sessions with ≥5 todos use search/filter at least once per week.
- API median response time for search endpoints ≤120 ms; 95th percentile ≤200 ms.
- Error rate (`E_INTERNAL` or `E_VALIDATION`) stays below 1% of total queries.
- Saved search reuse rate ≥40% within first month of feature launch.
