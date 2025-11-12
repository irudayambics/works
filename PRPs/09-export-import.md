> **Project Context — Todo App**
> We are building a feature-complete, Singapore-timezone-first task manager in Next.js 16.
> Each PRP defines one feature’s behavior and **references `00-core-prp.md`** for cross-cutting rules (API envelope, error codes, DB defaults, auth, testing).
> Goal: fast capture, predictable reminders/due-dates in SG time, clean UI, and testable behavior.

# PRP: Export & Import

## Feature Overview
Provide secure backup and restore flows for todos, preserving relationships and metadata across features shipped to date. The feature depends on 01: Todo CRUD and 06: Tag System (for tag linkage), and ships in Phase 4 (Productivity). It leverages the shared patterns in `00-core-prp.md` for API envelopes, timezone helpers, auth, and testing.

## User Stories & User Flow

### User Stories
- I want to export my todos (with tags, priorities, due dates) to JSON so I can back up my data.
- I want to import a JSON backup and have IDs remapped without creating duplicates so restored data is consistent.
- I want clear feedback if the import file is invalid or incomplete so I trust the system.
- I want export/import to respect my Singapore-local due dates so recurring planning stays accurate after restore.
- I want to review what changed during import so I can verify nothing was lost.

### User Flow

#### Initiate Export
1. UI shows “Export data” button in settings drawer.
2. User clicks button; UI opens confirmation modal summarizing scope.
3. System issues `POST /api/export` to create job; job assembles JSON and returns download link.
4. UI shows toast and automatically downloads file when ready; modal displays status.

#### Import Backup
1. UI exposes file picker with drag-and-drop in import drawer.
2. User selects `.json` backup; UI validates size (<5 MB) client-side and shows summary preview.
3. System uploads via `POST /api/import` (multipart) and starts dry-run validation.
4. System responds with validation summary (counts, conflicts) and awaits user confirmation via `POST /api/import/commit`.
5. Upon commit, system remaps IDs, inserts/updates rows inside transaction, and returns report.
6. UI shows results (created, updated, skipped items) and prompts to refresh list.

#### View Import History
1. UI lists previous import jobs with status in settings.
2. User selects job; UI fetches `GET /api/import/:id` for audit details.
3. System returns metadata (counts, timestamps); UI renders diff summary.

## Technical Requirements

### Database Schema
Apply default columns from `00-core-prp.md` (UUID primary keys, UTC `createdAt/updatedAt`, optional `deletedAt`).

```sql
-- Stores export job metadata and download payload reference
CREATE TABLE IF NOT EXISTS exportJobs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','ready','failed')),
  filePath TEXT,
  meta TEXT NOT NULL, -- JSON string with counts, startedAt, completedAt
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

-- Tracks import attempts, validation outcomes, and final counts
CREATE TABLE IF NOT EXISTS importJobs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('validating','awaiting_commit','completed','failed')),
  sourceFileName TEXT NOT NULL,
  sourceChecksum TEXT NOT NULL,
  summary TEXT NOT NULL, -- JSON string: counts, warnings, conflicts
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_exportJobs_user_status ON exportJobs(userId, status) WHERE deletedAt IS NULL;
CREATE INDEX IF NOT EXISTS idx_importJobs_user_status ON importJobs(userId, status) WHERE deletedAt IS NULL;
```

When import commits, affected base tables (`todos`, `todoTags`, `tags`, etc.) MUST continue to respect existing indices from dependent PRPs.

### API Endpoints
All endpoints live under `app/api/export` and `app/api/import` folders and MUST return `ok`/`err` as defined in the core PRP.

#### `POST /api/export`
**Create Export Job**
- Input body:
  ```typescript
  interface ExportRequestBody {
    includeCompleted?: boolean; // default true
    includeDeleted?: boolean; // default false, soft-deleted rows excluded by default
  }
  ```
- Output: `ok<{ jobId: string; downloadUrl?: string }>`; `downloadUrl` provided once job is ready.
- Behavior: synchronously build JSON when record count < 5k, else enqueue lightweight worker (Edge-compatible) but still respond with `jobId`.
- Sample errors:
  - `err('E_CONFLICT', 'Export already in progress')`
  - `err('E_INTERNAL', 'Failed to prepare export')`

#### `GET /api/export/:id`
**Download Export Payload**
- Input: path param `id` referencing job; optional `token` query for signed download.
- Output: Attachment stream (`application/json`) or `err('E_NOT_FOUND', 'Export job not ready')`.
- Validation: Ensure job belongs to requesting user.

