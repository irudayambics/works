# PRP: Export & Import

## Feature Overview
Backup and restore todos with complete metadata, including subtasks and tags, using JSON format for data portability and backup.

## User Stories

### As a user concerned about data loss
- I want to export my todos to a file
- So that I have a backup if something goes wrong

### As a user switching devices
- I want to import my todos on a new device
- So that I can continue my task management seamlessly

### As a power user
- I want export format to be JSON
- So that I can analyze or manipulate my data externally

### As a user sharing workflows
- I want to export specific todos with their subtasks
- So that I can share task templates with others

## User Flow

### Exporting Todos
1. User clicks "Export Todos" button (near top of page)
2. System generates JSON file with all user's data:
   - All todos (active, completed, overdue)
   - All subtasks
   - All tags
   - Todo-tag associations
3. Browser downloads file: `todos_export_YYYY-MM-DD.json`
4. User saves file to desired location

### Importing Todos
1. User clicks "Import Todos" button
2. File picker dialog opens
3. User selects previously exported JSON file
4. System validates file format
5. System imports data:
   - Creates todos with new IDs
   - Creates subtasks linked to new todos
   - Creates tags (or reuses existing if name matches)
   - Creates todo-tag associations
6. Imported todos appear immediately
7. Success message shows count of imported items

## Technical Requirements

### Export Format (JSON)
```json
{
  "version": "1.0",
  "exported_at": "2025-11-11T14:30:00",
  "user_id": 1,
  "todos": [
    {
      "id": 123,
      "title": "Complete project",
      "completed": false,
      "due_date": "2025-11-15T17:00",
      "priority": "high",
      "is_recurring": false,
      "recurrence_pattern": null,
      "reminder_minutes": 1440,
      "created_at": "2025-11-01T09:00:00"
    }
  ],
  "subtasks": [
    {
      "id": 456,
      "todo_id": 123,
      "title": "Research options",
      "completed": false,
      "position": 0
    }
  ],
  "tags": [
    {
      "id": 789,
      "name": "work",
      "color": "#3B82F6"
    }
  ],
  "todoTags": [
    {
      "todo_id": 123,
      "tag_id": 789
    }
  ]
}
```

### API Endpoints

#### `GET /api/todos/export`
**Export all user's todos**
- No input required (uses session userId)
- Generates JSON with structure above
- Response headers:
  ```typescript
  {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="todos_export_${date}.json"`
  }
  ```
- Returns: JSON file download

**Implementation:**
```typescript
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  
  const todos = todoDB.getAll(session.userId);
  const subtasks = [];
  const todoTags = [];
  
  // Collect subtasks and tag associations
  todos.forEach(todo => {
    if (todo.subtasks) {
      subtasks.push(...todo.subtasks);
    }
    if (todo.tags) {
      todo.tags.forEach(tag => {
        todoTags.push({ todo_id: todo.id, tag_id: tag.id });
      });
    }
  });
  
  const tags = tagDB.getAll(session.userId);
  
  const exportData = {
    version: '1.0',
    exported_at: getSingaporeNow().toISOString(),
    user_id: session.userId,
    todos: todos.map(({ subtasks, tags, ...todo }) => todo),  // Remove computed fields
    subtasks: subtasks,
    tags: tags,
    todoTags: todoTags
  };
  
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="todos_export_${formatDate(getSingaporeNow())}.json"`
    }
  });
}
```

#### `POST /api/todos/import`
**Import todos from JSON file**
- Input: JSON matching export format
- Content-Type: `application/json`
- Body: Parsed JSON object
- Returns: `{ success: true, imported: { todos: 5, subtasks: 12, tags: 3 } }`

