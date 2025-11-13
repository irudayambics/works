# Stage 3 – Frontend Implementation Plan

## Goals
Deliver the feature-rich UI required by `EVALUATION.md`, wiring it to the existing API surface while maintaining Singapore-time semantics, accessibility, and optimistic UX.

## Workstreams
1. **App Shell & Auth Awareness**
   - Add session bootstrap (`/api/auth/me`) on the client, global loading/redirect handling, logout button.
   - Ensure middleware redirects are respected; surface login CTA on unauthenticated state.

2. **Dashboard Overhaul (`app/page.tsx`)**
   - Replace current list with sections (Overdue, Active, Completed) sorted by priority→due date.
   - Implement create/edit modals featuring priority, due date (SG), recurrence, reminders, tags, subtasks, templates, export/import entry points.
   - Add delete confirmation dialog, optimistic updates with rollback, and toast system refinements.

3. **Subtasks & Progress**
   - Collapsible subtask manager per todo with add/edit/delete, checkbox toggles, and live progress bar (green at 100%, blue otherwise).
   - Cascade UI to reflect backend state immediately.

4. **Tags & Filters**
   - “Manage Tags” modal (create/edit/delete with color picker, duplicate validation).
   - Tag badges on todos; clicking applies filter (with indicator and clear option).
   - Priority filter dropdown + search input (debounced 300ms, case-insensitive, matches title + tag names).

5. **Recurring & Reminder UX**
   - “Repeat” toggle with pattern dropdown; disable reminders without due date.
   - Badges for recurring pattern (🔄) and reminder offset (🔔).
   - Display upcoming reminder time using Singapore timezone formatting.

6. **Templates Workflow**
   - “Save as Template” modal (name, description, category); reuse current todo state.
   - “Use Template” launcher with category filter, preview, due offset selection.

7. **Export / Import**
   - Buttons in dashboard header; export triggers file download, import opens JSON file picker with validation and success/error toast.

8. **Notifications Hook Integration**
   - Update `useNotifications` to consume new API payload (`data.todos`, `remindAt`) and expose enable/mute UI on dashboard.
   - Polling interval driven by env (`NOTIFICATIONS_POLL_INTERVAL_SECONDS`).

9. **Calendar Page**
   - Implement `/app/calendar/page.tsx` with month nav, today button, Singapore holidays (highlight name), todo counts per day, modal listing tasks, URL state via `?month=YYYY-MM`.

10. **Accessibility & Responsiveness**
   - Ensure keyboard navigation for modals/forms, focus traps, ARIA labels.
   - WCAG AA color audit for priority badges, reminder icons, tag chips.
   - Responsive layout for mobile/desktop.

## Sequencing
1. Refactor shared UI primitives (modals, buttons, forms, badges) in `/components`.
2. Implement session-aware layout and dashboard data fetching hooks.
3. Layer in tags/templates features, then reminders/notifications, followed by export/import.
4. Build calendar page once dashboard data utilities (aggregations) exist.
5. Run lint/TypeScript checks continuously; adjust backend payloads only if necessary.

## Testing
- Add Playwright flows incrementally (auth login, create/edit/delete, subtasks, tags, recurrence, reminders, templates, export/import, calendar navigation).
- Plan Jest/VTU tests for helper utilities (progress calc, filter logic).

## Dependencies / Risks
- Need to guard API calls with session state to prevent 401 loops.
- Large UI refactor may require Tailwind v4 upgrade; schedule after core components land.
- Ensure timezone utilities used everywhere (`parseSg`, `toUtcIso`).
