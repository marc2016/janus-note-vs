# Proposal

## Why

The `task-due-and-scheduled-dates` change added `scheduledDate` to the task list and the calendar, but deliberately left the folder overview, AI task generation, and the agent tools on `dueDate` only. Tasks now carry two dates, yet some surfaces show or produce only one of them, or none. The old Kanban "Task Board" also left dead code and stale names behind. Before the next release, both should be brought in line.

## What Changes

- **Folder overview shows task dates**: The open-task preview in the folder overview shows the due and scheduled date chips of each task, with the same formatting and overdue hints as the task list. The priority badge recognizes `medium` (it currently checks for `normal`, a value the schema never produces).
- **AI task generation extracts both dates**: The extraction prompt asks for `dueDate` (deadline) and `scheduledDate` (when the user plans to work on it) separately and gives the model today's date so relative dates such as "next Monday" can be resolved. Both are normalized to `YYYY-MM-DD` before they are saved.
- **Agent tool schema advertises task fields**: The `janus_mutate_tasks` input schema in `package.json` documents `priority`, `dueDate`, `scheduledDate`, and `note`, so language models can set them. The runtime validation already accepts them.
- **Remove Task Board leftovers**: Delete the unused `src/webviews/tasks/TaskBoardApp.tsx`. Rename the folder overview's `openTaskBoard` webview message to `openFolderTasks` and its button labels from "Aufgaben-Board" to "Aufgaben". The folder-overview spec is corrected to say the button opens the folder task list (`janus.openFolderTasks`), which is what the code already does.

Non-goals: version bump or release, reminders or recurrence, editing dates from the folder overview, changing the `tasks.json` format.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `folder-overview`: The Folder Tasks Summary shows due and scheduled dates in the open-task preview and opens the folder task list instead of a "Task Board".
- `ai-task-generation`: Task extraction produces an optional `scheduledDate` in addition to `dueDate` and resolves relative dates against today.
- `agent-tools`: The `janus_mutate_tasks` tool advertises the optional `priority`, `dueDate`, `scheduledDate`, and `note` fields.

## Impact

- `src/editors/folderOverviewViewProvider.ts`: Pass `scheduledDate` in `recentTasks`, drop the `as any` casts, handle `openFolderTasks`.
- `src/webviews/folderOverview/FolderOverviewApp.tsx`: Date chips, `medium` priority, renamed message and labels.
- `src/webviews/tasks/taskDates.ts`, `TaskDateControls.tsx`: Reused by the overview for formatting and overdue hints (read-only display).
- `src/services/aiTaskGeneratorService.ts`: Extended extraction schema, prompt with today's date and both date fields.
- `package.json`: `janus_mutate_tasks` input schema.
- `src/webviews/tasks/TaskBoardApp.tsx`: Deleted.
- Tests: `aiTaskGeneration`, `folderOverviewViewProvider`.
