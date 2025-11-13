# PRP: Calendar View

## Feature Overview
Visualize todos on a monthly calendar with due date-based organization and Singapore public holiday integration.

## User Stories

### As a visual planner
- I want to see todos on a calendar
- So that I understand my workload distribution over time

### As a deadline-conscious user
- I want to see which days have due todos
- So that I can plan my time effectively

### As a Singapore resident
- I want to see public holidays on the calendar
- So that I avoid scheduling tasks on non-working days

### As a multi-week planner
- I want to navigate between months
- So that I can plan far ahead or review past tasks

## User Flow

### Viewing Calendar
1. User clicks "Calendar" link in navigation
2. System navigates to `/calendar` page
3. Calendar displays current month
4. Days with due todos show badges with count
5. Public holidays highlighted in different color
6. User can see current day highlighted

### Navigating Months
1. User clicks "Previous Month" (◀) button
2. Calendar updates to show previous month
3. URL updates: `/calendar?month=2025-10`
4. User clicks "Next Month" (▶) button
5. Calendar updates to show next month
6. "Today" button returns to current month

### Viewing Day's Todos
1. User clicks on a calendar date
2. Modal or side panel opens
3. Shows all todos due on that date:
   - Title, priority badge, completion checkbox
   - Recurring indicator, tags
   - Edit and delete buttons
4. User can complete/edit todos directly from modal
5. Modal closes when clicking outside or X button

### Holiday Display
1. Singapore public holidays shown with:
   - Holiday name (e.g., "Chinese New Year")
   - Different background color (light green)
   - No todos can be due on holidays (optional enforcement)
2. Holidays from `holidays` table in database

## Technical Requirements

### Database Schema
```sql
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD format
  description TEXT,
  is_recurring BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed with Singapore holidays
INSERT INTO holidays (name, date, description) VALUES
  ('New Year''s Day', '2025-01-01', 'Public Holiday'),
  ('Chinese New Year', '2025-01-29', 'Public Holiday'),
  ('Chinese New Year', '2025-01-30', 'Public Holiday'),
  ('Good Friday', '2025-04-18', 'Public Holiday'),
  ('Labour Day', '2025-05-01', 'Public Holiday'),
  ('Vesak Day', '2025-05-12', 'Public Holiday'),
  ('Hari Raya Puasa', '2025-03-31', 'Public Holiday'),
  ('Hari Raya Haji', '2025-06-07', 'Public Holiday'),
  ('National Day', '2025-08-09', 'Public Holiday'),
  ('Deepavali', '2025-10-20', 'Public Holiday'),
  ('Christmas Day', '2025-12-25', 'Public Holiday');
```

### API Endpoints