**ID Remapping:**
```typescript
const todoIdMap = new Map<number, number>();  // old ID -> new ID
const tagIdMap = new Map<number, number>();

// Import todos (remap IDs)
data.todos.forEach(todo => {
  const newTodo = todoDB.create(
    session.userId,
    todo.title,
    todo.priority,
    todo.due_date,
    todo.is_recurring,
    todo.recurrence_pattern,
    todo.reminder_minutes
  );
  todoIdMap.set(todo.id, newTodo.id);
});

// Import subtasks (use remapped todo IDs)
data.subtasks.forEach(subtask => {
  const newTodoId = todoIdMap.get(subtask.todo_id);
  if (newTodoId) {
    subtaskDB.create(newTodoId, subtask.title, subtask.position);
  }
});

// Import tags (reuse existing or create new)
data.tags.forEach(tag => {
  const existing = tagDB.findByName(session.userId, tag.name);
  if (existing) {
    tagIdMap.set(tag.id, existing.id);
  } else {
    const newTag = tagDB.create(session.userId, tag.name, tag.color);
    tagIdMap.set(tag.id, newTag.id);
  }
});

// Import todo-tag associations (use remapped IDs)
data.todoTags.forEach(({ todo_id, tag_id }) => {
  const newTodoId = todoIdMap.get(todo_id);
  const newTagId = tagIdMap.get(tag_id);
  if (newTodoId && newTagId) {
    todoDB.addTag(newTodoId, newTagId);
  }
});
```

### File Naming Convention
- Export: `todos_export_YYYY-MM-DD.json`
- Example: `todos_export_2025-11-11.json`

### UI Components

#### Export Button
```tsx
<button 
  onClick={handleExport}
  className="btn-secondary"
>
  📥 Export Todos
</button>

async function handleExport() {
  try {
    const response = await fetch('/api/todos/export');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todos_export_${formatDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    alert('Failed to export todos');
  }
}
```

#### Import Button
```tsx
<button 
  onClick={() => importFileRef.current?.click()}
  className="btn-secondary"
>
  📤 Import Todos
</button>

<input 
  ref={importFileRef}
  type="file"
  accept="application/json,.json"
  style={{ display: 'none' }}
  onChange={handleImport}
/>

async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validate structure
    if (!data.todos || !Array.isArray(data.todos)) {
      throw new Error('Invalid file format');
    }
    
    const response = await fetch('/api/todos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error('Import failed');
    
    const result = await response.json();
    alert(`Imported ${result.imported.todos} todos, ${result.imported.subtasks} subtasks, ${result.imported.tags} tags`);
    
    // Refresh todos list
    fetchTodos();
  } catch (error) {
    alert('Failed to import: ' + error.message);
  } finally {
    // Reset file input
    e.target.value = '';
  }
}
```

### Validation

#### Export Validation
- No validation needed (system generates valid JSON)

#### Import Validation
```typescript
function validateImportData(data: any): { valid: boolean; error?: string } {
  // Check version
  if (!data.version || data.version !== '1.0') {
    return { valid: false, error: 'Unsupported file version' };
  }
  
  // Check required fields
  if (!data.todos || !Array.isArray(data.todos)) {
    return { valid: false, error: 'Invalid format: missing todos array' };
  }
  
  if (!data.subtasks || !Array.isArray(data.subtasks)) {
    return { valid: false, error: 'Invalid format: missing subtasks array' };
  }
  
  if (!data.tags || !Array.isArray(data.tags)) {
    return { valid: false, error: 'Invalid format: missing tags array' };
  }
  
  if (!data.todoTags || !Array.isArray(data.todoTags)) {
    return { valid: false, error: 'Invalid format: missing todoTags array' };
  }
  
  // Validate todo structure
  for (const todo of data.todos) {
    if (!todo.title || typeof todo.title !== 'string') {
      return { valid: false, error: 'Invalid todo: missing title' };
    }
    if (todo.priority && !['high', 'medium', 'low'].includes(todo.priority)) {
      return { valid: false, error: `Invalid priority: ${todo.priority}` };
    }
  }
  
  return { valid: true };
}
```

## Data Preservation

