# PRP: Template System

## Feature Overview
Save and reuse todo patterns with predefined configurations, enabling quick creation of common task types with consistent settings.

## User Stories

### As a user with routine tasks
- I want to save todos as templates
- So that I can quickly recreate common task patterns

### As a project manager
- I want templates for project phases (Planning, Execution, Review)
- So that I can start new projects with consistent structure

### As a user with standard workflows
- I want templates to include subtasks
- So that multi-step workflows are immediately ready to use

## User Flow

### Creating a Template
1. User creates a todo with desired configuration:
   - Title, priority, recurrence, reminder
   - Subtasks (optional)
2. User clicks "Save as Template" button
3. Modal opens with template form:
   - Template name (required)
   - Description (optional)
   - Category (optional, e.g., "Work", "Personal")
4. User fills form and clicks "Save Template"
5. Template saved and available for future use

### Using a Template
1. User clicks "Use Template" button
2. Template selection modal opens
3. User browses templates by name/category
4. User selects desired template
5. System creates new todo:
   - Title from template
   - Priority, recurrence, reminder from template
   - Due date calculated from offset (if template has one)
   - Subtasks created from template JSON
6. New todo appears in Active section
7. User can immediately edit if needed

### Managing Templates
1. User opens "Manage Templates" modal
2. List shows all user's templates with:
   - Name, description, category
   - Preview of settings (priority, recurring, etc.)
3. User can:
   - Edit template (change any field)
   - Delete template (with confirmation)
   - View template details

## Technical Requirements

### Database Schema
```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  title_template TEXT NOT NULL,  -- Todo title to create
  priority TEXT DEFAULT 'medium',
  due_date_offset_minutes INTEGER,  -- Minutes from creation time
  reminder_minutes INTEGER,  -- Reminder offset from due date
  is_recurring BOOLEAN DEFAULT 0,
  recurrence_pattern TEXT,
  subtasks_json TEXT,  -- JSON: [{ title: string, position: number }]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Type Definitions
```typescript
interface SubtaskTemplate {
  title: string;
  position: number;
}

interface Template {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  category?: string;
  title_template: string;
  priority: Priority;
  due_date_offset_minutes?: number;
  reminder_minutes?: number;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  subtasks_json?: string;  // JSON string
  created_at: string;
}
```

### API Endpoints

#### `GET /api/templates`
**Get all user's templates**
- Returns: Array of Template objects
- Sorted by: category, then name

#### `POST /api/templates`
**Create template**
- Input:
  ```typescript
  {
    name: string;  // required
    description?: string;
    category?: string;
    title_template: string;  // required
    priority?: Priority;
    due_date_offset_minutes?: number;
    reminder_minutes?: number;
    is_recurring?: boolean;
    recurrence_pattern?: RecurrencePattern;
    subtasks?: SubtaskTemplate[];  // Auto-serialized to JSON
  }
  ```
- Validation:
  - Name required, non-empty
  - title_template required
  - Priority valid enum
  - Recurrence pattern valid enum
- Returns: Created Template object

#### `PUT /api/templates/[id]`
**Update template**
- Input: Same as POST (all fields optional)
- Validation: Same as POST
- Returns: Updated Template object

#### `DELETE /api/templates/[id]`
**Delete template**
- Returns: 204 No Content

#### `POST /api/templates/[id]/use`
**Create todo from template**
- No input needed (uses template ID)
- Logic:
  1. Load template
  2. Calculate due date: `getSingaporeNow() + due_date_offset_minutes`
  3. Create todo with template settings
  4. Create subtasks from subtasks_json
  5. Return created todo
- Returns: Created Todo object with subtasks

### Subtasks JSON Structure
```typescript
// Stored in database as string
const subtasksJson = JSON.stringify([
  { title: "Research options", position: 0 },
  { title: "Compare prices", position: 1 },
  { title: "Make decision", position: 2 }
]);

// Parsed when using template
const subtasks: SubtaskTemplate[] = JSON.parse(template.subtasks_json);
```

### Due Date Offset Calculation
```typescript
import { getSingaporeNow } from '@/lib/timezone';

function calculateDueDate(offsetMinutes?: number): string | null {
  if (!offsetMinutes) return null;
  
  const now = getSingaporeNow();
  now.setMinutes(now.getMinutes() + offsetMinutes);
  
  // Format as YYYY-MM-DDTHH:mm
  return formatToISO(now);
}
```

**Common Offsets:**
- 1 hour: 60
- 1 day: 1440
- 1 week: 10080
- 1 month: 43200

### UI Components

#### Save Template Button
```tsx
<button 
  onClick={() => setShowSaveTemplateModal(true)}
  className="btn-secondary"
>
  Save as Template
</button>
```

#### Save Template Modal
```tsx
<Modal open={showSaveTemplateModal} onClose={() => setShowSaveTemplateModal(false)}>
  <h2>Save as Template</h2>
  
  <input 
    type="text"
    placeholder="Template name"
    value={templateName}
    onChange={(e) => setTemplateName(e.target.value)}
    required
  />
  
  <textarea
    placeholder="Description (optional)"
    value={templateDescription}
    onChange={(e) => setTemplateDescription(e.target.value)}
  />
  
  <input
    type="text"
    placeholder="Category (optional, e.g., Work, Personal)"
    value={templateCategory}
    onChange={(e) => setTemplateCategory(e.target.value)}
  />
  
  <div className="template-preview">
    <h3>Template will include:</h3>
    <ul>
      <li>Priority: {currentTodo.priority}</li>
      {currentTodo.is_recurring && <li>Recurring: {currentTodo.recurrence_pattern}</li>}
      {currentTodo.reminder_minutes && <li>Reminder: {currentTodo.reminder_minutes}m before</li>}
      {currentTodo.subtasks?.length > 0 && <li>{currentTodo.subtasks.length} subtasks</li>}
    </ul>
  </div>
  
  <button onClick={saveAsTemplate}>Save Template</button>
