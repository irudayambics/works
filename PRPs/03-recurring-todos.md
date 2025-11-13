# PRP: Recurring Todos

## Feature Overview
Automatically create the next instance of a todo when marked complete, supporting daily, weekly, monthly, and yearly recurrence patterns for habit tracking and routine tasks.

## User Stories

### As a user with daily habits
- I want todos to repeat every day (e.g., "Exercise")
- So that I don't manually recreate the same task each day

### As a user with weekly routines
- I want todos to repeat every week (e.g., "Team meeting")
- So that recurring events automatically appear on my list

### As a user with monthly bills
- I want todos to repeat every month (e.g., "Pay rent")
- So that I never forget regular monthly obligations

### As a user with annual events
- I want todos to repeat every year (e.g., "Renew car insurance")
- So that annual tasks are automatically tracked

## Recurrence Patterns

| Pattern | Next Due Date Calculation | Example Use Case |
|---------|---------------------------|------------------|
| **Daily** | Current completion time + 24 hours | Exercise, medication, daily standup |
| **Weekly** | Current completion time + 7 days | Weekly review, team meeting, meal prep |
| **Monthly** | Same day next month | Rent payment, subscription renewal, monthly report |
| **Yearly** | Same date next year | Birthday, anniversary, annual insurance |

### Important Behavior
- Next instance created **when current todo marked complete**
- Next due date calculated **from completion time**, not original due date
- This allows catching up on missed recurring tasks without cascading future dates

## User Flow

### Creating Recurring Todo
1. User enters todo title
2. User sets due date (required for recurring)
3. User checks "Repeat" checkbox
4. Recurrence pattern dropdown appears
5. User selects pattern (Daily/Weekly/Monthly/Yearly)
6. User optionally sets priority, reminder, tags
7. User clicks "Add"
8. Todo displays with 🔄 badge + pattern name (e.g., "🔄 Weekly")

### Completing Recurring Todo
1. User checks completion checkbox on recurring todo
2. System immediately:
   - Creates new todo instance
   - Calculates next due date based on pattern
   - Copies: priority, tags, reminder offset, recurrence pattern
   - Does NOT copy: subtasks, completion status
3. Current todo moves to Completed section
4. New instance appears in Active section (or Overdue if past due)

### Editing Recurring Todo
1. User can change recurrence pattern
2. User can disable recurring (uncheck "Repeat")
3. Changes only affect current instance, not future ones
4. Next instance created with updated pattern at completion time

### Stopping Recurrence
- User edits todo and unchecks "Repeat"
- When completed, no new instance created
- Todo moves to Completed section normally

## Technical Requirements

### Database Fields
```sql
ALTER TABLE todos ADD COLUMN is_recurring BOOLEAN DEFAULT 0;
ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT;  -- 'daily'|'weekly'|'monthly'|'yearly'
```

### Type Definition
```typescript
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Todo {
  // ... other fields
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
}
```

### Next Instance Calculation

```typescript
import { getSingaporeNow } from '@/lib/timezone';

function calculateNextDueDate(pattern: RecurrencePattern): string {
  const now = getSingaporeNow();
  
  switch (pattern) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    case 'yearly':
      now.setFullYear(now.getFullYear() + 1);
      break;
  }
  
  // Format as YYYY-MM-DDTHH:mm
  return formatToISO(now);
}
```

### Completion Handler (API)
Located in `PUT /api/todos/[id]` when `completed: true`:

```typescript
if (updatedCompleted && !existing.completed && existing.is_recurring) {
  // Create next instance
  const nextDueDate = calculateNextDueDate(existing.recurrence_pattern);
  
  const nextTodo = todoDB.create(
    session.userId,
    existing.title,
    existing.priority,
    nextDueDate,
    existing.is_recurring,
    existing.recurrence_pattern,
    existing.reminder_minutes  // Keep same offset
  );
  
  // Copy tags from current to next
  const tags = todoDB.getTags(existing.id);
  tags.forEach(tag => {
    todoDB.addTag(nextTodo.id, tag.id);
  });
}
```

### Validation Rules

**Creating Recurring Todo:**
- Due date is **required** when is_recurring = true
- Error: "Recurring todos must have a due date"

