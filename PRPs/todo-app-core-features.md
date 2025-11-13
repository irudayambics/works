# Product Requirement Prompt: Todo App Core Features

## Product Overview
A feature-rich todo application with WebAuthn authentication, supporting advanced task management including priorities, recurring tasks, subtasks, tags, templates, and reminders. All operations use Singapore timezone.

## User Personas
- **Primary User**: Individual task managers who need passwordless authentication and comprehensive todo tracking
- **Use Cases**: Daily task management, recurring habit tracking, project task breakdown, template-based task creation

## Core Features

### 1. Authentication & Security
**Requirement**: Passwordless authentication using WebAuthn/Passkeys

**User Flow**:
1. New users register with username + biometric/security key
2. Returning users authenticate with passkey only
3. Session maintained via JWT cookies (7-day expiry)

**Technical Constraints**:
- No traditional passwords allowed
- Must support multiple authenticators per user
- Session stored as HTTP-only cookie
- Protected routes: `/` and `/calendar`

**Acceptance Criteria**:
- [ ] User can register with username and passkey
- [ ] User can login with existing passkey
- [ ] User can logout and session is cleared
- [ ] Unauthenticated users redirected to `/login`
- [ ] Authenticated users can't access `/login` (redirect to home)

---

### 2. Todo CRUD Operations
**Requirement**: Create, read, update, delete todos with rich metadata

**User Flow**:
1. User enters todo title (required)
2. User optionally sets: priority, due date, recurring pattern, reminder
3. User can edit any todo field
4. User can toggle completion status
5. User can delete todos

**Technical Constraints**:
- All dates use Singapore timezone (`Asia/Singapore`)
- Due dates must be at least 1 minute in the future
- Title cannot be empty or whitespace-only
- Deleted todos cascade delete subtasks and tag associations

**Acceptance Criteria**:
- [ ] Can create todo with title only
- [ ] Can create todo with full metadata (priority, due date, recurring, reminder)
- [ ] Can edit todo and preserve metadata
- [ ] Can toggle completion without editing
- [ ] Can delete todo and confirm action
- [ ] All due dates displayed in Singapore time

---

### 3. Priority System
**Requirement**: Three-level priority with visual distinction and sorting

**Levels**:
- **High**: Red badge, sorts first
- **Medium**: Yellow badge, default priority
- **Low**: Blue badge, sorts last

**User Flow**:
1. User selects priority when creating/editing todo
2. System displays color-coded badge next to title
3. Todos auto-sort by priority (high → medium → low)
4. User can filter todos by priority

**Technical Constraints**:
- Type: `'high' | 'medium' | 'low'`
- Default: `'medium'`
- Colors adapt to dark mode

**Acceptance Criteria**:
- [ ] Priority badge visible on all todos
- [ ] Todos sorted by priority (within same status)
- [ ] Filter dropdown shows priority options
- [ ] Color scheme accessible in light/dark mode

---

### 4. Recurring Todos
**Requirement**: Automatically create next instance when completing recurring todos

**Patterns**:
- Daily: Every 24 hours
- Weekly: Every 7 days
- Monthly: Same date next month
- Yearly: Same date next year

**User Flow**:
1. User checks "Repeat" checkbox when creating todo
2. User selects recurrence pattern
3. User sets due date (required for recurring)
4. When user completes todo, system creates next instance
5. Next instance inherits: priority, reminder offset, tags, recurrence pattern

**Technical Constraints**:
- Due date mandatory for recurring todos
- Recurrence pattern: `'daily' | 'weekly' | 'monthly' | 'yearly'`
- Next due date calculated from completion time, not original due date
- Display 🔄 badge with pattern name

**Acceptance Criteria**:
- [ ] Can create recurring todo with pattern
- [ ] Completing recurring todo creates next instance
- [ ] Next instance has correct due date based on pattern
- [ ] Next instance inherits priority and tags
- [ ] Non-recurring behavior unchanged

---

### 5. Reminder & Notification System
**Requirement**: Browser notifications before todo due date

