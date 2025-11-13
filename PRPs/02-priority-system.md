# PRP: Priority System

## Feature Overview
Three-level priority system with visual color coding and automatic sorting to help users focus on important tasks.

## User Stories

### As a user
- I want to mark todos as high/medium/low priority
- So that I can see which tasks need immediate attention

### As a busy user
- I want high-priority tasks to appear first
- So that I don't miss critical deadlines

### As a visual user
- I want different colors for each priority
- So that I can quickly scan my task list

## Priority Levels

| Level | Badge Color | Text Color | Use Case | Sort Order |
|-------|------------|------------|----------|------------|
| **High** | Red (#EF4444) | White | Urgent, critical tasks | 1st |
| **Medium** | Yellow (#F59E0B) | White | Standard tasks | 2nd |
| **Low** | Blue (#3B82F6) | White | Nice-to-have tasks | 3rd |

### Default Behavior
- New todos default to **Medium** priority if not specified
- Priority is optional but defaults are applied automatically

## User Flow

### Setting Priority (Create)
1. User enters todo title
2. User clicks priority dropdown
3. User selects: High, Medium, or Low
4. Badge preview updates in form
5. User clicks "Add"
6. Todo appears with colored priority badge

### Changing Priority (Edit)
1. User clicks "Edit" on existing todo
2. User changes priority dropdown
3. User clicks "Save Changes"
4. Badge updates immediately
5. Todo re-sorts to correct position

### Filtering by Priority
1. User clicks priority filter dropdown (top of page)
2. User selects: All, High, Medium, or Low
3. System shows only todos matching selected priority
4. Filter applies to all sections (Overdue, Active, Completed)
5. User selects "All" to clear filter

## Technical Requirements

### Database Field
```sql
ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium';
```

### Type Definition
```typescript
type Priority = 'high' | 'medium' | 'low';
```

### API Integration
Already covered by main CRUD endpoints - priority is just another todo field:
```typescript
// Create/Update payload
{
  priority?: Priority;  // defaults to 'medium'
}
```

### Sorting Algorithm
```typescript
// Priority order
const priorityOrder = { high: 1, medium: 2, low: 3 };

// Sort todos
todos.sort((a, b) => {
  // First by priority
  const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
  if (priorityDiff !== 0) return priorityDiff;
  
  // Then by due date (closest first, nulls last)
  if (a.due_date && b.due_date) {
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  }
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  
  // Finally by creation date (newest first)
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});
```

### UI Components

#### Priority Badge
```tsx
<span className={cn(
  "px-2 py-1 text-xs font-semibold rounded-full",
  priority === 'high' && "bg-red-500 text-white",
  priority === 'medium' && "bg-yellow-500 text-white",
  priority === 'low' && "bg-blue-500 text-white"
)}>
  {priority.toUpperCase()}
</span>
```

#### Priority Dropdown (Form)
```tsx
<select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
  <option value="high">High Priority</option>
  <option value="medium">Medium Priority</option>
  <option value="low">Low Priority</option>
</select>
```

#### Priority Filter Dropdown
```tsx
<select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
  <option value="all">All Priorities</option>
  <option value="high">High Only</option>
  <option value="medium">Medium Only</option>
  <option value="low">Low Only</option>
</select>
```

### Dark Mode Adaptation
Colors automatically adapt via Tailwind's color system:
- `bg-red-500`, `bg-yellow-500`, `bg-blue-500` work in both light/dark modes
- Sufficient contrast for WCAG AA compliance

### Filter Logic (Client-Side)
```typescript
const filteredTodos = todos.filter(todo => {
  if (priorityFilter === 'all') return true;
  return todo.priority === priorityFilter;
});
```

## Visual Design

### Badge Placement
- Appears immediately after todo title
- Inline with title text
- Small size (`text-xs`) to avoid dominating
- Round corners (`rounded-full`) for visual distinction

### Section Display
All three sections (Overdue, Active, Completed) show priority badges:
- **Overdue**: Badge + red banner (priority still visible)
- **Active**: Badge clearly visible
- **Completed**: Badge with reduced opacity to de-emphasize

### Filter UI
- Dropdown positioned near search bar
- Label: "Filter by Priority:"
- Current filter displayed prominently
- Clear visual feedback when filter active

## Acceptance Criteria

- [ ] Priority dropdown available when creating todo
- [ ] Priority dropdown available when editing todo
- [ ] Default priority is "medium" if not specified
- [ ] High priority badge is red with white text
- [ ] Medium priority badge is yellow with white text
- [ ] Low priority badge is blue with white text
- [ ] Todos sorted by priority (high→medium→low) within each section
- [ ] Priority filter dropdown at top of page
- [ ] Selecting priority filter shows only matching todos
- [ ] "All Priorities" option clears filter
- [ ] Priority badges visible in light and dark mode
- [ ] Badge colors meet WCAG AA contrast requirements

## Accessibility

### Color Contrast
- Red badge: #EF4444 on white text (4.5:1 ratio)
- Yellow badge: #F59E0B on white text (4.5:1 ratio)
- Blue badge: #3B82F6 on white text (4.5:1 ratio)

### Screen Readers
```tsx
<span 
  className="priority-badge"
  aria-label={`Priority: ${priority}`}
>
  {priority.toUpperCase()}
</span>
```

### Keyboard Navigation
- Priority dropdown fully keyboard accessible
- Tab order: Title → Priority → Due Date → Add button
- Enter/Space to open dropdown, Arrow keys to select

## Testing Requirements

### E2E Tests
```
tests/03-priority-recurring.spec.ts
```

Test cases:
- [ ] Create todo with high priority
- [ ] Create todo with default (medium) priority
- [ ] Edit todo to change priority
- [ ] Verify sorting: high appears before medium before low
- [ ] Filter by high priority shows only high-priority todos
- [ ] Clear filter shows all todos again
- [ ] Priority badge has correct color for each level

### Visual Regression Tests
- [ ] Badge colors in light mode
- [ ] Badge colors in dark mode
- [ ] Badge appearance with long titles
- [ ] Badge in overdue section (red + red conflict)

## Error Handling
- Invalid priority value (not high/medium/low): Defaults to 'medium'
- Server validation returns 400 if priority invalid

## Out of Scope
- Custom priority levels (only 3 fixed levels)
- Priority icons/emojis (text only)
- Priority-based notifications
- Automatic priority suggestions
- Priority statistics/analytics

## Success Metrics
- 70% of users actively use priority system
- High-priority todos completed 2x faster than low-priority
- < 5% of todos left at default priority (indicates conscious choice)