### What's Preserved
✅ Todo titles, completion status
✅ Due dates, priorities
✅ Recurring patterns, reminder settings
✅ Creation timestamps
✅ Subtasks with titles, positions, completion
✅ Tags with names and colors
✅ Todo-tag associations

### What's NOT Preserved
❌ Database IDs (remapped on import)
❌ User ID (imported under current user)
❌ `last_notification_sent` (reset to prevent immediate re-notifications)
❌ Authenticator data (not todo-related)

## Edge Cases

### Duplicate Tag Names
- Import checks for existing tag by name
- Reuses existing tag (preserves color of existing)
- Doesn't create duplicate tags

### Invalid JSON
- Parser throws error
- User sees: "Invalid JSON file"
- No partial import (all-or-nothing)

### Missing Required Fields
- Validation catches missing fields
- User sees specific error message
- No data imported

### Large Export Files
- No hard limit (SQLite handles thousands of todos)
- Browser download handles large files
- Recommend splitting if > 10MB (unlikely)

### Import Existing Todos
- Import always creates new todos
- Doesn't check for duplicates
- User might have duplicate todos after import

### Singapore Timezone in Export
- Timestamps exported in ISO format (timezone-aware)
- Import preserves original due dates
- No timezone conversion needed

## Acceptance Criteria

- [ ] "Export Todos" button downloads JSON file
- [ ] Export filename includes current date
- [ ] Export includes: todos, subtasks, tags, associations
- [ ] Export JSON is valid and well-formatted
- [ ] "Import Todos" button opens file picker
- [ ] File picker accepts only .json files
- [ ] Import validates JSON structure
- [ ] Import shows error for invalid files
- [ ] Import creates todos with new IDs
- [ ] Import preserves all metadata
- [ ] Import handles tag name conflicts (reuse existing)
- [ ] Import shows success message with counts
- [ ] Imported todos appear immediately
- [ ] Page refreshes after successful import

## Testing Requirements

### E2E Tests
```
tests/08-export-import.spec.ts
```

Test cases:
- [ ] Export todos creates downloadable file
- [ ] Export includes all todos
- [ ] Export includes subtasks
- [ ] Export includes tags
- [ ] Import valid file succeeds
- [ ] Import invalid JSON shows error
- [ ] Import missing fields shows error
- [ ] Import preserves todo data
- [ ] Import preserves subtasks
- [ ] Import preserves tags
- [ ] Import reuses existing tags by name

### Unit Tests
```typescript
describe('Import validation', () => {
  it('accepts valid export format', () => { /* ... */ });
  it('rejects missing todos array', () => { /* ... */ });
  it('rejects invalid priority', () => { /* ... */ });
  it('rejects invalid JSON', () => { /* ... */ });
});

describe('ID remapping', () => {
  it('remaps todo IDs correctly', () => { /* ... */ });
  it('remaps subtask todo_id references', () => { /* ... */ });
  it('remaps todoTags references', () => { /* ... */ });
});
```

## Security Considerations

### File Upload Safety
- Only accepts JSON files (client-side filter)
- Server validates JSON structure
- No code execution (just data import)
- User's own session required (can't import to other users)

### Data Privacy
- Export contains only current user's data
- No cross-user data leakage
- No sensitive auth data in export

## Performance Considerations

### Export Performance
- Expect < 500ms for 1000 todos
- Single SQL query per table
- JSON serialization is fast

### Import Performance
- Batch inserts where possible
- Transaction wrapping (all-or-nothing)
- Expect < 2 seconds for 1000 todos

## Out of Scope
- Selective export (specific todos only)
- CSV format export
- Excel format export
- Cloud backup/sync
- Automatic scheduled exports
- Import merge strategies (keep/replace/skip duplicates)
- Version migration (v1 → v2 format)
- Compression of export files

## Success Metrics
- 30% of users export at least once
- 10% of users use import feature
- 99% import success rate (valid files)
- < 2 second import time for typical use (< 100 todos)
- Zero data loss on export/import cycle