**Timing Options**:
- 15 minutes, 30 minutes, 1 hour, 2 hours before
- 1 day, 2 days, 1 week before

**User Flow**:
1. User clicks "Enable Notifications" button
2. Browser requests notification permission
3. User selects reminder timing when creating/editing todo with due date
4. System checks periodically for upcoming reminders
5. Browser displays notification at reminder time
6. Only one notification sent per todo

**Technical Constraints**:
- Requires due date (reminder field disabled otherwise)
- Frontend polls `/api/notifications/check` endpoint
- Backend tracks `last_notification_sent` to prevent duplicates
- Notifications respect Singapore timezone calculations

**Acceptance Criteria**:
- [ ] Enable notifications button requests permission
- [ ] Reminder dropdown only enabled when due date set
- [ ] Notification fires at correct time (Singapore timezone)
- [ ] Only one notification per reminder
- [ ] 🔔 badge shows reminder timing

---

### 6. Subtasks & Progress Tracking
**Requirement**: Break down todos into smaller checklist items with visual progress

**User Flow**:
1. User expands subtasks section on todo
2. User adds subtask with title
3. User checks/unchecks subtasks
4. System displays progress bar (% completed)
5. User can delete subtasks
6. Subtasks maintain position order

**Technical Constraints**:
- Unlimited subtasks per todo
- Each subtask has: id, title, completed, position
- Progress calculated as (completed / total) * 100
- Cascade delete when parent todo deleted

**Acceptance Criteria**:
- [ ] Can add multiple subtasks to todo
- [ ] Can toggle subtask completion
- [ ] Progress bar updates in real-time
- [ ] Progress shows "X/Y completed (Z%)"
- [ ] Can delete individual subtasks
- [ ] Subtasks deleted when parent todo deleted

---

### 7. Tag System
**Requirement**: Categorize todos with color-coded, reusable labels

**User Flow**:
1. User creates tag with name and color
2. User assigns multiple tags to todo
3. System displays tag badges on todo
4. User can filter todos by tag
5. User can edit tag name/color (updates all todos)
6. User can delete tag (removes from all todos)

**Technical Constraints**:
- Many-to-many relationship (todos ↔ tags)
- Tag names unique per user
- Default color: `#3B82F6` (blue)
- Tag colors must be valid hex codes

**Acceptance Criteria**:
- [ ] Can create tag with custom color
- [ ] Can assign multiple tags to one todo
- [ ] Tag badge shows name + color
- [ ] Can filter by tag (shows only tagged todos)
- [ ] Editing tag updates all associated todos
- [ ] Deleting tag removes from all todos

---

### 8. Template System
**Requirement**: Save and reuse todo patterns with predefined settings

**User Flow**:
1. User creates todo with desired configuration
2. User clicks "Save as Template"
3. User names template, adds optional description/category
4. Later, user clicks "Use Template"
5. System creates new todo from template with:
   - Title (from template)
   - Priority, recurring pattern, reminder offset
   - Subtasks (auto-created from template)
6. User can edit/delete templates

**Technical Constraints**:
- Templates store: title_template, priority, due_date_offset_minutes, reminder_minutes, is_recurring, recurrence_pattern, subtasks_json
- Subtasks stored as JSON: `[{ title: string, position: number }]`
- Templates belong to user (user_id foreign key)
- Optional category for organization

**Acceptance Criteria**:
- [ ] Can save current todo as template
- [ ] Can create todo from template
- [ ] Template preserves all settings except due date
- [ ] Due date calculated from offset at creation time
- [ ] Subtasks auto-created from template
- [ ] Can edit/delete templates

---

### 9. Search & Filtering
**Requirement**: Find todos by text search and multiple filter criteria

**Search Modes**:
- **Simple**: Matches todo title substring
- **Advanced**: Matches title OR tag name

**Filters**:
- Priority (all, high, medium, low)
- Tag (shows only todos with selected tag)
- Status (implicitly: overdue section, active section, completed section)

**User Flow**:
1. User types in search box
2. System filters todos in real-time
3. User selects priority filter
4. Results update immediately
5. User clicks tag to filter by tag
6. Search and filters work together (AND logic)