#### `POST /api/import`
**Upload and Validate Backup**
- Input: multipart/form-data with `file` (`application/json`) and optional `mode` (`dry-run` | `auto-commit`).
- Output: `ok<{ jobId: string; summary: ImportSummary; requiresCommit: boolean }>`.
- Behavior: Parse JSON, validate schema & version, compute checksum, record in `importJobs` with `status='awaiting_commit'` unless `auto-commit`.
- Sample errors:
  - `err('E_VALIDATION', 'File must be JSON')`
  - `err('E_RATE_LIMIT', 'Too many imports today')`

#### `POST /api/import/commit`
**Apply Validated Import**
- Input body: `{ jobId: string; allowOverwrite?: boolean }`.
- Output: `ok<{ created: number; updated: number; skipped: number }>`.
- Behavior: Within transaction, remap IDs via `createId()`, update references (`todoTags` join table), backfill `createdAt`/`updatedAt`, set `deletedAt=NULL` for restored rows.
- Errors: `err('E_NOT_FOUND', 'Import job expired')`, `err('E_CONFLICT', 'Import already completed')`.

#### `GET /api/import/:id`
**Fetch Import Job Summary**
- Output: `ok<{ status: string; summary: ImportSummary; createdAt: string; updatedAt: string }>`.
- Errors: `err('E_NOT_FOUND', 'Import job not found')`.

##### Example Next.js route handler (`app/api/import/commit/route.ts` excerpt)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/http';
import { createId } from '@/lib/id';
import { applyImport } from '@/lib/import/engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateCommitPayload(body);
    if (!validation.ok) {
      return NextResponse.json(err('E_VALIDATION', validation.error), { status: 400 });
    }
    const result = db.transaction(applyImport)(validation.value);
    return NextResponse.json(ok(result));
  } catch (error) {
    console.error('import.commit', { error });
    return NextResponse.json(err('E_INTERNAL', 'Unable to complete import'), { status: 500 });
  }
}
```

### Types & Interfaces
```typescript
interface ExportPayload {
  version: '2025-11-Phase4';
  generatedAt: string; // UTC ISO
  todos: Array<ExportTodo>;
  tags?: Array<ExportTag>;
  relationships: {
    todoTags: Array<{ todoId: string; tagId: string }>;
  };
}

