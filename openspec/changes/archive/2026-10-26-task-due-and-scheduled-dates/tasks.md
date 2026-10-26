# Tasks

## 1. Task Model & Storage

- [x] 1.1 Add `scheduledDate` to `TaskItemSchema` and copy `dueDate` / `scheduledDate` in the fallback branch of `TasksCompanionSchema` (`src/models/tasks.ts`). Verify with tests that both dates survive parsing, that malformed entries keep their dates, and that tasks without dates still load.
- [x] 1.2 Pass `dueDate` / `scheduledDate` through `addTaskToFolder` and verify in `tests/folderTasksService.test.ts` that `updateTaskInFolder` keeps both dates when toggling completion and removes a date when the task is saved without it.

## 2. Task List Date Editing

- [x] 2.1 Create `src/webviews/tasks/taskDates.ts` with `formatTaskDate` (`DD.MM.` / `DD.MM.YY`) and `getTaskDateState` (due/scheduled overdue, scheduled-after-due). Verify with unit tests in `tests/taskDates.test.ts`, including completed tasks and year boundaries.
- [x] 2.2 Add due and scheduled chips, the "+ Datum" menu, a native date picker and "Datum entfernen" to `TaskRow` in `src/webviews/tasks/TaskListApp.tsx`, wired to `onUpdate`, with overdue and scheduled-after-due styling. Verify via `npm run compile` and by checking that both folder mode (`updateTasks`) and global mode (`updateTask`) send the changed task, extending `tests/globalTasksViewProvider.test.ts` for an `updateTask` message carrying both dates.

- [x] 2.3 Save `tasks.json` right after each edit in the folder task editor (`src/editors/tasksEditorProvider.ts`) so disk-based views such as the calendar see date changes without a manual save. Verify with `tests/tasksEditorProvider.test.ts`.

## 3. Calendar

- [x] 3.1 Add `dateKind` to `CalendarEntry` and emit separate due and scheduled entries with distinct ids in `CalendarService.loadAllCalendarEntries`. Verify in `tests/calendarService.test.ts`: due-only, scheduled-only, both dates, invalid date ignored, and no roll-over of past dates.
- [x] 3.2 Render distinct due/scheduled markers and tooltips on task chips in `CalendarMonthApp.tsx`. Verify via `npm run compile` and a manual check in the Extension Development Host.
- [x] 3.3 Split the Day Details task list into "Fällig" and "Geplant" groups in `CalendarDayDetailsApp.tsx`, and update the empty-state text. Verify with a test in `tests/calendarDayDetailsViewProvider.test.ts` that toggling a scheduled entry updates the task in `tasks.json`, and with a manual check of the grouping.

## 4. Verification

- [x] 4.1 Run `npm run compile && npm run build && npm test` and confirm zero type errors and all tests pass.
- [x] 4.2 Manually check in the Extension Development Host: set, change and remove both dates in folder and global task lists; confirm overdue marking; confirm that the task appears on both days in the calendar with distinct markers and in the correct Day Details groups.