**Technical Constraints**:
- Case-insensitive search
- Search applies to currently visible section (overdue/active/completed)
- Filters persist until cleared
- No backend search API (client-side filtering)

**Acceptance Criteria**:
- [ ] Search filters todos by title
- [ ] Search includes tag names in results
- [ ] Priority filter works independently
- [ ] Tag filter shows count of tagged todos
- [ ] Clearing search/filter shows all todos
- [ ] Filters combine with AND logic

---

### 10. Export & Import
**Requirement**: Backup and restore todos with full metadata

**Format**: JSON with structure:
```json
{
  "todos": [...],
  "subtasks": [...],
  "tags": [...],
  "todoTags": [...]
}
```

**User Flow**:
1. User clicks "Export Todos"
2. System downloads JSON file
3. User clicks "Import Todos"
4. User selects JSON file
5. System validates format
6. System imports todos, remaps IDs, preserves relationships

**Technical Constraints**:
- Export includes: todos, subtasks, tags, tag associations
- Import remaps all IDs (avoids conflicts)
- Import preserves: todo-subtask relationships, todo-tag relationships
- Invalid JSON shows error message
- Singapore timezone preserved in date fields

**Acceptance Criteria**:
- [ ] Export creates valid JSON file
- [ ] Exported file includes all metadata
- [ ] Import validates JSON structure
- [ ] Import preserves all relationships
- [ ] Import handles ID conflicts
- [ ] Error shown for invalid file

---

### 11. Calendar View
**Requirement**: Visualize todos by due date in monthly calendar

**User Flow**:
1. User navigates to `/calendar`
2. System displays current month with todos on due dates
3. User can navigate previous/next month
4. Clicking date shows todos for that day
5. Shows Singapore public holidays

**Technical Constraints**:
- Calendar uses Singapore timezone
- Todos grouped by due date
- Holidays from `holidays` table
- Month navigation updates URL
- All todo metadata visible on calendar cells

**Acceptance Criteria**:
- [ ] Calendar displays current month
- [ ] Todos appear on correct due date
- [ ] Can navigate months
- [ ] Singapore holidays shown
- [ ] Click date to see day's todos
- [ ] Overdue todos highlighted

---

## Non-Functional Requirements

### Performance
- Page load < 2 seconds
- Todo operations (CRUD) < 500ms
- Search/filter updates < 100ms (client-side)

### Browser Compatibility
- Chrome/Edge (Chromium)
- Firefox
- Safari
- Mobile Chrome/Safari

### Data Persistence
- SQLite database (`todos.db`)
- No external database server required
- Automatic schema migrations via try-catch ALTER TABLE

### Accessibility
- Color contrast meets WCAG AA
- Keyboard navigation for all actions
- Screen reader compatible labels
- Dark mode support

### Security
- HTTP-only session cookies
- CSRF protection via SameSite cookies
- No XSS vulnerabilities (React escaping)
- WebAuthn for phishing-resistant auth

---

## Technical Stack Requirements

### Required Dependencies
- `next@16.0.1` (App Router)
- `react@19.2.0`
- `better-sqlite3@^12.4.1`
- `@simplewebauthn/server@^13.2.2`
- `@simplewebauthn/browser@^13.2.2`
- `jose@^6.1.0` (JWT)
- `tailwindcss@^4`

### Testing Requirements
- Playwright for E2E tests
- Test coverage for all user flows
- Tests organized by feature (matching USER_GUIDE.md)
- Virtual WebAuthn authenticator for auth tests

---

## Out of Scope (Current Version)
- Multi-user collaboration
- Todo sharing/permissions
- Mobile app (PWA only)
- Email notifications
- Third-party integrations (Calendar sync, etc.)
- Attachments/file uploads
- Comments on todos
- Activity history/audit log

---

## Success Metrics
- User can complete full task workflow in < 30 seconds
- Zero password-related support requests
- Recurring todos adoption > 30% of active users
- Template usage for > 20% of todos created
- < 1% error rate on todo operations