</Modal>
```

#### Use Template Modal
```tsx
<Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)}>
  <h2>Use Template</h2>
  
  {/* Category filter */}
  <select 
    value={categoryFilter}
    onChange={(e) => setCategoryFilter(e.target.value)}
  >
    <option value="">All Categories</option>
    {uniqueCategories.map(cat => (
      <option key={cat} value={cat}>{cat}</option>
    ))}
  </select>
  
  {/* Template list */}
  <div className="templates-list">
    {filteredTemplates.map(template => (
      <div key={template.id} className="template-card">
        <h3>{template.name}</h3>
        {template.description && <p>{template.description}</p>}
        {template.category && <span className="badge">{template.category}</span>}
        
        <div className="template-details">
          <span>Title: {template.title_template}</span>
          <span>Priority: {template.priority}</span>
          {template.is_recurring && <span>🔄 {template.recurrence_pattern}</span>}
          {template.reminder_minutes && <span>🔔 {template.reminder_minutes}m before</span>}
          {template.subtasks_json && (
            <span>{JSON.parse(template.subtasks_json).length} subtasks</span>
          )}
        </div>
        
        <button onClick={() => useTemplate(template.id)}>Use Template</button>
      </div>
    ))}
  </div>
</Modal>
```

### Saving Template from Current Todo
```typescript
async function saveAsTemplate() {
  // Serialize subtasks to JSON
  const subtasksJson = currentTodo.subtasks?.length > 0
    ? JSON.stringify(currentTodo.subtasks.map((s, i) => ({
        title: s.title,
        position: i
      })))
    : null;
  
  const template = {
    name: templateName,
    description: templateDescription || null,
    category: templateCategory || null,
    title_template: currentTodo.title,
    priority: currentTodo.priority,
    due_date_offset_minutes: null,  // User could set this in future
    reminder_minutes: currentTodo.reminder_minutes,
    is_recurring: currentTodo.is_recurring,
    recurrence_pattern: currentTodo.recurrence_pattern,
    subtasks_json: subtasksJson
  };
  
  await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template)
  });
}
```

### Using Template
```typescript
async function useTemplate(templateId: number) {
  const response = await fetch(`/api/templates/${templateId}/use`, {
    method: 'POST'
  });
  
  const newTodo = await response.json();
  
  // Add to todos list
  setTodos([...todos, newTodo]);
  
  // Close modal
  setShowTemplateModal(false);
}
```

## Edge Cases

### Template Without Due Date Offset
- When used, todo created with no due date
- User can set due date manually after creation

### Template With Recurring But No Due Date
- Invalid state (recurring requires due date)
- Template saves but shows warning
- When used, creates non-recurring todo (safer fallback)

### Empty Subtasks
- Template saves with null subtasks_json
- When used, todo created with no subtasks

### Invalid JSON in subtasks_json
- Validation on save prevents this
- If corrupted, skip subtasks during use (log error)

## Acceptance Criteria

- [ ] Can save current todo as template
- [ ] Template name required (validation)
- [ ] Template description and category optional
- [ ] Template captures: title, priority, recurring, reminder, subtasks
- [ ] Can view all templates in modal
- [ ] Templates grouped/filtered by category
- [ ] Can use template to create new todo
- [ ] New todo has template's priority and settings
- [ ] New todo's due date calculated from offset (if set)
- [ ] Subtasks created from template JSON
- [ ] Can edit template
- [ ] Can delete template (with confirmation)
- [ ] Deleting template doesn't affect existing todos

## Testing Requirements

### E2E Tests
```
tests/06-templates.spec.ts
```

Test cases:
- [ ] Create template from todo with all settings
- [ ] Create template from todo with subtasks
- [ ] Use template to create new todo
- [ ] Verify new todo has correct settings
- [ ] Verify subtasks created from template
- [ ] Edit template name and description
- [ ] Delete template
- [ ] Filter templates by category

### JSON Serialization Tests
```typescript
describe('Template subtasks JSON', () => {
  it('serializes subtasks correctly', () => {
    const subtasks = [
      { title: "Step 1", position: 0 },
      { title: "Step 2", position: 1 }
    ];
    const json = JSON.stringify(subtasks);
    expect(JSON.parse(json)).toEqual(subtasks);
  });
  
  it('handles empty subtasks', () => {
    expect(JSON.parse(null)).toBeNull();
  });
});
```

## Integration with Other Features

### Recurring Todos
- Template can include recurring settings
- New todo from template is recurring (if template is)

### Tags
- Future enhancement: Templates could include default tags
- Current version: User adds tags manually after creation

### Priority
- Template preserves priority
- High-priority template creates high-priority todo

## Out of Scope
- Template sharing (public templates)
- Template marketplace
- Template versioning
- Template variables (dynamic title substitution)
- Multi-todo templates (project templates)
- Template usage statistics

## Success Metrics
- 20% of users create templates
- Average 3-5 templates per user
- 30% of todos created from templates
- Template users save 30+ seconds per templated todo
