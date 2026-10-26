# Proposal

## Why

Tasks in `tasks.json` already have a `dueDate` that the calendar shows, but users cannot set it themselves: only AI task generation writes it, and the task list offers no date controls. There is also no way to record *when* the user intends to work on a task, as opposed to when it is due. Without both dates, the calendar cannot act as a planning view for tasks.

## What Changes

- **Scheduled date for tasks**: Tasks gain an optional `scheduledDate` (`YYYY-MM-DD`), meaning "when I plan to work on this", next to the existing optional `dueDate`, meaning "deadline". Existing `tasks.json` files stay valid without migration.
- **Editing dates in the task list**: Each task row in the task list (folder and global mode) shows a chip for each date that is set and a "+ Datum" action for missing ones. Clicking a chip lets the user pick a new date or remove it. Changes are persisted to the folder's `tasks.json`.
- **Overdue indication in the task list**: Open tasks whose due or scheduled date lies in the past are visibly marked as overdue. A scheduled date later than the due date is marked subtly but is allowed.
- **Calendar shows both dates**: A task appears in the Calendar Month View and Day Details on its due date *and* on its scheduled date, with distinct markers ("fällig" vs. "geplant"). Past dates stay on their original day; nothing rolls over to today. Completed tasks remain visible, struck through, as today.
- **Day Details lists both kinds**: The Day Details panel lists tasks due on the selected day and tasks scheduled for it as separate groups, both with the existing completion toggle.
- **Robust date preservation**: Saving or partially recovering a task never drops `dueDate` or `scheduledDate`. This fixes the current fallback parsing path, which loses `dueDate` on malformed entries.

Non-goals: dates on Markdown checkbox tasks inside notes, times of day, automatic roll-over of overdue tasks, AI generation of scheduled dates, date display in the folder overview.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `folder-tasks`: Task storage includes the optional `dueDate` and `scheduledDate` fields. New requirement for setting, changing, and removing both dates in the task list, including the overdue indication.
- `calendar-view`: Task entries appear on both due and scheduled dates with distinct markers. Day Details lists due and scheduled tasks separately.

## Impact

- `src/models/tasks.ts`: Add `scheduledDate` to `TaskItemSchema` and preserve both dates in the fallback parser.
- `src/services/folderTasksService.ts`: Accept dates when adding and updating tasks.
- `src/webviews/tasks/TaskListApp.tsx`: Date chips, date picking and removal, overdue styling.
- `src/services/calendarService.ts`: Emit separate due and scheduled entries per task (`CalendarEntry` gets a date-kind marker).
- `src/webviews/calendar/CalendarMonthApp.tsx`, `CalendarDayDetailsApp.tsx`: Distinct chip markers and grouped day lists.
- Tests: `folderTasksService`, `calendarService`, `calendarDayDetailsViewProvider`, `globalTasksViewProvider`, and the task model.
