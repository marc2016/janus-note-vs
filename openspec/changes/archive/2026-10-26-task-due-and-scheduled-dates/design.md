# Design

## Context

- `TaskItemSchema` in `src/models/tasks.ts` is a zod object. Zod strips unknown keys, and `FolderTasksService.updateTaskInFolder` re-parses every task with it. So a field that is not in the schema is silently lost on the next write. `dueDate` is in the schema, but the fallback branch of `TasksCompanionSchema` (for partially malformed entries) does not copy it.
- `addTaskToFolder` builds the new task from an explicit field list (no dates).
- Only `TaskListApp` is mounted for tasks (`src/webviews/tasks/index.tsx`). `TaskBoardApp.tsx` is unused. `TaskListApp` runs in two modes:
  - `folder` (custom editor for one `tasks.json`, posts the whole `updateTasks` array),
  - `global` (posts `updateTask` with the full task to `GlobalTasksViewProvider`).
  Both paths already send the complete task object, so new fields travel along as long as the model keeps them.
- `CalendarService.loadAllCalendarEntries` emits one `CalendarEntry` with `kind: 'task'` and `id: task-<id>` per task with a `dueDate`. `CalendarMonthApp` and `CalendarDayDetailsApp` filter on `kind === 'task'`. The Day Details toggle posts `taskId` + `folderUri`, so it works for any entry that carries these.
- The markdown editor has a `DatePickerPopover` (with time selection, positioned for CodeMirror coordinates) and `src/webviews/markdown/lib/datePickerUtils.ts` (German month/weekday names, grid helpers).

## Goals / Non-Goals

**Goals:**
- One model change (`scheduledDate`) that every read/write path preserves.
- Date editing in the task row without adding fields to the create form.
- Calendar entries distinguish due vs. scheduled, without changing how note events or task toggling work.

**Non-Goals:**
- Folder overview, AI generation, and agent tools stay as they are (they keep reading/writing `dueDate` only).
- No time-of-day, recurrence, or reminder notifications.
- No removal of the unused `TaskBoardApp.tsx`.

## Decisions

**1. Field name `scheduledDate` next to `dueDate`.**
It mirrors the existing naming and common task-app terminology ("scheduled" = planned work day). Both are optional ISO date strings (`YYYY-MM-DD`). Alternatives: `plannedDate` or `doDate`. Rejected for consistency with `dueDate` and with the Obsidian Tasks vocabulary users may know.

**2. Model: add the field and fix the fallback.**
Add `scheduledDate: z.string().optional()` to `TaskItemSchema`. In the fallback branch of `TasksCompanionSchema`, copy `dueDate` and `scheduledDate` when they are strings. `addTaskToFolder` passes `dueDate` / `scheduledDate` through when provided. To remove a date, the client sends the task without the field (`undefined`). `JSON.stringify` then omits it, which yields the "field removed" behavior from the spec without needing a `null` sentinel.

**3. Task row UI: date chips plus a lightweight date picker.**
In `TaskRow`, between the note badge and the priority badge:
- For each set date, a `Badge` chip with an icon, a label and `DD.MM.` (`DD.MM.YY` if not the current year). The due chip uses `mdiCalendarAlert` with "fällig"; the scheduled chip uses `mdiCalendarClock` with "geplant". The label is in the tooltip and `aria-label`, so the chip itself stays compact.
- If at least one date is missing, a ghost "+ Datum" button (visible on hover/focus, like the delete button) opens a small menu: "Fällig am…" / "Geplant am…".
- Clicking a chip, or choosing a menu entry, opens a native `<input type="date">` via `showPicker()`. A "Datum entfernen" action sits next to it in the same small popover.

Native date input over reusing `DatePickerPopover`: the existing popover is coupled to the editor (time field, CodeMirror coordinates, slash-command flow). The webview runs in VS Code's Chromium, where `<input type="date">` and `showPicker()` are reliable and keyboard-accessible. Extracting a shared popover is a reasonable later refactor but not needed for the spec.

**4. Overdue and ordering hints are computed in the webview.**
A pure helper `getTaskDateState(task, todayIso)` in `src/webviews/tasks/taskDates.ts` returns `{ dueOverdue, scheduledOverdue, scheduledAfterDue }` and the formatted labels. Overdue means `!completed && date < today` (string comparison on ISO dates). Overdue chips use the error color tokens (`--vscode-errorForeground`). "Scheduled after due" adds a warning tint and a tooltip ("liegt nach der Frist"). Keeping this in a pure module makes it unit-testable without a DOM.

**5. Calendar entries: one per date, with `dateKind`.**
`CalendarEntry` gets `dateKind?: 'due' | 'scheduled'` (set only for `kind: 'task'`). `loadAllCalendarEntries` emits up to two entries per task:
- `id: task-due-<id>` on `dueDate`,
- `id: task-scheduled-<id>` on `scheduledDate`.
Each is emitted only when its date matches `^\d{4}-\d{2}-\d{2}$`. Ids must differ because React keys and day lists would otherwise collide when both dates fall on the same day. `kind` stays `'task'`, so the existing filters, the toggle handler and the sort order keep working. Past entries are not moved; the service never compares against today.

**6. Calendar rendering.**
- Month View: task chips keep their current colors for completion state. A leading marker distinguishes the kind: the scheduled chip shows `mdiCalendarClock` and a dashed border, the due chip shows `mdiCalendarAlert` and a solid border. The tooltip prefixes "Fällig:" / "Geplant:".
- Day Details: split `taskEvents` into `dueTasks` and `scheduledTasks`, and render two groups with headings "Fällig" and "Geplant", each hidden when empty, reusing the existing task row markup. The empty-state text changes to mention planned tasks too.

**7. Folder task editor saves after each change.**
`TasksEditorProvider` applies webview edits with `applyEdit`, which left `tasks.json` dirty until a manual save. The calendar (and the sidebar and global list) read from disk via `workspace.fs` and refresh on file-system events, so dates set in folder mode did not appear. The provider now calls `document.save()` after each `updateTasks` edit, matching the global list, which already writes to disk. Undo (Cmd+Z) still works on the document. Alternative: let the calendar prefer open, dirty `TextDocument`s. Rejected because it would fix only the calendar and duplicate the read path.

## Risks / Trade-offs

- [Other writers of `tasks.json` (folder overview, AI generation, agent tools) re-serialize tasks] → They all go through `TaskItemSchema`, so adding the field there preserves it everywhere. A test asserts that `updateTaskInFolder` keeps `scheduledDate`.
- [`showPicker()` throws when the input is not user-activated or visible] → Call it only from the click handler, and fall back to focusing the input if it throws.
- [Same task appearing twice per day if due == scheduled] → Both entries are shown, distinctly marked. This is accepted, since the spec treats them as separate meanings.
- [Duplicate task ids across folders produce equal calendar ids] → Pre-existing issue. Entry ids get the folder URI appended (`task-due-<folderUri>-<id>`) to avoid introducing new collisions.