**Recurrence Pattern:**
- Must be one of: `'daily'`, `'weekly'`, `'monthly'`, `'yearly'`
- Error: "Invalid recurrence pattern"

**Due Date Format:**
- Must be valid ISO datetime
- Must be in future (Singapore time)

### UI Components

#### Recurrence Toggle
```tsx
<label>
  <input 
    type="checkbox" 
    checked={isRecurring}
    onChange={(e) => setIsRecurring(e.target.checked)}
  />
  Repeat
</label>

{isRecurring && (
  <select 
    value={recurrencePattern} 
    onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
  >
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
    <option value="yearly">Yearly</option>
  </select>
)}
```

#### Recurrence Badge
```tsx
{todo.is_recurring && (
  <span className="text-xs text-blue-600 dark:text-blue-400">
    🔄 {todo.recurrence_pattern}
  </span>
)}
```

## Edge Cases

### Monthly Recurrence Edge Cases
```typescript
// Jan 31 → Feb 28/29 (leap year handling)
// May 31 → Jun 30 (months with fewer days)
// JavaScript Date handles this automatically
```

### Timezone Edge Cases
- All dates use Singapore timezone consistently
- Completion time uses `getSingaporeNow()`
- Next due date calculated in Singapore timezone

### Completing Overdue Recurring Todo
- If overdue daily todo completed 3 days late
- Next instance due date = completion time + 1 day (not original + 1)
- Prevents accumulation of overdue recurring todos

## Acceptance Criteria

- [ ] Can create recurring todo with due date and pattern
- [ ] Cannot create recurring todo without due date (validation error)
- [ ] Recurrence pattern dropdown only visible when "Repeat" checked
- [ ] Todo displays 🔄 badge with pattern name (e.g., "🔄 Daily")
- [ ] Completing recurring todo creates next instance immediately
- [ ] Next instance has correct due date based on pattern from completion time
- [ ] Next instance inherits: priority, tags, reminder offset, recurrence pattern
- [ ] Next instance does NOT inherit: subtasks, completion status
- [ ] Current todo moves to Completed section after creating next
- [ ] Can edit recurring pattern on existing todo
- [ ] Can disable recurring on existing todo (unchecking "Repeat")
- [ ] Non-recurring todo completion behavior unchanged

## Testing Requirements

### E2E Tests
```
tests/03-priority-recurring.spec.ts
```

Test cases:
- [ ] Create daily recurring todo
- [ ] Create weekly recurring todo
- [ ] Complete recurring todo and verify next instance created
- [ ] Verify next due date calculated correctly for each pattern
- [ ] Verify next instance has same priority and tags
- [ ] Complete non-recurring todo (should not create next instance)
- [ ] Edit recurring pattern and verify next instance uses new pattern
- [ ] Disable recurring and verify no next instance on completion

### Unit Tests (Date Calculation)
```typescript
describe('calculateNextDueDate', () => {
  it('adds 1 day for daily pattern', () => { /* ... */ });
  it('adds 7 days for weekly pattern', () => { /* ... */ });
  it('adds 1 month for monthly pattern', () => { /* ... */ });
  it('adds 1 year for yearly pattern', () => { /* ... */ });
  it('handles month-end edge cases', () => { /* ... */ });
});
```

## Integration with Other Features

### Priority
- Next instance inherits priority
- High-priority recurring todos remain high-priority

### Tags
- Next instance gets all tags from current todo
- Tag deletions before completion don't affect inheritance

### Reminders
- Next instance inherits reminder_minutes offset
- If current had "1 day before", next also has "1 day before"
- Actual notification time recalculated based on new due date

### Subtasks
- Next instance does NOT inherit subtasks
- Each recurring instance starts with empty subtask list
- Rationale: Subtasks often specific to that occurrence

## Out of Scope
- Custom recurrence (every 3 days, every 2 weeks, etc.)
- Multiple recurrence patterns per todo
- Editing future instances before they're created
- Skipping an instance of recurrence
- Recurrence end date ("stop after 10 occurrences")
- Weekday-specific recurrence (every Monday, every weekday)

## Success Metrics
- 30% of active users create recurring todos
- Average user has 3-5 recurring todos
- Recurring todos have 80%+ completion rate
- Users save 2+ minutes/day on recreating routine tasks
