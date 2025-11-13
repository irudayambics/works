# PRP: Reminder & Notification System

## Feature Overview
Browser-based notification system that alerts users before todo due dates, with configurable timing offsets and duplicate prevention.

## User Stories

### As a busy user
- I want to receive notifications before todos are due
- So that I don't miss important deadlines

### As a user who plans ahead
- I want to set reminders for 1 day or 1 week before
- So that I have time to prepare for large tasks

### As a user with urgent tasks
- I want reminders 15 or 30 minutes before
- So that I can complete time-sensitive tasks

## Reminder Timing Options

| Option | Minutes Before | Use Case |
|--------|---------------|----------|
| 15 minutes | 15 | Urgent meetings, time-sensitive tasks |
| 30 minutes | 30 | Quick tasks, last-minute prep |
| 1 hour | 60 | Moderate prep time |
| 2 hours | 120 | Tasks requiring setup |
| 1 day | 1440 | Important deadlines, planning |
| 2 days | 2880 | Large projects, preparation |
| 1 week | 10080 | Long-term planning, big events |

## User Flow

### Enabling Notifications
1. User clicks "Enable Notifications" button (top of page)
2. Browser shows native permission dialog
3. User clicks "Allow"
4. Button changes to "Notifications Enabled" (disabled state)
5. System begins checking for upcoming reminders

### Setting Reminder on New Todo
1. User enters todo title and sets due date
2. Reminder dropdown becomes enabled
3. User selects reminder timing (e.g., "1 day before")
4. User clicks "Add"
5. Todo displays 🔔 badge with timing (e.g., "🔔 1d before")

### Setting Reminder on Existing Todo
1. User clicks "Edit" on todo
2. User sets/changes due date (if not already set)
3. Reminder dropdown becomes enabled
4. User selects reminder timing
5. User clicks "Save Changes"
6. Todo displays updated 🔔 badge

### Receiving Notification
1. System polls `/api/notifications/check` every 30 seconds
2. When reminder time reached (in Singapore timezone):
   - Browser displays notification
   - Title: "Todo Reminder"
   - Body: Todo title
   - Icon: App icon
3. System marks notification as sent (prevents duplicates)
4. User clicks notification → redirects to app

### Disabling Reminder
1. User edits todo
2. User selects "No reminder" from dropdown
3. Reminder badge removed from todo

## Technical Requirements

### Database Fields
```sql
ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER;  -- NULL or positive number
ALTER TABLE todos ADD COLUMN last_notification_sent TEXT;  -- ISO datetime
```

### Browser Notification API
```typescript
// Request permission
const permission = await Notification.requestPermission();

// Show notification
if (permission === 'granted') {
  new Notification('Todo Reminder', {
    body: todo.title,
    icon: '/icon.png',
    tag: `todo-${todo.id}`,  // Prevent duplicates
  });
}
```

### Custom Hook: `useNotifications`
Located in `lib/hooks/useNotifications.ts`:

```typescript
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    setIsEnabled(result === 'granted');
  };

  useEffect(() => {
    setPermission(Notification.permission);
    setIsEnabled(Notification.permission === 'granted');
  }, []);

  return { permission, isEnabled, requestPermission };
}
```

### Polling System (Client-Side)
```typescript
useEffect(() => {
  if (!isEnabled) return;

  const checkNotifications = async () => {
    const response = await fetch('/api/notifications/check');
    const { notifications } = await response.json();

    notifications.forEach((todo: Todo) => {
      new Notification('Todo Reminder', {
        body: todo.title,
        tag: `todo-${todo.id}`,
      });
    });
  };

  // Poll every 30 seconds
  const interval = setInterval(checkNotifications, 30000);
  return () => clearInterval(interval);
}, [isEnabled]);
```

### API Endpoint: `GET /api/notifications/check`

**Logic:**
1. Get current Singapore time
2. Find todos where:
   - `reminder_minutes` is not null
   - `due_date` is not null
   - `completed` = false
   - `due_date - reminder_minutes <= now`
   - `last_notification_sent` is null OR older than 1 hour (grace period)
3. Update `last_notification_sent` to current time
4. Return todos needing notification

**Response:**
```json
{
  "notifications": [
    {
      "id": 123,
      "title": "Meeting with client",
      "due_date": "2025-11-12T14:00",
      "reminder_minutes": 60
    }
  ]
}
```

### Singapore Timezone Handling
```typescript
import { getSingaporeNow } from '@/lib/timezone';

const now = getSingaporeNow();
const dueDate = new Date(todo.due_date);
const reminderTime = new Date(dueDate.getTime() - (todo.reminder_minutes * 60000));

if (reminderTime <= now && !todo.last_notification_sent) {
  // Send notification
}
```

### UI Components

#### Enable Button
```tsx
<button 
  onClick={requestPermission}
  disabled={isEnabled}
  className={cn(
    "px-4 py-2 rounded",
    isEnabled ? "bg-green-500 text-white" : "bg-blue-500 text-white hover:bg-blue-600"
  )}
>
  {isEnabled ? '✓ Notifications Enabled' : 'Enable Notifications'}
</button>
```

