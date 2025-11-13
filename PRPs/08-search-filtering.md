# PRP: Search & Filtering

## Feature Overview
Find and organize todos through real-time text search and multi-criteria filtering for quick access to relevant tasks.

## User Stories

### As a user with many todos
- I want to search todos by title
- So that I can quickly find specific tasks

### As a user organizing by context
- I want to filter by priority
- So that I can focus on high-priority tasks

### As a user with tags
- I want to filter by tag
- So that I can see all tasks in a project or context

### As a user with advanced needs
- I want search to include tag names
- So that I can find todos by any relevant keyword

## User Flow

### Text Search
1. User types in search box at top of page
2. Results filter in real-time (no submit button)
3. Todos matching search term remain visible
4. Non-matching todos hidden
5. Search applies to current section (Overdue, Active, Completed)
6. User clears search box to see all todos again

### Priority Filter
1. User clicks priority filter dropdown
2. User selects: All, High, Medium, or Low
3. Todos filter immediately
4. Filter applies across all sections
5. Selected priority highlighted in dropdown
6. User selects "All" to clear filter

### Tag Filter
1. User clicks tag badge on any todo
2. System filters to show only todos with that tag
3. Filter indicator appears: "Filtered by: #tagname"
4. User clicks "Clear filter" to show all todos

### Combined Filters
1. User types search term
2. User selects priority filter
3. User clicks tag badge
4. Results show todos matching ALL criteria (AND logic)
5. Each filter can be cleared independently

## Technical Requirements

### Search Implementation
**Client-Side** (no backend API needed)

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
const [tagFilter, setTagFilter] = useState<number | null>(null);

