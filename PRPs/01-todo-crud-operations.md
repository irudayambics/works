# PRP: Todo CRUD Operations

## Feature Overview
Core create, read, update, delete operations for todos with rich metadata including priority, due dates, recurring patterns, and reminders.

## User Stories

### As a user
- I want to create todos with just a title for quick task capture
- I want to add optional metadata (priority, due date, etc.) for better organization
- I want to edit todos to update details as tasks evolve
- I want to toggle completion status without opening edit mode
- I want to delete todos I no longer need

## User Flow

### Create Todo
1. User types title in "Add a new todo" input field
2. User optionally selects priority from dropdown (default: Medium)
3. User optionally sets due date using datetime picker
4. User optionally checks "Repeat" for recurring todos
5. User optionally sets reminder timing
6. User clicks "Add" button
7. System validates input and creates todo
8. New todo appears in appropriate section (Active Todos)

### Read/View Todos
1. System displays todos in sections:
   - **Overdue** (red banner, past due date, not completed)
   - **Active** (current todos, sorted by priority then due date)
   - **Completed** (gray background, strikethrough text)
2. Each todo shows:
   - Title, completion checkbox, priority badge
   - Due date (if set), recurring badge (if recurring)
   - Reminder badge (if set), tag badges (if tagged)
   - Actions: Edit, Delete

### Update Todo
1. User clicks "Edit" button on todo
2. System opens edit form with current values
3. User modifies any field (title, priority, due date, etc.)
4. User clicks "Save Changes"
5. System validates and updates todo
6. Todo updates in real-time on UI

### Toggle Completion
1. User clicks checkbox on todo
2. System immediately updates completion status
3. Todo moves to Completed section (or back to Active if unchecking)
4. For recurring todos: creates next instance before moving to completed

### Delete Todo
1. User clicks "Delete" button
2. System shows confirmation prompt
3. User confirms deletion
4. System deletes todo and all associated subtasks
5. Todo removed from UI

## Technical Requirements

### Database Schema
```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT 0,
  due_date TEXT,  -- ISO datetime string (Singapore timezone)
  priority TEXT DEFAULT 'medium',  -- 'high' | 'medium' | 'low'
  is_recurring BOOLEAN DEFAULT 0,
  recurrence_pattern TEXT,  -- 'daily' | 'weekly' | 'monthly' | 'yearly'
  reminder_minutes INTEGER,  -- minutes before due date
  last_notification_sent TEXT,  -- ISO datetime
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### API Endpoints

#### `POST /api/todos`
**Create new todo**
- Input:
  ```typescript
  {
    title: string;  // required, non-empty
    priority?: 'high' | 'medium' | 'low';  // default: 'medium'
    dueDate?: string;  // ISO format YYYY-MM-DDTHH:mm
    isRecurring?: boolean;
    recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    reminderMinutes?: number;  // null or positive number
  }
  ```
- Output: Created todo object
- Validation:
  - Title required and non-empty
  - Due date must be at least 1 minute in future (Singapore time)
  - Recurring todos require due date
  - Invalid priority/pattern returns 400

#### `GET /api/todos`
**Get all user's todos**
- Output: Array of todos with subtasks and tags populated
- Sorting: Priority (high→low), then due date (closest first)
- Includes: overdue, active, and completed todos

#### `GET /api/todos/[id]`
**Get single todo by ID**
- Output: Todo object with subtasks and tags
- Returns 404 if not found or not owned by user

#### `PUT /api/todos/[id]`
**Update todo**
- Input: Same as POST (all fields optional)
- Special handling for recurring todos:
  - If marking as completed and is_recurring=true:
    1. Create next instance with calculated due date
    2. Copy: priority, tags, reminder offset, recurrence pattern
    3. Mark current todo as completed
- Output: Updated todo object

#### `DELETE /api/todos/[id]`
**Delete todo**
- Cascades to: subtasks, todo_tags associations
- Returns 204 on success

### Validation Rules

**Title:**
- Required (cannot be undefined)
- Non-empty after trim
- Error: "Invalid title"

**Due Date:**
- Format: `YYYY-MM-DDTHH:mm` (ISO datetime without seconds/timezone)
- Must be > 1 minute in future (using Singapore timezone)
- Error: "Due date must be in the future (Singapore time)"

**Priority:**
- Must be one of: `'high'`, `'medium'`, `'low'`
- Error: "Invalid priority. Must be high, medium, or low"

**Reminder:**
- Must be non-negative number or null
- Requires due date to be set
- Error: "Invalid reminder minutes. Must be a non-negative number"

**Recurrence:**
- Pattern must be: `'daily'`, `'weekly'`, `'monthly'`, `'yearly'`
- Requires due date when is_recurring=true
- Error: "Invalid recurrence pattern"

### Timezone Handling
**Critical:** All date operations use Singapore timezone (`Asia/Singapore`)

```typescript
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone';

