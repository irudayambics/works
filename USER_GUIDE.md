# Todo App - Comprehensive User Guide

## Table of Contents
1. [Authentication](#1-authentication)
2. [Creating Todos](#2-creating-todos)
3. [Priority Levels](#3-priority-levels)
4. [Due Dates & Time Management](#4-due-dates--time-management)
5. [Recurring Todos](#5-recurring-todos)
6. [Reminders & Notifications](#6-reminders--notifications)
7. [Subtasks & Checklists](#7-subtasks--checklists)
8. [Tags & Categories](#8-tags--categories)
9. [Todo Templates](#9-todo-templates)
10. [Search & Advanced Filtering](#10-search--advanced-filtering)
11. [Export & Import](#11-export--import)
12. [Calendar View](#12-calendar-view)
13. [Managing Todos](#13-managing-todos)
14. [Dark Mode](#14-dark-mode)
15. [Tips & Best Practices](#tips--best-practices)
16. [Troubleshooting](#troubleshooting)

---

## 1. Authentication

### What It Does
The app uses modern **WebAuthn/Passkeys** authentication for secure, passwordless access to your todos.

### How to Use
- **Register**: Enter a username and use your device's biometric authentication (fingerprint, face ID) or security key
- **Login**: Select your username and authenticate with your passkey
- **Logout**: Click the "Logout" button in the top-right corner

### Benefits
- ✅ No passwords to remember
- ✅ More secure than traditional passwords
- ✅ Works across devices with passkey sync
- ✅ Uses Singapore timezone for all date/time operations

---

## 2. Creating Todos

### What It Does
Create tasks with titles, due dates, priorities, and additional features.

### How to Use
1. Enter your todo title in the main input field
2. Select a priority level (High/Medium/Low)
3. Optionally set a due date and time
4. Click **"Add"** to create the todo

### Key Features
- Todos are automatically sorted by priority and due date
- All dates/times use **Singapore timezone**
- Minimum due date is 1 minute in the future
- Title is required (cannot be empty or whitespace)

### Form Location
Found at the top of the main page with:
- Text input for title
- Priority dropdown
- Date-time picker
- Add button

---

## 3. Priority Levels

### What It Does
Organize todos by importance with three priority levels, each with distinct color coding.

### Priority Types

| Priority | Color | Use Case |
|----------|-------|----------|
| **High** | 🔴 Red | Urgent, critical tasks |
| **Medium** | 🟡 Yellow | Standard tasks (default) |
| **Low** | 🔵 Blue | Less urgent tasks |

### How to Use
- Select priority when creating a todo using the dropdown menu
- Todos are automatically sorted with high priority tasks appearing first
- Change priority by editing the todo
- Filter todos by priority using the priority filter dropdown

### Visual Indicators
- Each priority level has unique color-coded badges
- Badge appears next to todo title in all views
- Colors adapt automatically in dark mode
- Overdue section maintains priority badges

---

## 4. Due Dates & Time Management

### What It Does
Set specific date and time deadlines for your todos with intelligent time-based displays.

### How to Use
1. Click the **date-time picker** when creating/editing a todo
2. Select date and time (must be in the future)
3. The system enforces **Singapore timezone**
4. Leave blank if no due date needed

### Smart Time Display

The app shows different formats based on urgency:

| Time Until Due | Display Format | Color |
|----------------|----------------|-------|
| Overdue | "X days/hours/minutes overdue" | 🔴 Red |
| < 1 hour | "Due in X minutes" | 🔴 Red |
| < 24 hours | "Due in X hours (timestamp)" | 🟠 Orange |
| < 7 days | "Due in X days (timestamp)" | 🟡 Yellow |
| 7+ days | Full timestamp | 🔵 Blue |

### Overdue Tracking
- Overdue todos appear in a separate **"Overdue"** section with red background
- Warning icon (⚠️) highlights overdue items
- Counter shows total overdue items: "Overdue (X)"
- Automatic calculation based on Singapore time
- Updates in real-time

---

## 5. Recurring Todos

### What It Does
Automatically create repeating tasks on a schedule (daily, weekly, monthly, or yearly).

### How to Use
1. Check the **"Repeat"** checkbox when creating a todo
2. Select recurrence pattern from dropdown:
   - **Daily**: Repeats every day
   - **Weekly**: Repeats every 7 days
   - **Monthly**: Repeats on the same date next month
   - **Yearly**: Repeats annually
3. **Set a due date** (required for recurring todos)
4. When you complete the recurring todo, a new instance is automatically created for the next occurrence

### Visual Indicators
- Recurring todos display a **🔄 badge** with the pattern (e.g., "🔄 weekly")
- Purple badge with border in light mode
- Adapted colors for dark mode visibility

### How It Works
- Next occurrence maintains the same settings:
  - Same priority level
  - Same reminder timing
  - Same recurrence pattern
  - Same tags (if any)
- Due date automatically calculated based on pattern
- New instance only created when current one is marked complete

### Use Cases
- Daily habits (exercise, medication)
- Weekly meetings or reports
- Monthly bill payments
- Yearly reviews or renewals

---

## 6. Reminders & Notifications

### What It Does
Receive browser notifications before your todos are due to stay on top of deadlines.

### How to Enable
1. Click **"🔔 Enable Notifications"** button (orange, top-right)
2. Grant browser notification permission when prompted
3. Once enabled, button shows **"🔔 Notifications On"** (green badge)

### Setting Reminders

When creating or editing a todo with a due date:

1. Use the **"Reminder"** dropdown
2. Select timing:
   - 15 minutes before
   - 30 minutes before
   - 1 hour before
   - 2 hours before
   - 1 day before
   - 2 days before
   - 1 week before
3. Select "None" to remove reminder

### Requirements
- ⚠️ Todo must have a due date
- ⚠️ Reminder field disabled if no due date set
- ⚠️ Browser must support notifications
- ⚠️ Permission must be granted

### Visual Indicators
Todos with reminders show a **🔔 badge** with abbreviated time:
- `🔔 15m` - 15 minutes
- `🔔 30m` - 30 minutes
- `🔔 1h` - 1 hour
- `🔔 2h` - 2 hours
- `🔔 1d` - 1 day
- `🔔 2d` - 2 days
- `🔔 1w` - 1 week

### How It Works
- System checks every minute for pending reminders
- Notification sent when reminder time arrives
- Each reminder only sent once (tracked via `last_notification_sent`)
- Notifications persist until acknowledged
- Works even if browser tab is in background

---

## 7. Subtasks & Checklists

### What It Does
Break down complex todos into smaller, manageable subtasks with real-time progress tracking.

### How to Use

#### Creating Subtasks
1. Click **"▶ Subtasks"** button on any todo to expand
2. Enter subtask title in the input field
3. Press **Enter** or click **"Add"** to create
4. Repeat for additional subtasks

#### Managing Subtasks
- **Complete**: Click checkbox next to subtask
- **Uncomplete**: Click checked checkbox to mark incomplete
- **Delete**: Click **✕** button on right side of subtask
- **Collapse**: Click **"▼ Subtasks"** to hide subtask list

### Progress Tracking

#### Visual Progress Bar
- Shows completion percentage (0-100%)
- Blue progress bar updates in real-time
- Located below todo title
- Visible even when subtasks are collapsed

#### Text Indicator
- Format: `"X/Y subtasks"`
- Shows completed count / total count
- Example: `"3/7 subtasks"` = 42% complete

### Features
- ✅ Unlimited subtasks per todo
- ✅ Subtasks maintain their order (position-based)
- ✅ Included in search functionality
- ✅ CASCADE delete (all subtasks removed when parent deleted)
- ✅ Independent completion (subtask completion doesn't affect parent)
- ✅ Real-time progress updates

### Use Cases
- Multi-step projects
- Meeting agendas with action items
- Shopping lists
- Recipe steps
- Onboarding checklists
- Project milestones

---

## 8. Tags & Categories

### What It Does
Organize todos with custom color-coded labels for better categorization and filtering.

### Managing Tags

#### Creating Tags
1. Click **"+ Manage Tags"** button (near todo form)
2. In the modal:
   - Enter tag name in text field
   - Select color using color picker or enter hex code
   - Click **"Create Tag"**
3. Tag appears in your tag list immediately

#### Editing Tags
1. Open tag management modal
2. Click **"Edit"** button next to any tag
3. Modify name and/or color
4. Click **"Update"**
5. Changes reflect on all todos using that tag

#### Deleting Tags
1. Open tag management modal
2. Click **"Delete"** button next to tag
3. Confirm deletion
4. Tag removed from all todos (CASCADE delete)

### Using Tags on Todos

#### When Creating Todos
1. View tags section below todo form (if tags exist)
2. Click tag pills to select/deselect
3. Selected tags show:
   - ✓ Checkmark
   - Colored background
   - White text
4. Unselected tags show:
   - No checkmark
   - White/gray background
   - Gray border
5. Multiple tags can be selected

#### When Editing Todos
1. Click **"Edit"** on a todo
2. Tag selection appears in edit modal
3. Toggle tags on/off
4. Click **"Update"** to save

### Filtering by Tags
1. Use **"All Tags"** dropdown in filter section
2. Select a tag to show only todos with that tag
3. Tag filter combines with other filters (search, priority, dates)
4. Select "All Tags" to clear tag filter

### Visual Display
- Tags appear as **colored pills** on todos
- Tag names in **white text** on colored background
- Rounded full shape for visual appeal
- Positioned after priority and recurrence badges
- Visible in all sections (Overdue, Pending, Completed)

### Tag Features
- 🔐 User-specific (each user has their own tags)
- 📌 Unique names per user (no duplicate names)
- 🔄 CASCADE delete (removing tag updates all todos)
- ⚡ Real-time updates across all todos
- 🎨 Custom colors with hex code support
- 📱 Responsive display (wraps on mobile)

### Tag Management Modal
- **Default color**: `#3B82F6` (blue)
- **Color picker**: Standard HTML color input
- **Hex input**: Manual entry supported
- **Tag list**: Shows all your tags with actions
- **Dark mode**: Fully supported

---

## 9. Todo Templates

### What It Does
Save frequently used todo patterns as reusable templates for instant creation of common tasks.

### Creating Templates

#### From Todo Form
1. Fill out the todo form with:
   - Title
   - Priority
   - Recurrence settings (if applicable)
   - Reminder timing (if applicable)
2. Click **"💾 Save as Template"** button (appears when title is filled)
3. Enter template details in modal:
   - **Name**: Template identifier (required)
   - **Description**: Purpose/details (optional)
   - **Category**: Group similar templates (optional)
4. Click **"Save Template"**
5. Template saved to your library

### Using Templates

#### Quick Use from Dropdown
1. In todo form, find **"Use Template"** dropdown
2. Select a template from the list
3. Todo created **instantly** with template settings
4. Templates show category in parentheses if set
   - Example: `"Weekly Review (Work)"`

#### From Template Manager
1. Click **"📋 Templates"** button (top navigation)
2. Browse all saved templates
3. Click **"Use"** button on any template
4. Todo created immediately
5. Modal closes automatically

### Managing Templates

#### Template Manager Modal
Access via **"📋 Templates"** button to:
- View all templates in a list
- See template details (name, description, category)
- Preview settings (priority, recurrence)
- Use templates with one click
- Delete templates no longer needed

#### Template Information Display
Each template shows:
- **Name** (bold, prominent)
- **Description** (if provided)
- **Category** (if provided) - color-coded badge
- **Priority** - color-coded badge
- **Recurrence** - 🔄 badge if recurring
- **Pattern** - recurrence frequency
- **Reminder** - 🔔 badge if set

#### Deleting Templates
1. In template modal, click **"Delete"** on any template
2. Confirm deletion
3. Template removed from library
4. **Does NOT affect existing todos** created from template

### What's Saved in Templates

Templates preserve:
- ✅ Todo title (as title_template)
- ✅ Priority level (high/medium/low)
- ✅ Recurrence settings (enabled/disabled)
- ✅ Recurrence pattern (daily/weekly/monthly/yearly)
- ✅ Reminder timing (minutes before due)
- ✅ Category information
- ✅ Description

**Note**: Templates do NOT include:
- ❌ Specific due dates (you set when creating)
- ❌ Tags (selected when creating from template)
- ❌ Subtasks (added after creation)

### Template Categories

Categories help organize templates:
- **Work**: Business tasks, meetings, reports
- **Personal**: Home, family, health
- **Finance**: Bills, budgets, payments
- **Health**: Exercise, medication, appointments
- **Education**: Study, courses, assignments
- *Custom categories*: Create your own

### Use Cases

#### Professional
- Weekly team meeting agenda
- Monthly status report
- Daily standup tasks
- Quarterly review preparation
- Client onboarding checklist

#### Personal
- Weekly meal planning
- Monthly budget review
- Daily exercise routine
- Medication reminders
- Home maintenance tasks

#### Project Management
- Sprint planning template
- Code review checklist
- Deployment procedure
- Testing protocol
- Documentation update

---

## 10. Search & Advanced Filtering

### What It Does
Powerful search and filtering system to find exactly the todos you need with multi-criteria filtering and saved presets.

### Search Bar

#### Location & Appearance
- Located at top of todo list (below todo form)
- Full-width input with search icon (🔍)
- Placeholder: "Search todos and subtasks..."
- Clear button (✕) appears when typing

#### How It Works
- **Searches**: Todo titles AND subtask titles
- **Real-time**: Results update as you type
- **Case-insensitive**: Finds "meeting" or "Meeting"
- **Partial match**: "proj" finds "project" and "projection"
- **Clear**: Click ✕ or delete all text

#### Search Behavior
```
Search: "report"
Finds:
✓ "Monthly Report" (todo title)
✓ "Meeting Notes" with subtask "Send report to team"
✓ "Project Alpha" with subtask "Quarterly reporting"
```

### Quick Filters

Located below search bar in a horizontal row:

#### Priority Filter
- Dropdown: "All Priorities"
- Options:
  - All Priorities (default)
  - High Priority
  - Medium Priority
  - Low Priority
- Combines with other filters

#### Tag Filter
- Dropdown: "All Tags"
- Shows only if tags exist
- Options:
  - All Tags (default)
  - Individual tag names
- Combines with other filters

#### Advanced Toggle
- Button: "▶ Advanced" (collapsed) or "▼ Advanced" (expanded)
- Toggles advanced filters panel
- Blue background when active
- Gray background when inactive

#### Active Filter Actions
Appears when ANY filter is active:
- **"Clear All"** button (red) - Removes all filters instantly
- **"💾 Save Filter"** button (green) - Opens save filter modal

### Advanced Filters Panel

Click "▶ Advanced" to reveal:

#### 1. Completion Status
- **Dropdown** with options:
  - All Todos (default)
  - Incomplete Only
  - Completed Only
- Filters based on checkbox state

#### 2. Date Range
Two date inputs side-by-side:

**Due Date From**
- Start of date range
- Format: YYYY-MM-DD
- Optional (can use alone)

**Due Date To**
- End of date range
- Format: YYYY-MM-DD
- Optional (can use alone)

**Behavior**:
- Use both for specific range
- Use "From" only: all todos after that date
- Use "To" only: all todos before that date
- Only shows todos WITH due dates

#### 3. Saved Filter Presets
Displayed if any presets exist:
- **Preset pills** with name
- **Apply button**: Click name to apply
- **Delete button**: Click ✕ to remove
- **Format**: `[Preset Name] [✕]`

### Saving Filter Presets

#### How to Save
1. Apply any combination of filters:
   - Search query
   - Priority
   - Tag
   - Date range
   - Completion status
2. Click **"💾 Save Filter"** button (appears when filters active)
3. Modal opens showing:
   - Name input field
   - Current filter preview
4. Enter preset name
5. Click **"Save"**

#### Save Filter Modal

**Shows Current Filters**:
- ✓ Search query (if entered)
- ✓ Priority filter (if selected)
- ✓ Tag filter (if selected)
- ✓ Date range (if set)
- ✓ Completion filter (if not "all")

**Example Preview**:
```
Current Filters:
• Search: "meeting"
• Priority: High
• Tag: Work
• Completion: Incomplete
• Date Range: 2025-11-01 to 2025-11-07
```

#### Preset Storage
- **Location**: Browser localStorage
- **Persistence**: Survives page refresh
- **User-specific**: Per browser/device
- **Format**: JSON object

### Applying Saved Presets

#### Method 1: From Advanced Panel
1. Open advanced filters
2. Find "Saved Filter Presets" section
3. Click preset name
4. All filters applied instantly

#### Method 2: Quick Application
- Presets visible when advanced panel open
- One-click application
- Overwrites current filters

### Managing Presets

#### Deleting Presets
1. Locate preset in advanced panel
2. Click ✕ button next to name
3. Confirm deletion
4. Preset removed from localStorage

### Filter Combinations

#### How Filters Work Together
All active filters use **AND** logic (must match all):

**Example**:
```
Search: "report"
Priority: High
Tag: Work
Date: 2025-11-01 to 2025-11-07
Completion: Incomplete

Result: Shows only todos that are:
✓ Contain "report" in title or subtasks
✓ AND have High priority
✓ AND tagged with "Work"
✓ AND due between Nov 1-7
✓ AND not completed
```

#### Filter Priority
1. Search filter applied first
2. Priority filter
3. Tag filter
4. Completion filter
5. Date range filter (last)

### Filter Indicators

#### Active Filter State
- "Clear All" and "Save Filter" buttons visible
- Advanced button shows state (▶/▼)
- Selected values in dropdowns
- Search text visible in input
- Date values in date inputs

#### Filter Results
- Todo counts update: "Overdue (X)", "Pending (X)", "Completed (X)"
- Sections auto-hide if empty
- "No results" state if all filtered out

### Search Examples

#### Basic Search
```
Search: "meeting"
→ Finds all todos/subtasks containing "meeting"
```

#### Search + Priority
```
Search: "project"
Priority: High
→ Only high-priority items about projects
```

#### Date Range Filter
```
Date From: 2025-11-01
Date To: 2025-11-07
→ Shows this week's todos only
```

#### Complex Combination
```
Search: "report"
Priority: High
Tag: Work
Completion: Incomplete
Date: This week
→ High-priority incomplete work reports due this week
```

#### Tag + Completion
```
Tag: Personal
Completion: Completed
→ Review all completed personal tasks
```

### Filter Tips

#### Efficiency
- ⚡ Save frequent combinations as presets
- ⚡ Use "Clear All" for quick reset
- ⚡ Combine search with tags for precise results
- ⚡ Date ranges great for weekly planning

#### Organization
- 📋 Create presets for daily workflows
- 📋 "Today's High Priority" preset
- 📋 "This Week Work Items" preset
- 📋 "Overdue Personal Tasks" preset

#### Analysis
- 📊 Use completion filter + tags to review category progress
- 📊 Date ranges to analyze past performance
- 📊 Search specific terms to track recurring topics

---

## 11. Export & Import

### What It Does
Backup your todos, share them between devices, or analyze data in spreadsheets with JSON and CSV export formats.

### Export Functionality

#### How to Export

**JSON Export**:
1. Click **"Export JSON"** button (green, top-right)
2. File downloads automatically
3. Filename format: `todos-YYYY-MM-DD.json`
4. Example: `todos-2025-11-02.json`

**CSV Export**:
1. Click **"Export CSV"** button (dark green, top-right)
2. File downloads automatically
3. Filename format: `todos-YYYY-MM-DD.csv`
4. Example: `todos-2025-11-02.csv`

#### Export Formats Comparison

**JSON Export**
- ✅ Complete data with all fields
- ✅ Nested structure preserved
- ✅ Can be re-imported
- ✅ Includes metadata
- ✅ Best for backup and data transfer
- ✅ Human-readable format

**Fields Included**:
```json
{
  "id": 1,
  "title": "Sample Todo",
  "completed": false,
  "due_date": "2025-11-10T14:00",
  "priority": "high",
  "is_recurring": true,
  "recurrence_pattern": "weekly",
  "reminder_minutes": 60,
  "created_at": "2025-11-02T10:30:00"
}
```

**CSV Export**
- ✅ Spreadsheet-friendly format
- ✅ Opens in Excel, Google Sheets, Numbers
- ✅ Good for analysis and reporting
- ✅ Column-based layout
- ✅ Easy data visualization
- ❌ Cannot be re-imported

**Columns**:
```csv
ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder
1,"Sample Todo",false,"2025-11-10T14:00","high",true,"weekly",60
```

### Import Functionality

#### How to Import
1. Click **"Import"** button (blue, top-right)
2. File picker opens
3. Select JSON file (from previous export)
4. Click "Open"
5. File is validated and processed

#### Import Process
1. **File validation**: Checks JSON format
2. **Data validation**: Verifies todo structure
3. **Creation**: Creates new todos
4. **Refresh**: Todo list updates automatically
5. **Confirmation**: Success message displays

#### Import Behavior

**What Happens**:
- ✅ Creates NEW todos (doesn't update existing)
- ✅ Preserves all todo properties
- ✅ Assigns new IDs
- ✅ Links to current user
- ✅ Validates data before import

**What's Preserved**:
- Todo titles
- Completion status
- Due dates
- Priority levels
- Recurrence settings
- Reminder timings
- Creation timestamps

**What's NOT Imported**:
- ❌ Original todo IDs (new IDs assigned)
- ❌ User associations (links to importing user)
- ❌ Tags (must be recreated/reassigned)
- ❌ Subtasks (if not in export format)

#### Import Validation

**Success Conditions**:
- Valid JSON format
- Correct data structure
- Required fields present
- Valid enum values (priority, pattern)

**Error Conditions**:
- Invalid JSON syntax
- Missing required fields
- Corrupted file
- Wrong file format

**Error Messages**:
```
✗ "Failed to import todos. Please check the file format."
✗ "Invalid JSON format"
✗ "Failed to import todos" (network error)
```

**Success Message**:
```
✓ "Successfully imported X todos"
```

### Use Cases

#### Backup Strategy
1. **Daily**: Export JSON at end of day
2. **Weekly**: Export CSV for review
3. **Monthly**: Archive JSON exports
4. **Before major changes**: Safety backup

#### Data Transfer
1. Export JSON on device A
2. Send file to device B (email, cloud, USB)
3. Import JSON on device B
4. Continue working with same todos

#### Analysis & Reporting
1. Export CSV weekly/monthly
2. Open in spreadsheet application
3. Create pivot tables
4. Analyze completion rates
5. Track priorities distribution
6. Review time management

#### Collaboration
1. Export todos as JSON
2. Share with team member
3. They import to their account
4. Maintain separate but synchronized lists

### Tips & Best Practices

#### Export Tips
- 📅 Export regularly (recommended: weekly)
- 📅 Use JSON for complete backups
- 📅 Use CSV for viewing in spreadsheets
- 📅 Keep exports organized by date
- 📅 Store in cloud storage for safety

#### Import Tips
- ⚠️ Only import files from this app
- ⚠️ Verify file before importing
- ⚠️ Import creates duplicates (doesn't merge)
- ⚠️ Review after import to verify data
- ⚠️ Delete test imports if needed

#### File Management
- 📁 Create export folder structure:
  ```
  /TodoBackups
    /2025
      /11-November
        todos-2025-11-02.json
        todos-2025-11-09.json
  ```
- 📁 Name files descriptively if needed
- 📁 Compress old exports (zip)
- 📁 Delete outdated backups

### Technical Details

#### Export API
- **Endpoint**: `/api/todos/export?format={json|csv}`
- **Method**: GET
- **Response**: File download
- **MIME types**:
  - JSON: `application/json`
  - CSV: `text/csv`

#### Import API
- **Endpoint**: `/api/todos/import`
- **Method**: POST
- **Content-Type**: `application/json`
- **Body**: Array of todo objects
- **Response**: Success message with count

#### File Size Considerations
- Small list (< 100 todos): < 50KB
- Medium list (100-500 todos): 50-250KB
- Large list (> 500 todos): > 250KB
- No file size limit enforced

---

## 12. Calendar View

### What It Does
Visualize your todos on a monthly calendar to see your schedule at a glance, spot conflicts, and plan ahead.

### Accessing Calendar View

#### From Main Page
1. Click **"Calendar"** button (purple, top navigation)
2. View switches to calendar layout
3. URL changes to `/calendar`

#### Navigation
- **To Calendar**: Click "Calendar" button
- **Back to List**: Browser back button or navigate to home
- **Always available**: Calendar button visible on both pages

### Calendar Features

#### Monthly View
- Full month calendar grid
- Current month displayed by default
- Days organized in week rows
- Week starts on Sunday (configurable)

#### Todo Display on Calendar
- Todos appear on their due date
- Color-coded by priority:
  - 🔴 High priority in red
  - 🟡 Medium priority in yellow
  - 🔵 Low priority in blue
- Todo titles shown on date cells
- Multiple todos stack on same date

#### Holiday Integration
- Public holidays displayed (if configured)
- Special styling for holidays
- Holiday names shown
- Helps with planning around holidays

#### Visual Design
- Clean, minimal interface
- Responsive grid layout
- Dark mode support
- Color-coded for easy scanning

### Calendar Navigation

#### Month Navigation
- Previous month button (◀)
- Current month/year display
- Next month button (▶)
- Today button (jumps to current month)

#### Date Selection
- Click any date to view details
- Current day highlighted
- Past dates grayed out
- Future dates emphasized

### Integration with Main App

#### Data Synchronization
- Calendar shows same todos as list view
- Changes sync automatically
- Real-time updates
- No separate data storage

#### Filtering
- Calendar respects active filters (if applicable)
- Shows only relevant todos
- Updates when filters change

### Use Cases

#### Planning
- 📅 Visualize weekly workload
- 📅 Spot busy vs. light days
- 📅 Balance task distribution
- 📅 Identify scheduling conflicts

#### Review
- 📊 See completed tasks by date
- 📊 Track productivity patterns
- 📊 Review past week/month
- 📊 Identify trends

#### Scheduling
- 🗓️ Find open slots for new tasks
- 🗓️ Avoid overloading specific days
- 🗓️ Plan around holidays
- 🗓️ Distribute recurring tasks

### Tips

#### Effective Calendar Use
- Check calendar when planning week
- Review at start of each day
- Use for big-picture overview
- Switch to list view for details

#### Visual Scanning
- Red (high priority) spots immediate attention
- Look for clustering (too many on one day)
- Use color patterns to balance priorities
- Note holiday conflicts

---

## 13. Managing Todos

### Completing Todos

#### How to Complete
1. Locate todo in list (Overdue or Pending section)
2. Click **checkbox** on left side
3. Todo moves to **"Completed"** section
4. Checkbox shows checkmark (✓)

#### Recurring Todo Completion
1. Click checkbox on recurring todo
2. Current instance marked complete
3. **New instance automatically created** for next occurrence
4. New instance has:
   - Same title
   - Same priority
   - Same recurrence settings
   - Same tags
   - Next due date (calculated by pattern)

#### Uncompleting Todos
1. Find todo in Completed section
2. Click **checked checkbox**
3. Todo returns to appropriate section:
   - Overdue (if past due date)
   - Pending (if future or no due date)

### Editing Todos

#### Opening Edit Modal
1. Find todo in any section
2. Click **"Edit"** button (blue text, right side)
3. Modal opens with current values pre-filled

#### Edit Modal Fields

**Available Fields**:
- **Title**: Text input (required)
- **Due Date**: Date-time picker (optional)
- **Priority**: Dropdown (High/Medium/Low)
- **Repeat**: Checkbox (enable/disable recurrence)
- **Recurrence Pattern**: Dropdown (if Repeat enabled)
  - Daily
  - Weekly
  - Monthly
  - Yearly
- **Reminder**: Dropdown (if due date set)
  - None
  - 15 minutes before
  - 30 minutes before
  - 1 hour before
  - 2 hours before
  - 1 day before
  - 2 days before
  - 1 week before
- **Tags**: Tag selection pills (multi-select)

#### Saving Changes
1. Modify any fields as needed
2. Click **"Update"** button (blue, bottom of modal)
3. Modal closes
4. Todo updates in list
5. Moves to correct section if needed (based on new due date)

#### Canceling Edit
1. Click **"Cancel"** button (gray, bottom of modal)
2. Click outside modal (modal overlay)
3. Press Escape key (if supported)
4. No changes saved

### Deleting Todos

#### How to Delete
1. Locate todo in any section
2. Click **"Delete"** button (red text, right side)
3. Todo **immediately deleted** (no confirmation)
4. Removed from list instantly

#### What Gets Deleted
- ✅ Todo item
- ✅ All subtasks (CASCADE delete)
- ✅ Tag associations
- ✅ Progress data
- ✅ Reminder settings

#### Cannot Be Undone
- ⚠️ **Permanent deletion**
- ⚠️ No "undo" feature
- ⚠️ No confirmation dialog
- ⚠️ Export before deleting important todos

### Todo Organization

#### Automatic Sections

Todos are organized into three sections:

**1. Overdue Section** (if any exist)
- **Condition**: Past due date AND not completed
- **Color**: Red background
- **Icon**: ⚠️ Warning icon
- **Counter**: "Overdue (X)"
- **Sort Order**: Priority → Due date → Creation date

**2. Pending Section**
- **Condition**: Future due date OR no due date, AND not completed
- **Color**: Gray background
- **Counter**: "Pending (X)"
- **Sort Order**: Priority → Due date → Creation date

**3. Completed Section**
- **Condition**: Completed checkbox checked
- **Color**: Standard background
- **Counter**: "Completed (X)"
- **Sort Order**: Completion date (newest first)

### Automatic Sorting

#### Sort Priority (within each section)
1. **Priority Level**: High → Medium → Low
2. **Due Date**: Earliest → Latest
3. **Creation Date**: Newest → Oldest (for same priority/due date)

#### Examples
```
Sort Result:
1. High priority, due today
2. High priority, due tomorrow
3. Medium priority, due today
4. Medium priority, due next week
5. Low priority, due tomorrow
6. Low priority, no due date
```

### Todo Display Elements

#### Each Todo Shows

**Left Side**:
- ☐ Checkbox (empty) or ☑ Checkbox (checked)

**Center Area**:
- **Title** (main text)
- **Badges** (inline):
  - Priority badge (colored)
  - 🔄 Recurrence badge (if recurring)
  - 🔔 Reminder badge (if set)
  - Tag pills (if tagged)
- **Due Date** (if set, color-coded by urgency)
- **Progress Bar** (if subtasks exist)
  - "X/Y subtasks" text
  - Visual bar (0-100%)

**Right Side**:
- **"▶ Subtasks"** button (or "▼ Subtasks" if expanded)
- **"Edit"** button (blue)
- **"Delete"** button (red)

### Subtask Expansion

#### Collapsed State (Default)
- Button shows: **"▶ Subtasks"**
- Subtasks hidden
- Progress bar visible (if subtasks exist)
- Progress text visible

#### Expanded State
- Button shows: **"▼ Subtasks"**
- Subtask list visible
- Add subtask form visible
- Individual subtask checkboxes and delete buttons

### Keyboard Shortcuts

#### General
- **Enter** in subtask input → Add subtask
- **Escape** in modal → Close modal (if implemented)

#### Quick Actions
- Click checkbox → Toggle completion
- Click tag pill → Select/deselect tag (in forms)
- Click ✕ → Clear search / delete item

---

## 14. Dark Mode

### What It Does
Automatically applies a dark color scheme based on your system preferences for comfortable viewing in low-light environments.

### How It Works

#### Automatic Detection
- Detects system dark mode preference
- Uses CSS media query: `prefers-color-scheme: dark`
- No manual toggle needed
- Changes apply instantly when system setting changes

#### System Integration
- **macOS**: Follows System Preferences → General → Appearance
- **Windows**: Follows Settings → Personalization → Colors
- **Linux**: Follows desktop environment theme settings
- **Mobile**: Follows system theme settings

### Visual Changes

#### Background Colors
**Light Mode**:
- Main background: Blue-to-indigo gradient
- Card backgrounds: White
- Input backgrounds: White

**Dark Mode**:
- Main background: Gray-to-dark-gray gradient
- Card backgrounds: Dark gray (#1F2937, #374151)
- Input backgrounds: Dark gray

#### Text Colors
**Light Mode**:
- Primary text: Dark gray/black
- Secondary text: Medium gray
- Muted text: Light gray

**Dark Mode**:
- Primary text: White
- Secondary text: Light gray
- Muted text: Medium gray

#### Component Adaptations

**Priority Badges**:
- Light mode: Bright backgrounds, dark text
- Dark mode: Muted backgrounds, bright text
- Maintains color distinction (red/yellow/blue)

**Tag Pills**:
- Custom colors preserved in both modes
- White text for visibility
- Slight transparency adjustments

**Buttons**:
- Light mode: Saturated colors
- Dark mode: Slightly muted for eye comfort
- Hover states adjusted

**Borders**:
- Light mode: Light gray borders
- Dark mode: Medium gray borders
- Increased contrast for visibility

**Shadows**:
- Light mode: Subtle gray shadows
- Dark mode: Deeper shadows for depth
- Adjusted opacity

### Where Dark Mode Applies

#### Main Application
- ✅ Todo list page
- ✅ Todo form (all inputs)
- ✅ Priority dropdowns
- ✅ Date-time pickers
- ✅ Search bar
- ✅ Filter controls

#### Modals & Dialogs
- ✅ Edit todo modal
- ✅ Tag management modal
- ✅ Template modal
- ✅ Save filter modal
- ✅ Save template modal

#### Components
- ✅ Buttons (all types)
- ✅ Input fields
- ✅ Dropdown menus
- ✅ Checkboxes
- ✅ Progress bars
- ✅ Badges and pills
- ✅ Section headers

#### Sections
- ✅ Overdue section (red background adjusted)
- ✅ Pending section
- ✅ Completed section
- ✅ Advanced filters panel

### Color Palette

#### Light Mode
```
Backgrounds:
- Gradient: from-blue-50 to-indigo-100
- Cards: white
- Inputs: white
- Filters: gray-50

Text:
- Primary: gray-800
- Secondary: gray-600
- Muted: gray-500

Accents:
- Blue: #3B82F6
- Red: #EF4444
- Yellow: #F59E0B
- Green: #10B981
```

#### Dark Mode
```
Backgrounds:
- Gradient: from-gray-900 to-gray-800
- Cards: gray-800
- Inputs: gray-700
- Filters: gray-700/50

Text:
- Primary: white
- Secondary: gray-400
- Muted: gray-500

Accents:
- Blue: #60A5FA
- Red: #F87171
- Yellow: #FBBF24
- Green: #34D399
```

### Accessibility

#### Contrast Ratios
- Text meets WCAG AA standards
- Badges and tags readable in both modes
- Focus states visible
- Hover states distinct

#### Visual Comfort
- Reduced brightness in dark mode
- Less eye strain in low light
- Smooth transitions between modes
- No harsh white backgrounds

### Testing Dark Mode

#### Enable Dark Mode
**macOS**:
1. System Preferences → General
2. Appearance → Dark
3. Refresh browser if needed

**Windows**:
1. Settings → Personalization → Colors
2. Choose your color → Dark
3. Refresh browser if needed

**Manual Testing**:
1. Open browser DevTools (F12)
2. Toggle device toolbar
3. Click ⋮ → More tools → Rendering
4. Emulate CSS media: `prefers-color-scheme: dark`

### Tips

#### For Best Experience
- Use dark mode in low-light environments
- Use light mode in bright environments
- Let system auto-switch based on time of day
- Adjust screen brightness accordingly

#### Customization (Future)
- Currently automatic only
- Manual toggle could be added
- Per-user preference storage possible
- Override system setting option available

---

## Tips & Best Practices

### Getting Started

#### First-Time Setup
1. ✅ **Enable notifications** first for reminder functionality
2. ✅ **Create tags** for your main categories (Work, Personal, etc.)
3. ✅ **Set up templates** for recurring tasks
4. ✅ **Explore filters** to understand organization options
5. ✅ **Test export** to understand backup process

#### Learn the Basics
- Start with simple todos (title only)
- Add due dates as you get comfortable
- Experiment with priorities
- Try creating one subtask
- Practice editing and deleting

### Productivity Tips

#### Priority Management
- 🎯 Use **High priority sparingly** for truly urgent items
- 🎯 Reserve 3-5 slots for high priority at most
- 🎯 Most todos should be **Medium** (80%)
- 🎯 Use **Low** for "someday/maybe" tasks
- 🎯 Review priorities weekly

#### Time Management
- ⏰ Set **reminders** for time-sensitive todos
- ⏰ Review **Overdue** section daily (preferably morning)
- ⏰ Use **date ranges** in filters for weekly planning
- ⏰ Schedule **recurring todos** for habits
- ⏰ Check **calendar view** for weekly overview

#### Task Breakdown
- 📋 Break complex tasks into **subtasks**
- 📋 Aim for subtasks under 30 minutes each
- 📋 Use **progress bar** to track advancement
- 📋 Complete subtasks incrementally
- 📋 Celebrate when progress bar reaches 100%

#### Organization Strategies
- 🗂️ **Combine tags and priorities** for better organization
- 🗂️ Create tag hierarchy (Work → Project → Client)
- 🗂️ Use **recurring todos** for habits and routines
- 🗂️ Set up **saved filter presets** for daily workflows
- 🗂️ Review **Completed** section weekly for insights

### Workflow Examples

#### Daily Workflow
```
Morning:
1. Check Overdue section
2. Apply "Today High Priority" filter preset
3. Review calendar view
4. Complete 3 high-priority items

Afternoon:
5. Add new todos as they come up
6. Update subtask progress
7. Check upcoming reminders

Evening:
8. Review completed items
9. Plan tomorrow's priorities
10. Export JSON backup (weekly)
```

#### Weekly Workflow
```
Monday:
1. Review last week's completed todos
2. Clear old completed items
3. Apply "This Week" filter preset
4. Set priorities for the week
5. Create recurring todos

Friday:
6. Complete week review
7. Export CSV for analysis
8. Archive completed todos
9. Prepare next week's templates
10. Backup JSON export
```

### Data Management

#### Backup Strategy
- 💾 **Export JSON weekly** (minimum)
- 💾 Store backups in cloud (Dropbox, Drive, OneDrive)
- 💾 Keep last 4 weeks of backups
- 💾 Archive monthly (compress old backups)
- 💾 Test import occasionally to verify backups work

#### Cleanup Routine
- 🧹 **Weekly**: Delete old completed todos (> 7 days)
- 🧹 **Monthly**: Review and delete unused templates
- 🧹 **Monthly**: Consolidate similar tags
- 🧹 **Quarterly**: Archive old data via export
- 🧹 **Yearly**: Start fresh or major cleanup

#### Template Management
- 📝 Create templates for tasks you do 3+ times
- 📝 Include category for better organization
- 📝 Review templates monthly
- 📝 Delete unused templates
- 📝 Update templates as processes change

### Filter Preset Ideas

#### Productivity Presets
```
"Today's Focus"
- Priority: High
- Completion: Incomplete
- Date: Today

"This Week Work"
- Tag: Work
- Completion: Incomplete
- Date: This week

"Quick Wins"
- Priority: Low
- Completion: Incomplete
- (No subtasks or few subtasks)

"Overdue Critical"
- Priority: High
- Tag: Work
- (Manually check Overdue section)
```

#### Review Presets
```
"Completed This Week"
- Completion: Completed
- Date: Past 7 days

"Personal Progress"
- Tag: Personal
- Completion: All
- Date: This month

"Work Deliverables"
- Tag: Work
- Priority: High
- Completion: All
```

### Tag Strategy

#### Recommended Tags
**By Area**:
- 🏢 Work
- 🏠 Personal
- 💰 Finance
- 🏥 Health
- 📚 Learning

**By Context**:
- 💻 Computer
- 📞 Calls
- 🚗 Errands
- 🏡 Home
- 🏢 Office

**By Project**:
- 📊 Project Alpha
- 🎨 Website Redesign
- 📱 App Development

#### Tag Best Practices
- Limit to 10-15 tags (avoid over-tagging)
- Use distinct colors for easy recognition
- Name tags consistently (all singular or all plural)
- Review and consolidate similar tags quarterly
- Delete unused tags

### Subtask Strategies

#### When to Use Subtasks
- ✅ Task requires 3+ steps
- ✅ Complex project with phases
- ✅ Checklist needed (packing, testing)
- ✅ Want to track incremental progress
- ✅ Breaking down large goal

#### When NOT to Use Subtasks
- ❌ Single-step task
- ❌ Already broken down enough
- ❌ Creates unnecessary complexity
- ❌ Better as separate todos with same tag

### Recurring Todo Strategies

#### Good Uses for Recurring
- ✅ Daily habits (exercise, medication)
- ✅ Weekly routines (meetings, reports)
- ✅ Monthly tasks (bills, reviews)
- ✅ Quarterly goals (assessments)
- ✅ Yearly events (renewals, celebrations)

#### Recurring Tips
- Set realistic recurrence (don't over-commit)
- Use reminders with recurring todos
- Review recurring todos monthly
- Delete recurring todos that no longer apply
- Adjust patterns as schedules change

---

## Troubleshooting

### Notifications Not Working

#### Symptoms
- No browser notifications appearing
- Reminder badge shows but no notification
- "Enable Notifications" button stays visible

#### Solutions

**1. Check Browser Permissions**
```
Chrome:
- Settings → Privacy and security → Site settings → Notifications
- Find your site
- Ensure "Allow" is selected

Firefox:
- Settings → Privacy & Security → Permissions → Notifications
- Check site permissions

Safari:
- Preferences → Websites → Notifications
- Enable for your site
```

**2. Verify Requirements**
- ✅ Click "Enable Notifications" button
- ✅ Grant permission when prompted
- ✅ Todo has due date set
- ✅ Reminder timing is set
- ✅ Reminder time hasn't passed yet

**3. Browser-Specific Issues**
- Try different browser
- Update browser to latest version
- Check if notifications work on other sites
- Restart browser

**4. System-Level Issues (macOS)**
- System Preferences → Notifications
- Find browser in list
- Enable "Allow notifications from [Browser]"

### Todos Not Saving

#### Symptoms
- "Add" button doesn't work
- Todo disappears after adding
- Changes not persisting
- Error messages

#### Solutions

**1. Check Required Fields**
- ✅ Title is not empty
- ✅ Title is not just whitespace
- ✅ For recurring: due date is set
- ✅ For reminders: due date is set

**2. Verify Due Date**
- ✅ Due date is in the future (Singapore time)
- ✅ At least 1 minute from now
- ✅ Valid date format (YYYY-MM-DDTHH:mm)

**3. Network Issues**
- Check internet connection
- Check if API is responding
- Look for error in browser console (F12)
- Try refreshing page

**4. Browser Issues**
- Clear browser cache
- Try incognito/private mode
- Disable browser extensions
- Try different browser

### Import Failing

#### Symptoms
- "Failed to import todos" error
- Import button doesn't work
- File not accepted
- Todos not appearing after import

#### Solutions

**1. File Format Issues**
```
✅ Ensure file is JSON format
✅ Verify file extension is .json
✅ File was exported from this app
✅ File not corrupted or modified
```

**2. Validate JSON**
- Open file in text editor
- Check for JSON syntax errors
- Use JSON validator online
- Try exporting fresh file and re-importing

**3. File Size**
- Very large files may time out
- Split into smaller imports if needed
- Check network stability

**4. Test Import**
1. Export current todos as test
2. Immediately try to import
3. If works: original file is corrupted
4. If fails: browser or API issue

### Tags Not Showing

#### Symptoms
- Tags created but not visible
- Tags not appearing on todos
- Tag filter not working
- Tag modal not opening

#### Solutions

**1. Verify Tag Creation**
- Open tag management modal
- Check if tag exists in list
- Ensure tag has name
- Verify color is set

**2. Check Todo Association**
- Edit todo
- Verify tag is selected (checkmark visible)
- Click "Update" to save
- Refresh page

**3. Filter Conflicts**
- Check if tag filter is active
- Clear all filters
- Ensure completion filter not hiding todos
- Check search query

**4. Refresh Data**
- Reload page (F5)
- Clear browser cache
- Log out and log back in

### Search Not Finding Results

#### Symptoms
- Search returns no results
- Expected todos not appearing
- Search seems broken

#### Solutions

**1. Check Search Input**
- ✅ Spelling is correct
- ✅ Try partial search (fewer letters)
- ✅ Search is case-insensitive
- ✅ Try searching subtask content

**2. Verify Other Filters**
- Clear all filters except search
- Check if priority filter is active
- Check if tag filter is active
- Check if completion filter is hiding results

**3. Confirm Todo Exists**
- Clear search
- Manually browse list
- Verify todo actually exists
- Check if in Completed section

**4. Test Search**
```
Test 1: Search for single letter ("a")
Test 2: Search for common word ("meeting")
Test 3: Clear search and verify todos appear
Test 4: Search in subtask content
```

### Calendar Not Loading

#### Symptoms
- Calendar page is blank
- Todos not appearing on calendar
- Navigation not working
- 404 error

#### Solutions

**1. Check URL**
- Ensure URL is `/calendar`
- Click "Calendar" button from main page
- Verify route exists

**2. Verify Data**
- Return to main page
- Check if todos have due dates
- Only todos with due dates appear on calendar
- Verify dates are valid

**3. Browser Issues**
- Refresh page (F5)
- Clear cache
- Try different browser
- Check JavaScript is enabled

### Dark Mode Issues

#### Symptoms
- Dark mode not activating
- Colors look wrong
- Text not readable
- Stuck in one mode

#### Solutions

**1. Check System Settings**
```
macOS:
- System Preferences → General → Appearance → Dark

Windows:
- Settings → Personalization → Colors → Dark

Linux:
- Desktop environment theme settings
```

**2. Browser Detection**
- Use DevTools to test (F12)
- Rendering → Emulate CSS media
- Toggle dark/light
- Verify changes apply

**3. Cache Issues**
- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Try incognito mode

### Performance Issues

#### Symptoms
- App is slow
- Lag when typing
- Slow filter updates
- Delays in todo creation

#### Solutions

**1. Data Size**
- Large number of todos (> 500) may slow down
- Export and archive old todos
- Delete completed todos
- Use filters to reduce visible items

**2. Browser Performance**
- Close unused tabs
- Restart browser
- Update to latest browser version
- Check system resources

**3. Network Issues**
- Check internet speed
- Verify API response times
- Check browser console for errors
- Try different network

### Login/Authentication Issues

#### Symptoms
- Cannot register
- Cannot login
- Passkey not working
- Session expiring

#### Solutions

**1. Browser Support**
- ✅ Use modern browser (Chrome, Firefox, Safari, Edge)
- ✅ Update browser to latest version
- ✅ Enable WebAuthn support

**2. Device Support**
- Ensure device has biometric capability
- Check security key is working
- Verify passkey is saved
- Try different authentication method

**3. Session Issues**
- Clear cookies
- Log out and log back in
- Try incognito mode
- Register new account to test

### General Troubleshooting Steps

#### When Something Doesn't Work

**Step 1: Basic Checks**
1. Refresh page (F5)
2. Check internet connection
3. Verify you're logged in
4. Check browser console for errors (F12)

**Step 2: Clear State**
1. Clear filters
2. Clear search
3. Close all modals
4. Return to main page

**Step 3: Browser Reset**
1. Clear browser cache
2. Clear cookies (may need to re-login)
3. Restart browser
4. Try incognito/private mode

**Step 4: Data Verification**
1. Export current todos as backup
2. Check if data is intact
3. Verify database operations working
4. Test with new todo

**Step 5: Escalation**
1. Try different browser
2. Try different device
3. Check app status/server
4. Report bug with details

#### Collecting Debug Information

When reporting issues, include:
```
1. Browser name and version
2. Operating system
3. Steps to reproduce
4. Expected vs actual behavior
5. Console errors (F12 → Console tab)
6. Network errors (F12 → Network tab)
7. Screenshots if helpful
```

---

## Keyboard Shortcuts Reference

### Text Input
- **Enter** in todo form → Add todo (when focused on Add button)
- **Enter** in subtask input → Add subtask
- **Enter** in tag modal → Create tag (when focused on Create button)

### Modal Actions
- **Escape** → Close modal (if implemented)
- Click outside modal → Close modal

### Quick Actions
- Click **checkbox** → Toggle todo completion
- Click **tag pill** → Select/deselect tag (in forms)
- Click **✕** → Clear search / delete item / close

### Navigation
- **Tab** → Move between form fields
- **Shift + Tab** → Move backwards
- **Space** → Toggle checkbox (when focused)

---

## Feature Summary Checklist

### ✅ Implemented Features

- [x] **Authentication**: WebAuthn/Passkeys, passwordless login
- [x] **Todo Management**: Create, edit, delete, complete todos
- [x] **Priority Levels**: High/Medium/Low with color coding
- [x] **Due Dates**: Date-time picker, Singapore timezone
- [x] **Time Display**: Smart urgency-based formatting
- [x] **Overdue Tracking**: Separate section, red highlights
- [x] **Recurring Todos**: Daily/Weekly/Monthly/Yearly patterns
- [x] **Reminders**: 7 preset timings, browser notifications
- [x] **Subtasks**: Unlimited subtasks with progress tracking
- [x] **Progress Bars**: Visual completion percentage
- [x] **Tags**: Custom color-coded labels, multi-tag support
- [x] **Tag Management**: Create, edit, delete, filter by tags
- [x] **Templates**: Save and reuse todo patterns
- [x] **Template Categories**: Organize templates by category
- [x] **Search**: Full-text search in titles and subtasks
- [x] **Quick Filters**: Priority and tag filtering
- [x] **Advanced Filters**: Completion status, date ranges
- [x] **Saved Filter Presets**: Store filter combinations
- [x] **Export JSON**: Complete data backup
- [x] **Export CSV**: Spreadsheet-friendly format
- [x] **Import JSON**: Restore from backups
- [x] **Calendar View**: Monthly visualization
- [x] **Dark Mode**: Automatic system preference detection
- [x] **Auto-Sorting**: Priority, due date, creation date
- [x] **Section Organization**: Overdue, Pending, Completed
- [x] **Real-time Updates**: Instant UI refresh
- [x] **User-specific Data**: Multi-user support
- [x] **Singapore Timezone**: Consistent time handling

---

## Version Information

**App Version**: 1.0
**Last Updated**: November 2025
**Compatible Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## Support & Feedback

For issues, questions, or feature requests:
1. Check this user guide first
2. Review troubleshooting section
3. Check browser console for errors
4. Contact app administrator
5. Submit feedback through app (if available)

---

**End of User Guide**

This guide covers all currently implemented features in the Todo App. Features are continuously being improved and expanded. Keep this guide handy for reference as you use the app!
