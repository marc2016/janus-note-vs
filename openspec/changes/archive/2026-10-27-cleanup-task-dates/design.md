# Design

## Context

See proposal.md for motivation. Relevant current state:

- `TaskItemSchema` (`src/models/tasks.ts`) already has optional `dueDate` and `scheduledDate`. `MutateTasksTool` validates against it, so dates already pass at runtime. Only the static `inputSchema` in `package.json` leaves them out (it lists `id`, `title`, `completed`, `status`).
- `folderOverviewViewProvider.ts` builds `recentTasks` with `dueDate: (t as any).dueDate` in two places (folder and multi mode). `FolderOverviewApp.tsx` never renders it. Its priority badge checks for `'normal'`, so `medium` falls through to the `low` style.
- Date chip logic lives in `src/webviews/tasks/TaskDateControls.tsx`, combined with the "+ Datum" menu and date picker. Formatting and overdue rules live in `taskDates.ts`. The folder overview is a separate esbuild entry, but bundling resolves imports from `../tasks/` and `../components/ui/` fine.
- `aiTaskGeneratorService.ts` has `ExtractedTaskSchema` with `dueDate` only, a `normalizeDueDate` helper, and a system prompt without a reference date.
- `TaskBoardApp.tsx` is not imported anywhere. The `openTaskBoard` message already runs `janus.openFolderTasks`.

## Goals / Non-Goals

**Goals:**
- The overview and the task list share one chip implementation, so formatting and overdue styling cannot drift apart.
- No `tasks.json` format change and no new dependency.

**Non-Goals:**
- Restyling the folder overview beyond the task preview rows.
- Making the AI extraction more accurate than "dates the note states explicitly or relatively".

## Decisions

### 1. Extract a read-only `TaskDateChips` component
Move the chip rendering (field order, icons, labels, `chipClass`, `chipTitle`, `formatTaskDate`) out of `TaskDateControls` into `src/webviews/tasks/TaskDateChips.tsx`. It takes `task` and an optional `onChipClick(field)`. Without the callback, chips render as plain badges with no `role="button"`, no tab stop, and no "klicken zum Ändern" in the title. `TaskDateControls` renders `TaskDateChips` with `onChipClick={startEditing}` and keeps the menu and picker.

*Alternative*: a `readOnly` prop on `TaskDateControls`. Rejected because the component would carry all its popover state and outside-click listeners just to switch them off.

*Alternative*: duplicate a small chip in `FolderOverviewApp`. Rejected because it is the drift this change wants to remove.

### 2. Type `recentTasks` from `TaskItem`
Replace the hand-written `recentTasks` element type with `Pick<TaskItem, 'id' | 'title' | 'priority' | 'dueDate' | 'scheduledDate'> & { completed: boolean }` and drop the `as any` casts. Both construction sites go through one small mapper function so folder and multi mode stay identical.

### 3. Priority badge keyed by the schema values
Map `high` / `medium` / `low` to styles in a lookup object instead of the `'normal'` ternary. The text shown stays the raw value, as today.

### 4. Rename `openTaskBoard` → `openFolderTasks`
Rename the message type in the webview and the provider switch, plus the test in `folderOverviewViewProvider.test.ts`. Labels change: header button "Aufgaben-Board" → "Aufgaben", card link "Zum Aufgaben-Board" → "Zu den Aufgaben", tooltip "…und öffnet das Board" → "…und öffnet die Aufgaben". Webview and provider ship in the same bundle, so no compatibility shim for the old name is needed.

### 5. AI extraction: both dates and today's date
- `ExtractedTaskSchema` gains `scheduledDate: z.string().nullish()`. `dueDate` becomes `.nullish()` too, since the prompt already allows `null` and the current schema would reject it, which discards the whole response.
- Rename `normalizeDueDate` → `normalizeTaskDate` (no external callers) and apply it to both fields. A value that cannot be normalized becomes `undefined`. The task is kept.
- The system prompt describes both fields in one sentence each: `dueDate` = deadline ("bis", "Frist", "Abgabe"), `scheduledDate` = the day work is planned ("am", "kümmere mich am"). Leave the field out when the note does not say.
- The user prompt starts with `Heutiges Datum: YYYY-MM-DD` (local date, `todayIso()` logic). `taskDates.ts` lives in the webview tree, so the extension-side service uses its own tiny local-date formatter rather than importing from `src/webviews/`.

### 6. `package.json` tool schema
Add `priority` (enum), `dueDate` and `scheduledDate` (string, description "YYYY-MM-DD"), and `note` to the `tasks.items.properties` of `janus_mutate_tasks`, and update the `tasks` description to match. Runtime behavior is unchanged.

## Risks / Trade-offs

- [The model mixes up due and scheduled dates] → Only dates the note states are extracted, and users can fix them with the date chips. The prompt keeps the two definitions short and contrasting.
- [Relative dates resolved against the wrong day across midnight or time zones] → Use the local date of the extension host, which matches how the task list computes "today".
- [Overview grid rows get crowded with two chips plus priority] → Chips are compact (`DD.MM.`). The title keeps `truncate` and chips stay `shrink-0`, so the title shrinks first.