function filterTodos(todos: Todo[]): Todo[] {
  return todos.filter(todo => {
    // Text search: title or tag names
    const matchesSearch = !searchQuery || 
      todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      todo.tags?.some(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Priority filter
    const matchesPriority = priorityFilter === 'all' || 
      todo.priority === priorityFilter;
    
    // Tag filter
    const matchesTag = !tagFilter || 
      todo.tags?.some(tag => tag.id === tagFilter);
    
    return matchesSearch && matchesPriority && matchesTag;
  });
}
```

### Search Modes

#### Simple Mode (Current)
- Searches todo titles only
- Case-insensitive
- Substring match

#### Advanced Mode
- Searches todo titles AND tag names
- Case-insensitive
- Substring match
- Example: Searching "work" finds:
  - Todos with "Work" in title
  - Todos tagged with #work, #workshop, etc.

### UI Components

#### Search Input
```tsx
<div className="search-container">
  <input 
    type="text"
    placeholder="Search todos..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="search-input"
  />
  {searchQuery && (
    <button onClick={() => setSearchQuery('')}>
      Clear
    </button>
  )}
</div>
```

#### Priority Filter Dropdown
```tsx
<div className="priority-filter">
  <label>Priority:</label>
  <select 
    value={priorityFilter}
    onChange={(e) => setPriorityFilter(e.target.value as 'all' | Priority)}
  >
    <option value="all">All Priorities</option>
    <option value="high">High Only</option>
    <option value="medium">Medium Only</option>
    <option value="low">Low Only</option>
  </select>
</div>
```

#### Tag Filter Indicator
```tsx
{tagFilter && (
  <div className="active-filters">
    <span>
      Filtered by: #{tags.find(t => t.id === tagFilter)?.name}
    </span>
    <button onClick={() => setTagFilter(null)}>
      Clear Tag Filter
    </button>
  </div>
)}
```

#### Filter Summary
```tsx
<div className="filter-summary">
  {searchQuery && <span>Search: "{searchQuery}"</span>}
  {priorityFilter !== 'all' && <span>Priority: {priorityFilter}</span>}
  {tagFilter && <span>Tag: #{tags.find(t => t.id === tagFilter)?.name}</span>}
  {(searchQuery || priorityFilter !== 'all' || tagFilter) && (
    <button onClick={clearAllFilters}>Clear All Filters</button>
  )}
</div>
```

### Performance Optimization

#### Debouncing Search
```typescript
import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

// Usage
const debouncedSearch = useDebounce(searchQuery, 300);
const filteredTodos = filterTodos(todos, debouncedSearch);
```

#### Memoization
```typescript
import { useMemo } from 'react';

const filteredTodos = useMemo(() => {
  return filterTodos(todos);
}, [todos, searchQuery, priorityFilter, tagFilter]);
```

### Section-Specific Filtering
Filters apply within each section separately:

```typescript
// Overdue todos
const overdueFiltered = filterTodos(overdueTodos);

// Active todos
const activeFiltered = filterTodos(activeTodos);

// Completed todos
const completedFiltered = filterTodos(completedTodos);
```

### Empty States

#### No Search Results
```tsx
{filteredTodos.length === 0 && searchQuery && (
  <div className="empty-state">
    <p>No todos found matching "{searchQuery}"</p>
    <button onClick={() => setSearchQuery('')}>Clear Search</button>
  </div>
)}
```

#### No Filter Results
```tsx
{filteredTodos.length === 0 && (searchQuery || priorityFilter !== 'all' || tagFilter) && (
  <div className="empty-state">
    <p>No todos match your filters</p>
    <button onClick={clearAllFilters}>Clear All Filters</button>
  </div>
)}
```

## Filter Behavior Details

### Search Characteristics
- **Case-insensitive**: "Work" matches "work", "WORK", "WoRk"
- **Substring**: "meet" matches "Meeting with client"
- **No regex**: Special characters treated as literals
- **Real-time**: Updates as you type (with debounce)

### Priority Filter
- **Affects all sections**: Overdue, Active, Completed
- **Persists**: Remains active while navigating app
- **Default**: "All Priorities" (no filtering)

### Tag Filter
- **Single tag**: Can't filter by multiple tags simultaneously
- **Click badge**: Clicking todo's tag badge activates filter
- **Clear button**: Prominent clear button when active
- **Persists**: Until cleared or different tag clicked

### Combined Logic
- Filters use **AND** logic (all must match)
- Example: Search "client" + Priority "high" + Tag "work"
  - Shows only high-priority todos
  - With "client" in title (or #work tag contains "client")
  - Tagged with #work

## Edge Cases

### Empty Search Query
- All todos visible (no filtering)
- Search input empty state

### Search with No Results
- Shows empty state message
- Clear button prominent
- Other filters still active

### Filtering Completed Todos
- Search/filters apply to completed section too
- Helps find completed tasks for reference

### Special Characters in Search
- No special handling (literal match)
- Example: Searching "!" finds todos with "!" in title

## Acceptance Criteria

- [ ] Search box at top of page
- [ ] Search filters todos in real-time (no submit button)
- [ ] Search is case-insensitive
- [ ] Search matches todo title
- [ ] Search matches tag names (advanced mode)
- [ ] Priority filter dropdown shows: All, High, Medium, Low
- [ ] Priority filter applies to all sections
- [ ] Clicking tag badge activates tag filter
- [ ] Tag filter shows only todos with that tag
- [ ] Active tag filter displays indicator with tag name
- [ ] Can clear tag filter
- [ ] Filters combine with AND logic
- [ ] Empty results show clear message
- [ ] Clearing search/filters restores all todos
- [ ] Filters persist across page interactions

## Testing Requirements

### E2E Tests
```
tests/07-search-filtering.spec.ts
```

Test cases:
- [ ] Type in search box filters todos
- [ ] Search is case-insensitive
- [ ] Search includes tag names
- [ ] Select priority filter shows only that priority
- [ ] Click tag badge activates tag filter
- [ ] Clear tag filter shows all todos
- [ ] Combine search + priority + tag (all must match)
- [ ] Empty results show message
- [ ] Clear all filters button works

### Performance Tests
```typescript
describe('Search performance', () => {
  it('filters 1000 todos in < 100ms', () => {
    const todos = generateMockTodos(1000);
    const start = performance.now();
    filterTodos(todos, 'search query');
    const end = performance.now();
    expect(end - start).toBeLessThan(100);
  });
});
```

## Accessibility

### Keyboard Navigation
- Tab to search input
- Type to search (immediate feedback)
- Tab to priority dropdown, arrows to select
- Enter to activate tag filter on badge

### Screen Readers
```tsx
<input 
  type="text"
  placeholder="Search todos..."
  aria-label="Search todos by title or tag"
  aria-describedby="search-help"
/>
<span id="search-help" className="sr-only">
  Search is case-insensitive and includes todo titles and tag names
</span>
```

### Live Regions
```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {filteredTodos.length} todos found
</div>
```

## Out of Scope
- Advanced search syntax (operators, quotes)
- Search suggestions/autocomplete
- Search history
- Saved searches
- Backend full-text search
- Search by due date range
- Search by creation date
- Regular expressions
- Fuzzy matching

## Success Metrics
- 80% of users use search at least once
- Average 5+ searches per session (active users)
- 90% search success rate (results found)
- < 100ms filter response time
- 40% of users combine multiple filters
