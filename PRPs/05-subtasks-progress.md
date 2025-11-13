# PRP: Subtasks & Progress Tracking

## Feature Overview
Break down complex todos into smaller checklist items with visual progress tracking, helping users manage multi-step tasks.

## User Stories

### As a user with complex tasks
- I want to break todos into smaller subtasks
- So that I can track progress on multi-step work

### As a user who likes checklists
- I want to check off individual subtask items
- So that I feel progress even before the main todo is complete

### As a visual user
- I want to see a progress bar showing completion percentage
- So that I quickly understand how far along I am

## User Flow

### Adding Subtasks
1. User clicks "Subtasks" or expand arrow on todo
2. Subtasks section expands (initially empty)
3. User types subtask title in input field
4. User presses Enter or clicks Add button
5. Subtask appears in list below
6. Progress bar appears showing "0/1 completed (0%)"

### Completing Subtasks
1. User clicks checkbox on subtask
2. Subtask text gets strikethrough
3. Progress bar updates in real-time
4. Counter updates: "1/3 completed (33%)"

### Deleting Subtasks
1. User clicks delete (×) button on subtask
2. Confirmation prompt appears
3. User confirms
4. Subtask removed from list
5. Progress bar recalculates

### Viewing Progress
- Progress visible on collapsed todo (if has subtasks)
- Shows: "X/Y completed (Z%)" + progress bar
- Bar fills from left to right
- Color: Blue (#3B82F6) for active, Green (#10B981) when 100%

## Technical Requirements

### Database Schema
```sql
CREATE TABLE subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);
```

### Type Definitions
```typescript
interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

interface SubtaskProgress {
  total: number;
  completed: number;
  percentage: number;
}

interface Todo {
  // ... other fields
  subtasks?: Subtask[];
  progress?: SubtaskProgress;
}
```

### API Endpoints

#### `POST /api/todos/[id]/subtasks`
**Create subtask**
- Input: `{ title: string }`
- Validation: Title required, non-empty
- Position: Auto-incremented (max existing + 1)
- Output: Created subtask object

#### `PUT /api/subtasks/[id]`
**Update subtask** (toggle completion or edit title)
- Input: `{ title?: string, completed?: boolean }`
- Validation: Title non-empty if provided
- Output: Updated subtask object

#### `DELETE /api/subtasks/[id]`
**Delete subtask**
- Cascaded automatically when parent todo deleted
- Returns 204 on success

#### `GET /api/todos` (Enhanced)
**Returns todos with subtasks**
```typescript
// Response includes
{
  id: 1,
  title: "Plan vacation",
  subtasks: [
    { id: 1, title: "Book flights", completed: true, position: 0 },
    { id: 2, title: "Reserve hotel", completed: false, position: 1 },
    { id: 3, title: "Rent car", completed: false, position: 2 }
  ],
  progress: {
    total: 3,
    completed: 1,
    percentage: 33.33
  }
}
```

### Progress Calculation

**Server-Side (SQL)**
```sql
SELECT 
  t.*,
  COUNT(s.id) as subtask_total,
  SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as subtask_completed,
  CASE 
    WHEN COUNT(s.id) = 0 THEN NULL
    ELSE ROUND(SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id), 2)
  END as subtask_percentage
FROM todos t
LEFT JOIN subtasks s ON t.id = s.todo_id
GROUP BY t.id
```

**Client-Side (JavaScript)**
```typescript
function calculateProgress(subtasks: Subtask[]): SubtaskProgress {
  const total = subtasks.length;
  const completed = subtasks.filter(s => s.completed).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  
  return { total, completed, percentage };
}
```

### UI Components

#### Subtask List (Expandable)
```tsx
<div className="subtasks-section">
  <button onClick={() => toggleExpanded(todo.id)}>
    <span>{expanded ? '▼' : '▶'}</span>
    Subtasks {progress && `(${progress.completed}/${progress.total})`}
  </button>
  
  {expanded && (
    <div className="subtasks-container">
      {/* Add subtask form */}
      <input 
        placeholder="Add a subtask..."
        value={newSubtaskText[todo.id] || ''}
        onChange={(e) => setNewSubtaskText({ ...newSubtaskText, [todo.id]: e.target.value })}
        onKeyPress={(e) => e.key === 'Enter' && addSubtask(todo.id)}
      />
      
      {/* Subtask list */}
      {todo.subtasks?.map(subtask => (
        <div key={subtask.id} className="subtask-item">
          <input 
            type="checkbox"
            checked={subtask.completed}
            onChange={() => toggleSubtask(subtask.id)}
          />
          <span className={subtask.completed ? 'line-through' : ''}>
            {subtask.title}
          </span>
          <button onClick={() => deleteSubtask(subtask.id)}>×</button>
        </div>
      ))}
    </div>
  )}
</div>
```

#### Progress Bar
```tsx
{progress && progress.total > 0 && (
  <div className="progress-container">
    <div className="progress-info">
      {progress.completed}/{progress.total} completed ({progress.percentage}%)
    </div>
    <div className="progress-bar-bg">
      <div 
        className={cn(
          "progress-bar-fill",
          progress.percentage === 100 ? "bg-green-500" : "bg-blue-500"
        )}
        style={{ width: `${progress.percentage}%` }}
      />
    </div>
  </div>
)}
```

### Cascade Delete Behavior
- When parent todo deleted, all subtasks auto-deleted (SQL ON DELETE CASCADE)
- No orphaned subtasks possible
- Frontend doesn't need special handling

### Position Management
- Subtasks ordered by `position` field (ASC)
- New subtasks get `max(position) + 1`
- No manual reordering in current version

## Edge Cases

### Empty Subtasks
- Todo with 0 subtasks shows no progress bar
- Expanding subtasks shows empty state + add form

### All Subtasks Completed
- Progress bar turns green (#10B981)
- Shows "3/3 completed (100%)"
- Parent todo not auto-completed (user must check main checkbox)

### Deleting Last Subtask
- Progress bar disappears
- Subtasks section still expandable (for adding new)

### Recurring Todos
- Subtasks NOT inherited by next instance
- Each recurring instance starts with empty subtask list
- Rationale: Subtasks often unique to that occurrence

### Templates
- Subtasks CAN be saved in templates
- Stored as JSON: `[{ title: string, position: number }]`
- When template used, subtasks recreated from JSON

## Acceptance Criteria

- [ ] Can expand/collapse subtasks section on todo
- [ ] Can add subtask with title
- [ ] Can add multiple subtasks to same todo
- [ ] Subtasks ordered by position
- [ ] Can toggle subtask completion checkbox
- [ ] Completed subtask shows strikethrough text
- [ ] Can delete individual subtask
- [ ] Progress bar displays: "X/Y completed (Z%)"
- [ ] Progress bar width reflects completion percentage
- [ ] Progress bar is blue until 100%, then green
- [ ] Progress updates in real-time when toggling subtasks
- [ ] Deleting parent todo deletes all subtasks (cascade)
- [ ] Subtasks visible on collapsed todo (if exists)
- [ ] Empty subtask list shows add form

## Testing Requirements

### E2E Tests
```
tests/04-subtasks.spec.ts
```

Test cases:
- [ ] Expand subtasks section
- [ ] Add subtask via input + Enter
- [ ] Add subtask via Add button
- [ ] Toggle subtask completion
- [ ] Progress bar updates correctly
- [ ] Delete subtask
- [ ] Delete parent todo cascades to subtasks
- [ ] Verify subtasks ordered by position

### Progress Calculation Tests
```typescript
describe('calculateProgress', () => {
  it('returns 0% for empty list', () => {
    expect(calculateProgress([])).toEqual({ total: 0, completed: 0, percentage: 0 });
  });
  
  it('calculates 50% for half complete', () => {
    const subtasks = [
      { completed: true },
      { completed: false }
    ];
    expect(calculateProgress(subtasks).percentage).toBe(50);
  });
  
  it('returns 100% when all complete', () => {
    const subtasks = [
      { completed: true },
      { completed: true }
    ];
    expect(calculateProgress(subtasks).percentage).toBe(100);
  });
});
```

## Accessibility

### Keyboard Navigation
- Tab to subtask checkbox
- Space/Enter to toggle
- Tab to delete button
- Arrow keys for list navigation (future)

### Screen Readers
```tsx
<div role="group" aria-label="Subtasks">
  <button aria-expanded={expanded} aria-controls={`subtasks-${todo.id}`}>
    Subtasks
  </button>
  <div id={`subtasks-${todo.id}`} role="list">
    {subtasks.map(subtask => (
      <div role="listitem" aria-label={`Subtask: ${subtask.title}`}>
        <input 
          type="checkbox" 
          aria-label={`Mark ${subtask.title} as ${subtask.completed ? 'incomplete' : 'complete'}`}
        />
        {/* ... */}
      </div>
    ))}
  </div>
</div>
```

### Progress Bar Accessibility
```tsx
<div role="progressbar" aria-valuenow={progress.percentage} aria-valuemin={0} aria-valuemax={100}>
  {progress.completed}/{progress.total} completed
</div>
```

## Performance Considerations

### Rendering Large Lists
- Subtasks typically < 20 per todo
- No virtualization needed at this scale
- Load all subtasks with parent todo (no lazy loading)

### Real-Time Updates
- Optimistic UI update on checkbox toggle
- API call in background
- Revert on error with user notification

## Out of Scope
- Drag-and-drop subtask reordering
- Nested subtasks (sub-subtasks)
- Subtask due dates
- Subtask priority levels
- Subtask tags
- Convert subtask to standalone todo
- Bulk subtask operations

## Success Metrics
- 40% of todos have subtasks
- Average 3-4 subtasks per todo (with subtasks)
- 70% subtask completion rate
- Users complete subtasks before marking main todo done (80% of time)