#### Reminder Dropdown (Form)
```tsx
<select 
  value={reminderMinutes ?? ''} 
  onChange={(e) => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
  disabled={!dueDate}  // Only enabled when due date set
>
  <option value="">No reminder</option>
  <option value="15">15 minutes before</option>
  <option value="30">30 minutes before</option>
  <option value="60">1 hour before</option>
  <option value="120">2 hours before</option>
  <option value="1440">1 day before</option>
  <option value="2880">2 days before</option>
  <option value="10080">1 week before</option>
</select>
```

#### Reminder Badge
```tsx
{todo.reminder_minutes && (
  <span className="text-xs text-purple-600 dark:text-purple-400">
    🔔 {formatReminderOffset(todo.reminder_minutes)}
  </span>
)}

// Helper function
function formatReminderOffset(minutes: number): string {
  if (minutes < 60) return `${minutes}m before`;
  if (minutes < 1440) return `${minutes / 60}h before`;
  return `${minutes / 1440}d before`;
}
```

## Duplicate Prevention

### Database Tracking
- `last_notification_sent` field stores ISO datetime of last notification
- Notification only sent if:
  - Field is NULL (never sent), OR
  - Value older than 1 hour (grace period for re-notification)

### Browser Tag
```typescript
new Notification('Todo Reminder', {
  tag: `todo-${todo.id}`,  // Same tag replaces previous notification
});
```

### API Update
```typescript
// After showing notification
todoDB.updateNotificationSent(todo.id, getSingaporeNow().toISOString());
```

## Edge Cases

### Browser Closed
- Notifications don't fire when browser closed
- On next open, polling resumes
- Overdue reminders won't re-fire (already marked as sent)

### Permission Denied
- Button remains in "Enable" state
- Clicking shows browser's permission settings info
- User must manually enable in browser settings

### Todo Completed Before Reminder
- Notification check excludes completed todos
- No notification fires

### Reminder Past Due Date
- If reminder_minutes > time until due date, notification immediate
- Example: 1 week reminder on todo due in 2 days → notifies immediately

### Recurring Todos
- Next instance inherits `reminder_minutes` value
- `last_notification_sent` reset to NULL for new instance

## Acceptance Criteria

- [ ] "Enable Notifications" button requests browser permission
- [ ] Button disabled after permission granted
- [ ] Reminder dropdown only enabled when due date set
- [ ] Can select reminder timing from 7 predefined options
- [ ] Can clear reminder by selecting "No reminder"
- [ ] Todo displays 🔔 badge with human-readable timing
- [ ] Browser notification appears at correct time (Singapore timezone)
- [ ] Notification title: "Todo Reminder"
- [ ] Notification body: Todo title
- [ ] Only one notification sent per reminder
- [ ] Clicking notification opens app
- [ ] Completed todos don't trigger notifications
- [ ] Notification respects browser permission status

## Testing Requirements

### Manual Testing (Browser Notifications)
- Browser notifications can't be fully automated in Playwright
- Test plan:
  1. Enable notifications in browser
  2. Create todo due in 2 minutes with "1 minute before" reminder
  3. Wait 1 minute
  4. Verify notification appears

### E2E Tests (Playwright)
```
tests/06-reminders.spec.ts (if API testing)
```

Test cases:
- [ ] Enable button exists and clickable
- [ ] Reminder dropdown disabled without due date
- [ ] Reminder dropdown enabled with due date
- [ ] Can select reminder timing
- [ ] Reminder badge displays correctly
- [ ] API `/api/notifications/check` returns correct todos

### Timezone Tests
```typescript
describe('Notification timing', () => {
  it('calculates reminder time in Singapore timezone', () => {
    const dueDate = '2025-11-12T14:00';  // 2 PM Singapore
    const reminderMinutes = 60;
    const expectedTime = '2025-11-12T13:00';  // 1 PM Singapore
    
    expect(calculateReminderTime(dueDate, reminderMinutes)).toBe(expectedTime);
  });
});
```

## Browser Compatibility

### Notification API Support
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Requires HTTPS (not on localhost)
- ❌ Mobile browsers: Limited support (background restrictions)

### Fallback Strategy
- If `Notification` API not available, hide "Enable Notifications" button
- Display message: "Browser notifications not supported"

## Performance Considerations

### Polling Frequency
- Default: 30 seconds
- Trade-off: Accuracy vs. battery/resource usage
- 30 seconds provides ~±15 second accuracy

### API Query Optimization
```sql
-- Efficient index
CREATE INDEX idx_reminder_check ON todos(reminder_minutes, due_date, completed, last_notification_sent);

-- Query uses index
SELECT * FROM todos 
WHERE reminder_minutes IS NOT NULL 
  AND due_date IS NOT NULL 
  AND completed = 0
  AND (last_notification_sent IS NULL OR last_notification_sent < datetime('now', '-1 hour'));
```

## Out of Scope
- Email notifications
- SMS notifications
- Push notifications (service worker)
- Custom notification sounds
- Notification history/log
- Snooze reminder functionality
- Multiple reminders per todo

## Success Metrics
- 60% of users enable notifications
- 40% of todos with due dates have reminders set
- 90% notification delivery success rate (when browser open)
- < 2 minute average delivery lag