// When validating due date
const nowSG = getSingaporeNow();  // NOT new Date()
const dueDateObj = new Date(dueDate);
if (dueDateObj <= nowSG) {
  // Error: past date
}
```

### Client-Side Behavior

**Form State:**
- New todo form at top of page
- State managed via React hooks (no form library)
- Date picker minimum set to `getSingaporeNow() + 1 minute`

**Optimistic Updates:**
- Checkbox toggle updates UI immediately
- API call happens in background
- Revert on error (with error message)

**Sections:**
- Overdue: `!completed && due_date && isPast(due_date)`
- Active: `!completed && (!due_date || isFuture(due_date))`
- Completed: `completed === true`

## Acceptance Criteria

### Create
- [ ] Can create todo with only title (minimum requirement)
- [ ] Can create todo with all metadata (priority, due date, recurring, reminder)
- [ ] Title validation prevents empty/whitespace-only todos
- [ ] Due date validation prevents past dates (Singapore time)
- [ ] Recurring todos require due date
- [ ] Success shows todo in Active section immediately

### Read
- [ ] All user's todos load on page mount
- [ ] Todos grouped into: Overdue, Active, Completed sections
- [ ] Todos sorted by priority, then due date within each section
- [ ] Todo displays all metadata: title, priority badge, due date, recurring badge, reminder badge, tags
- [ ] Overdue section has red warning banner

### Update
- [ ] Can edit any todo field
- [ ] Changes persist to database
- [ ] Validation same as create
- [ ] Recurring todo completion creates next instance
- [ ] Next instance has correct calculated due date
- [ ] Next instance inherits: priority, tags, reminder offset, recurrence pattern
- [ ] UI updates immediately on save

### Toggle Completion
- [ ] Checkbox click toggles completion status
- [ ] Todo moves to correct section (Active ↔ Completed)
- [ ] Recurring todo creates next before moving to completed
- [ ] Optimistic UI update (immediate feedback)

### Delete
- [ ] Delete button shows confirmation
- [ ] Confirmation required before deletion
- [ ] Todo removed from database and UI
- [ ] Associated subtasks deleted (cascade)
- [ ] Associated todo_tags deleted (cascade)

## Error Handling

### Client Errors
- Empty title: "Title is required"
- Past due date: "Due date must be in the future"
- Network error: "Failed to save todo. Please try again."

### Server Errors
- 400: Validation error (show specific message)
- 401: Not authenticated (redirect to login)
- 404: Todo not found (show error, refresh list)
- 500: Server error (show generic error)

## Testing Requirements

### E2E Tests (Playwright)
```
tests/02-todo-crud.spec.ts
```

Test cases:
- [ ] Create todo with title only
- [ ] Create todo with full metadata
- [ ] Edit todo title and priority
- [ ] Toggle completion checkbox
- [ ] Delete todo with confirmation
- [ ] Validate past due date shows error
- [ ] Validate empty title shows error

## Performance Requirements
- Create todo: < 300ms
- Load all todos: < 500ms
- Toggle completion: < 200ms (optimistic)
- Delete todo: < 300ms

## Out of Scope
- Bulk operations (multi-select, bulk delete)
- Undo/redo functionality
- Drag-and-drop reordering
- Todo duplication
- Archive (instead of delete)

## Success Metrics
- 95% of todo creates succeed on first attempt
- < 1% validation errors after user education
- Average time to create todo: < 10 seconds