interface ExportTodo {
  id: string;
  legacyId?: string; // preserved for re-linking but overwritten on import
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  dueAt: string | null; // UTC ISO
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ImportSummary {
  version: string;
  totals: { todos: number; tags: number; todoTags: number };
  warnings: string[];
  conflicts: Array<{ type: 'todo' | 'tag'; legacyId: string; reason: string }>;
}
```

### Validation Rules
**file (import)**
- Required; max 5 MB; MIME must be `application/json`.
- Non-JSON content returns `E_VALIDATION` with message “Upload must be a JSON export file”.

**payload.version**
- Must match supported list (`2025-11-Phase4`); others return `E_VALIDATION` (“Unsupported export version”).

**todos[]**
- Title length 1-200, priority enum enforced, `dueAt` must be valid ISO string and convertible via `fromUtcIso`.
- Duplicate legacy IDs trigger warning and dedup with `allowOverwrite` gate.

**tags[]**
- Name length 1-60; color token validated against design palette.

**relationships.todoTags[]**
- Referenced IDs must exist in payload; else `E_VALIDATION` (“todoTags entry references missing todo/tag”).

**allowOverwrite**
- Default false; when false, matching existing todo by title+dueAt results in skip, recorded in summary.

### Timezone Logic
- Export serializes `dueAt` exactly as stored (UTC ISO) and includes `generatedAt` using `toUtcIso(nowSg())`.
- Import converts any local-only date strings (legacy exports) via `parseSg` prior to persistence.
- Deduping comparisons (e.g., due today) use `startOfDaySg`/`endOfDaySg` to align across time boundaries.

### Performance Constraints & Pagination
- Export jobs must finish within 2 seconds for up to 5k todos; stream response to avoid memory pressure.
- Import validation limited to 5 MB payloads; reject larger files client-side and server-side.
- Rate limit: max 3 export jobs and 3 import jobs per user per hour (`E_RATE_LIMIT`).
- Job history pagination uses cursor-based `GET /api/import?cursor=...&limit=20` (optional extension).

## UI Components
- **ExportDialog** (`<ExportDialog isOpen onClose onSubmit status downloadUrl includeCompleted includeDeleted>`)
  - Shows status badge (pending, ready, failed) with Tailwind tokens (`bg-emerald-500`, `bg-amber-500`, `bg-rose-500`).
- **ImportDrawer** (`<ImportDrawer isOpen onClose onFileSelect summary onCommit>`)
  - Displays drag-and-drop zone, file metadata, validation summary table.
- **ImportSummaryTable** (`<ImportSummaryTable summary allowOverwrite onToggleOverwrite>`)
  - Highlights warnings and conflicts with accessible badges.
- **JobHistoryList** (`<JobHistoryList items onSelect type>`)
  - Renders grouped history for exports and imports; skeleton rows while loading.

### Empty / Loading / Error States
- Export history empty: “No exports yet” copy with hint to run first export.
- Import summary empty (pre-upload): show illustration instructing to drop file.
- Loading states: skeleton rows for history, spinner in modal while export builds.
- Error states: inline `Alert` component with error message from API, plus retry button.

### Optimistic Update Behavior
- Creating export job immediately appends placeholder item with `status='pending'`; final status reconciles on polling.
- Import commit button disables and shows spinner until server response; on failure, re-enable with error toast.

### React Component Snippet (import dropzone)
```tsx
import { useState } from 'react';

export function ImportDropzone({ onFile }: { onFile: (file: File) => void }) {
  const [isDragActive, setIsDragActive] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/json' && file.size <= 5 * 1024 * 1024) {
          onFile(file);
        }
      }}
      className={`flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed ${isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'}`}
    >
      <span className="text-sm text-slate-600">Drop JSON backup here or click to browse</span>
    </label>
  );
}
```

## Edge Cases
- Export requested while previous job pending: return `E_CONFLICT`, keep UI disabled until status changes.
- Import file with unsupported version: abort validation, surface guidance to update app.
- Import referencing tags not present in payload: mark as warning and skip linkage; todo still imported.
- Import duplicates existing todos with same title/dueAt: default skip unless `allowOverwrite=true`.
- JSON missing required keys: `E_VALIDATION` with path information (e.g., “Missing todos array”).
- Partial failure during commit: transaction rollback ensures no partial writes; job status becomes `failed` with reason stored in summary.

## Acceptance Criteria
- [ ] Export job returns downloadable JSON including todos, tags, and relationships with UTC timestamps intact.
- [ ] Import validation detects schema/version issues and surfaces human-friendly error messages.
- [ ] Import commit remaps IDs, preserves todo↔tag relationships, and avoids duplicates unless overwrite enabled.
- [ ] UI provides clear status transitions (pending → ready/failed) for export and import jobs.
- [ ] Rate limits prevent more than 3 exports or imports per hour per user.
- [ ] Audit history lists the last 10 jobs with accurate timestamps and statuses.
- [ ] All API responses use core `ok/err` envelope and correct `E_*` codes.

## Testing Requirements

### E2E Tests (Playwright)
`tests/09-export-import.spec.ts`
- [ ] `should create export job and download file`
- [ ] `should block additional export while job pending`
- [ ] `should validate import file and require commit`
- [ ] `should import data preserving tags`
- [ ] `should handle unsupported export version`
- [ ] `should respect due today filter after import (SG timezone)`
- [ ] `should display import history entries`

**Example test snippet**
```ts
test('should respect due today filter after import (SG timezone)', async ({ page }) => {
  await page.goto('/settings/import');
  await page.setInputFiles('input[type="file"]', 'fixtures/export-due-today.json');
  await page.getByRole('button', { name: 'Validate import' }).click();
  await page.getByRole('button', { name: 'Commit import' }).click();
  await page.goto('/todos?filter=due-today');
  const rows = page.getByTestId('todo-card');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Invoice follow-up');
});
```

### Unit Tests
- `lib/export/build.test.ts`: ensures payload structure, version tagging, and UTC timestamp generation.
- `lib/import/validate.test.ts`: validates schema, version handling, and warns for missing relationships.
- `lib/import/engine.test.ts`: covers ID remapping, transaction rollback, and overwrite logic using in-memory SQLite.
- `app/api/import/commit/route.test.ts`: asserts correct `ok/err` responses under success and validation failure.
- `components/ImportDropzone.test.tsx`: checks file acceptance and drag state transitions.

### Fixtures & Mocks Guidance
- Provide fixture exports covering: minimal todo, todos with tags, completed items, SG due-date crossing midnight.
- Mock `createId()` in tests to deterministic UUIDs for snapshot stability.
- Freeze SG time via `nowSg` mock when asserting due-today logic.
- Use temporary directory for export builds; clean up after tests.

## Out of Scope
- Binary attachments or media backups.
- Automatic scheduled exports (manual trigger only).
- Cross-user sharing of exports (current scope per user/session).
- Restoring recurrence rules or subtasks until respective PRPs integrate their schemas.

## Success Metrics
- ≥50% of active users create at least one export within 30 days of launch.
- Import success rate (completed without errors) ≥90% of attempts.
- Export API p95 latency ≤2 s; Import validation p95 ≤2.5 s.
- Bug reports related to data loss remain <0.5% of total exports/imports.