#### `GET /api/holidays`
**Get all holidays**
- Returns: Array of Holiday objects
- No filtering needed (holidays don't belong to users)

```typescript
interface Holiday {
  id: number;
  name: string;
  date: string;  // YYYY-MM-DD
  description?: string;
  is_recurring: boolean;
  created_at: string;
}
```

#### Calendar Page (Client-Side)
- No separate API needed
- Reuses `GET /api/todos` (filters todos by due date)
- Reuses `GET /api/holidays`

### Calendar Data Structure

```typescript
interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;  // False for prev/next month padding days
  isToday: boolean;
  isWeekend: boolean;
  todos: Todo[];
  holiday?: Holiday;
}

interface CalendarWeek {
  days: CalendarDay[];
}

interface CalendarMonth {
  year: number;
  month: number;  // 0-11 (JavaScript months)
  monthName: string;  // "November"
  weeks: CalendarWeek[];
}
```

### Calendar Generation Logic

```typescript
import { getSingaporeNow } from '@/lib/timezone';

function generateCalendar(year: number, month: number): CalendarMonth {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Get starting day of week (0 = Sunday)
  const startingDayOfWeek = firstDay.getDay();
  
  // Get previous month's trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDays = Array.from(
    { length: startingDayOfWeek },
    (_, i) => prevMonthLastDay - startingDayOfWeek + i + 1
  );
  
  // Current month days
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  // Next month's leading days (to complete last week)
  const totalDays = prevMonthDays.length + currentMonthDays.length;
  const remainingDays = 7 - (totalDays % 7);
  const nextMonthDays = remainingDays === 7 ? [] : Array.from({ length: remainingDays }, (_, i) => i + 1);
  
  // Build weeks
  const allDays = [
    ...prevMonthDays.map(d => ({ day: d, isCurrentMonth: false, month: month - 1 })),
    ...currentMonthDays.map(d => ({ day: d, isCurrentMonth: true, month })),
    ...nextMonthDays.map(d => ({ day: d, isCurrentMonth: false, month: month + 1 }))
  ];
  
  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push({
      days: allDays.slice(i, i + 7).map(({ day, isCurrentMonth, month: m }) => ({
        date: new Date(year, m, day),
        dayOfMonth: day,
        isCurrentMonth,
        isToday: isToday(new Date(year, m, day)),
        isWeekend: [0, 6].includes(new Date(year, m, day).getDay()),
        todos: [],
        holiday: undefined
      }))
    });
  }
  
  return {
    year,
    month,
    monthName: firstDay.toLocaleString('en-US', { month: 'long' }),
    weeks
  };
}

function isToday(date: Date): boolean {
  const now = getSingaporeNow();
  return date.toDateString() === now.toDateString();
}
```

### Todo Assignment to Days

```typescript
function assignTodosToCalendar(calendar: CalendarMonth, todos: Todo[], holidays: Holiday[]) {
  // Assign todos to days
  todos.forEach(todo => {
    if (!todo.due_date) return;
    
    const dueDate = new Date(todo.due_date);
    calendar.weeks.forEach(week => {
      week.days.forEach(day => {
        if (day.date.toDateString() === dueDate.toDateString()) {
          day.todos.push(todo);
        }
      });
    });
  });
  
  // Assign holidays to days
  holidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date);
    calendar.weeks.forEach(week => {
      week.days.forEach(day => {
        if (day.date.toDateString() === holidayDate.toDateString()) {
          day.holiday = holiday;
        }
      });
    });
  });
}
```

### UI Components

#### Calendar Header
```tsx
<div className="calendar-header">
  <button onClick={prevMonth}>◀ Prev</button>
  <h2>{calendar.monthName} {calendar.year}</h2>
  <button onClick={nextMonth}>Next ▶</button>
  <button onClick={goToToday}>Today</button>
</div>
```

#### Calendar Grid
```tsx
<div className="calendar-grid">
  {/* Day headers */}
  <div className="calendar-day-headers">
    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
      <div key={day} className="calendar-day-header">{day}</div>
    ))}
  </div>
  
  {/* Weeks */}
  {calendar.weeks.map((week, weekIdx) => (
    <div key={weekIdx} className="calendar-week">
      {week.days.map((day, dayIdx) => (
        <div 
          key={dayIdx}
          className={cn(
            "calendar-day",
            !day.isCurrentMonth && "text-gray-400",
            day.isToday && "bg-blue-100 font-bold",
            day.isWeekend && "bg-gray-50",
            day.holiday && "bg-green-50"
          )}
          onClick={() => showDayModal(day)}
        >
          <div className="day-number">{day.dayOfMonth}</div>
          
          {day.holiday && (
            <div className="holiday-name text-xs text-green-600">
              {day.holiday.name}
            </div>
          )}
          
          {day.todos.length > 0 && (
            <div className="todo-badge">
              {day.todos.length} {day.todos.length === 1 ? 'todo' : 'todos'}
            </div>
          )}
          
          {/* Show first few todos */}
          {day.todos.slice(0, 2).map(todo => (
            <div key={todo.id} className="calendar-todo-preview">
              <span className={cn("priority-dot", `priority-${todo.priority}`)} />
              <span className="todo-title-preview">{todo.title}</span>
            </div>
          ))}
          
          {day.todos.length > 2 && (
            <div className="more-todos">+{day.todos.length - 2} more</div>
          )}
        </div>
      ))}
    </div>
  ))}
</div>
```

#### Day Modal
```tsx
<Modal open={!!selectedDay} onClose={() => setSelectedDay(null)}>
  {selectedDay && (
    <>
      <h2>
        {selectedDay.date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </h2>
      
      {selectedDay.holiday && (
        <div className="holiday-banner">
          🎉 {selectedDay.holiday.name}
        </div>
      )}
      
      {selectedDay.todos.length === 0 ? (
        <p>No todos due on this day</p>
      ) : (
        <div className="day-todos-list">
          {selectedDay.todos.map(todo => (
            <TodoCard key={todo.id} todo={todo} />
          ))}
        </div>
      )}
    </>
  )}
</Modal>
```

### URL State Management

```typescript
import { useSearchParams, useRouter } from 'next/navigation';

function CalendarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Parse month from URL: ?month=2025-11
  const monthParam = searchParams.get('month');
  const [year, month] = monthParam 
    ? monthParam.split('-').map(Number)
    : [getSingaporeNow().getFullYear(), getSingaporeNow().getMonth()];
  
  function navigateToMonth(year: number, month: number) {
    router.push(`/calendar?month=${year}-${String(month + 1).padStart(2, '0')}`);
  }
}
```

## Edge Cases

### Months with 5 vs 6 Weeks
- Some months need 6 rows (e.g., month starts on Saturday)
- Calendar flexibly adds rows as needed
- Empty trailing days from next month fill last row

### Leap Years
- JavaScript Date handles automatically
- February 29 appears in leap years

### Multiple Todos on Same Day
- Show count badge: "5 todos"
- Preview first 2-3 todos
- Modal shows all todos for that day

### Holidays on Weekends
- Weekend styling + holiday styling
- Both visually indicated

### Past Due Dates
- Todos with past due dates still shown on calendar
- Different styling (red border or badge)
- Helps identify overdue tasks

## Acceptance Criteria

- [ ] Calendar displays current month on load
- [ ] Days of week headers shown (Sun-Sat)
- [ ] Current day highlighted distinctly
- [ ] Weekends have different background color
- [ ] Todos with due dates appear on correct days
- [ ] Day shows count of todos (if > 0)
- [ ] Public holidays displayed with name
- [ ] Holiday days have special background color
- [ ] Previous month button navigates backward
- [ ] Next month button navigates forward
- [ ] Today button returns to current month
- [ ] URL updates with month parameter
- [ ] Clicking day opens modal with todos
- [ ] Modal shows all todos for that day
- [ ] Can complete/edit todos from modal
- [ ] Modal closes on outside click or X button

## Testing Requirements

### E2E Tests
```
tests/09-calendar.spec.ts
```

Test cases:
- [ ] Calendar loads current month
- [ ] Navigate to previous month
- [ ] Navigate to next month
- [ ] Today button returns to current month
- [ ] Todo with due date appears on correct day
- [ ] Holiday appears on correct day
- [ ] Click day opens modal
- [ ] Modal shows todos for that day
- [ ] Complete todo from calendar modal

### Unit Tests
```typescript
describe('Calendar generation', () => {
  it('generates correct number of weeks', () => { /* ... */ });
  it('handles month starting on Sunday', () => { /* ... */ });
  it('handles month starting on Saturday', () => { /* ... */ });
  it('identifies today correctly', () => { /* ... */ });
  it('assigns todos to correct days', () => { /* ... */ });
});
```

## Performance Considerations

### Rendering
- Calendar re-renders on month change only
- Todo assignment O(n) where n = number of todos
- Typically < 100ms render time

### Data Loading
- Load todos once on page mount
- Filter by due_date for display
- No re-fetching on month navigation

## Out of Scope
- Week view
- Day view (agenda)
- Drag-and-drop todo rescheduling
- Multi-month view
- Print calendar
- Export calendar (ICS format)
- Google Calendar sync
- Recurring events display (showing all future instances)
- Time slots (hourly view)

## Success Metrics
- 50% of users visit calendar at least once
- Average 3+ month navigations per session
- 30% of users create todos from calendar view (future feature)
- Calendar page load time < 1 second
