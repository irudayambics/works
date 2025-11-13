# PRP: Tag System

## Feature Overview
Categorize and organize todos with reusable, color-coded labels for flexible filtering and visual identification.

## User Stories

### As a user organizing projects
- I want to tag todos by project (e.g., #work, #personal)
- So that I can filter and see all related tasks together

### As a user managing contexts
- I want to tag todos by context (e.g., #urgent, #waiting, #someday)
- So that I can work on similar types of tasks in batches

### As a visual organizer
- I want custom colors for each tag
- So that I can quickly identify todo categories at a glance

## User Flow

### Creating a Tag
1. User clicks "Manage Tags" button
2. Tag management modal opens
3. User enters tag name
4. User selects color from color picker (or uses default blue)
5. User clicks "Create Tag"
6. Tag appears in tag list

### Assigning Tags to Todo
1. User creates or edits a todo
2. User clicks "Add Tag" dropdown
3. User selects one or more tags
4. Selected tags display as colored badges
5. User saves todo
6. Tags visible on todo card

### Filtering by Tag
1. User clicks on a tag badge (on any todo)
2. System filters to show only todos with that tag
3. Tag name displayed in filter indicator
4. User clicks "Clear filter" to show all todos

### Editing a Tag
1. User opens "Manage Tags" modal
2. User clicks edit icon on tag
3. User changes name and/or color
4. User clicks "Save"
5. All todos with that tag update immediately

### Deleting a Tag
1. User opens "Manage Tags" modal
2. User clicks delete icon on tag
3. Confirmation prompt appears
4. User confirms
5. Tag removed from all todos
6. Tag deleted from system

## Technical Requirements

### Database Schema
```sql
-- Tags table
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',  -- Default blue
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, name)  -- Tag names unique per user
);

-- Many-to-many junction table
CREATE TABLE todo_tags (
  todo_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (todo_id, tag_id),
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

### Type Definitions
```typescript
interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;  // Hex color code
  created_at: string;
}

interface Todo {
  // ... other fields
  tags?: Tag[];
}
```

### API Endpoints

#### `GET /api/tags`
**Get all user's tags**
- Returns: Array of Tag objects
- Sorted by name (alphabetical)

#### `POST /api/tags`
**Create new tag**
- Input: `{ name: string, color?: string }`
- Validation:
  - Name required, non-empty
  - Name unique per user
  - Color must be valid hex code (if provided)
- Default color: `#3B82F6`
- Returns: Created Tag object
- Error 409 if duplicate name

#### `PUT /api/tags/[id]`
**Update tag**
- Input: `{ name?: string, color?: string }`
- Validation: Same as create
- Updates all associated todos
- Returns: Updated Tag object

#### `DELETE /api/tags/[id]`
**Delete tag**
- Cascades: Removes from all todo_tags associations
- Returns: 204 No Content

#### `POST /api/todos/[id]/tags`
**Assign tag to todo**
- Input: `{ tagId: number }`
- Creates todo_tags association
- Returns: Updated todo with tags

#### `DELETE /api/todos/[id]/tags`
**Remove tag from todo**
- Input: `{ tagId: number }` (in query or body)
- Deletes todo_tags association
- Returns: 204 No Content

### Tag Name Validation
```typescript
function validateTagName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Tag name required' };
  }
  
  if (name.length > 30) {
    return { valid: false, error: 'Tag name too long (max 30 characters)' };
  }
  
  // Optional: Prevent special characters
  if (!/^[a-zA-Z0-9\s-_]+$/.test(name)) {
    return { valid: false, error: 'Tag name contains invalid characters' };
  }
  
  return { valid: true };
}
```

### Color Validation
```typescript
function validateColor(color: string): boolean {
  // Valid hex color: #RRGGBB or #RGB
  return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}
```

### UI Components

#### Tag Badge
```tsx
<span 
  className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full"
  style={{ 
    backgroundColor: tag.color,
    color: getContrastColor(tag.color)  // Auto white/black text
  }}
  onClick={() => filterByTag(tag.id)}
>
  #{tag.name}
</span>
```

#### Tag Management Modal
```tsx
<Modal open={showTagModal} onClose={() => setShowTagModal(false)}>
  <h2>Manage Tags</h2>
  
  {/* Create form */}
  <div className="create-tag-form">
    <input 
      type="text" 
      placeholder="Tag name"
      value={newTagName}
      onChange={(e) => setNewTagName(e.target.value)}
    />
    <input 
      type="color"
      value={newTagColor}
      onChange={(e) => setNewTagColor(e.target.value)}
    />
    <button onClick={createTag}>Create Tag</button>
  </div>
  
  {/* Tag list */}
  <div className="tags-list">
    {tags.map(tag => (
      <div key={tag.id} className="tag-item">
        <span style={{ backgroundColor: tag.color }}>#{tag.name}</span>
        <button onClick={() => editTag(tag)}>Edit</button>
        <button onClick={() => deleteTag(tag.id)}>Delete</button>
      </div>
    ))}
  </div>
</Modal>
```

#### Tag Selection (Todo Form)
```tsx
<div className="tag-selection">
  <label>Tags</label>
  <select 
    multiple
    value={selectedTags}
    onChange={(e) => {
      const selected = Array.from(e.target.selectedOptions, option => Number(option.value));
      setSelectedTags(selected);
    }}
  >
    {tags.map(tag => (
      <option key={tag.id} value={tag.id}>
        #{tag.name}
      </option>
    ))}
  </select>
  
  {/* Or checkboxes for better UX */}
  {tags.map(tag => (
    <label key={tag.id}>
      <input 
        type="checkbox"
        checked={selectedTags.includes(tag.id)}
        onChange={(e) => {
          if (e.target.checked) {
            setSelectedTags([...selectedTags, tag.id]);
          } else {
            setSelectedTags(selectedTags.filter(id => id !== tag.id));
          }
        }}
      />
      <span style={{ color: tag.color }}>#{tag.name}</span>
    </label>
  ))}
</div>
```

### Color Contrast Helper
```typescript
// Ensure readable text on colored backgrounds
function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
```

## Tag Filtering

### Filter State
```typescript
const [tagFilter, setTagFilter] = useState<number | null>(null);

// Apply filter
const filteredTodos = todos.filter(todo => {
  if (!tagFilter) return true;
  return todo.tags?.some(tag => tag.id === tagFilter);
});
```

### Filter UI
```tsx
{tagFilter && (
  <div className="active-filter">
    <span>Filtered by: #{tags.find(t => t.id === tagFilter)?.name}</span>
    <button onClick={() => setTagFilter(null)}>Clear Filter</button>
  </div>
)}
```

## Integration with Other Features

### Recurring Todos
- Next instance inherits all tags from current todo
- Tag associations copied during recurrence creation

### Templates
- Templates can include default tags
- When template used, tags assigned to new todo

### Export/Import
- Export includes: tags table + todo_tags associations
- Import remaps tag IDs, preserves relationships

## Edge Cases

### Duplicate Tag Name
- User tries to create tag with existing name
- Server returns 409 Conflict
- UI shows: "Tag name already exists"

### Deleting Tag with Todos
- Tag deleted from database
- Cascade removes from todo_tags
- Todos remain, just lose that tag

### Editing Tag Name to Duplicate
- Server validates uniqueness
- Returns error if name taken

### Tag with No Todos
- "Orphan" tags allowed (valid use case)
- User might create tags for future use

### Todo with Many Tags
- No hard limit (reasonable: 5-10)
- UI truncates/scrolls if too many

## Acceptance Criteria

- [ ] Can create tag with custom name and color
- [ ] Tag name unique per user (validation)
- [ ] Default color applied if none selected
- [ ] Can edit tag name and color
- [ ] Editing tag updates all associated todos
- [ ] Can delete tag (with confirmation)
- [ ] Deleting tag removes from all todos
- [ ] Can assign multiple tags to one todo
- [ ] Tags display as colored badges on todo
- [ ] Clicking tag badge filters todos
- [ ] Filter shows only todos with that tag
- [ ] Can clear tag filter
- [ ] "Manage Tags" modal lists all user's tags
- [ ] Tags sorted alphabetically
- [ ] Tag colors meet accessibility contrast requirements

## Testing Requirements

### E2E Tests
```
tests/05-tags.spec.ts
```

Test cases:
- [ ] Create tag with name and color
- [ ] Create tag with default color
- [ ] Assign tag to todo
- [ ] Assign multiple tags to todo
- [ ] Filter by tag
- [ ] Clear tag filter
- [ ] Edit tag name/color
- [ ] Delete tag removes from todos
- [ ] Duplicate tag name shows error

### Validation Tests
```typescript
describe('Tag validation', () => {
  it('rejects empty tag name', () => { /* ... */ });
  it('rejects duplicate tag name', () => { /* ... */ });
  it('accepts valid hex color', () => { /* ... */ });
  it('rejects invalid hex color', () => { /* ... */ });
});
```

## Accessibility

### Color Blindness
- Don't rely solely on color for meaning
- Tag names provide text alternative
- Use patterns/icons (future enhancement)

### Keyboard Navigation
- Tab through tag list
- Enter to select/filter
- Escape to close modal

### Screen Readers
```tsx
<span 
  role="button"
  aria-label={`Filter by ${tag.name} tag`}
  style={{ backgroundColor: tag.color }}
>
  #{tag.name}
</span>
```

## Performance Considerations

### Tag Loading
- Load all user's tags once on app init
- Cache in state (typically < 50 tags)
- No pagination needed at this scale

### Tag Filtering
- Client-side filtering (fast for < 1000 todos)
- No API call needed for filter

## Out of Scope
- Tag hierarchies (parent/child tags)
- Tag descriptions
- Tag icons/emojis
- Tag analytics (most used, etc.)
- Shared tags across users
- Tag suggestions/autocomplete
- Bulk tag operations

## Success Metrics
- 60% of users create tags
- Average 5-7 tags per user
- 50% of todos have at least one tag
- Tag filtering used 3+ times per session
