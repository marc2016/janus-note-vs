# Proposal

## Why

Dates, appointments, and deadlines written across Markdown notes (`*.md`) and folder task lists (`tasks.json`) are currently scattered throughout the workspace with no chronological overview. Introducing an interactive Calendar Month View with automatic live extraction from notes and tasks—paired with a split-editor Day Details panel (`ViewColumn.Beside`) and direct links back to the source notes—gives users an always-up-to-date monthly schedule without manual calendar maintenance.

## What Changes

- **Calendar Service & Live Event Extraction (`CalendarService`)**:
  - Scans all Markdown notes (`*.md`) inside `janus.notesRoot` and extracts dated entries in real time:
    - German date formats (`DD.MM.YYYY`, `DD.MM.YY`) with optional times (`14:00`, `14:00 Uhr`)
    - ISO date formats (`YYYY-MM-DD`, `@YYYY-MM-DD`) with optional times
    - YAML frontmatter `date: YYYY-MM-DD` (using note title/heading as event title)
  - Aggregates tasks with a `dueDate` (`YYYY-MM-DD`) from all folder `tasks.json` files via `FolderTasksService`.
  - Automatically re-scans and pushes live updates whenever `CompanionWatcher` detects changes to `*.md` or `tasks.json` files.
- **Calendar Month Webview (`CalendarViewProvider` in `ViewColumn.One`)**:
  - Renders a 7-column monthly grid (Monday–Sunday) with month navigation (`<`, `>`, `Heute`), today highlighting, and compact event/task badges per day.
  - Clicking an event chip directly opens the linked Markdown note in the Janus Markdown Editor (`janus.markdownEditor`).
  - Clicking a day cell opens or updates a dedicated VS Code split-editor panel (`ViewColumn.Beside`) showing full details for that day.
- **Day Details VS Code Panel (`CalendarDayDetailsPanel` in `ViewColumn.Beside`)**:
  - Dedicated VS Code `WebviewPanel` opened beside the calendar (`ViewColumn.Beside`) displaying all note appointments (time, title, context snippet, clickable note link badge) and due tasks (interactive completion checkbox, priority badge, clickable note/folder link) for the selected date.
  - Stays synchronized in real time when the user selects another day in the Month View or edits/saves notes and tasks.
- **Notes Sidebar & Command Integration**:
  - Adds a pinned root entry `Kalender` (`AllCalendarTreeItem`) right below `Alle Aufgaben` in `NotesTreeDataProvider` and registers the `janus.openCalendar` command.
- **AI Task Generation `dueDate` Support**:
  - Enhances `AiTaskGeneratorService` so AI-extracted tasks from Markdown notes also capture mentioned deadlines/dates in the `dueDate` (`YYYY-MM-DD`) field of `TaskItem`.

## Capabilities

### New Capabilities
- `calendar-view`: Interactive monthly calendar webview (`ViewColumn.One`), synchronized split-editor Day Details VS Code panel (`ViewColumn.Beside`), automatic date/event extraction from Markdown notes and folder `tasks.json` deadlines, real-time watcher updates, and deep links to source notes.

### Modified Capabilities
- `notes-sidebar`: Add a pinned top-level `Kalender` item to the Notes TreeView displaying the count of upcoming events/deadlines and opening the Calendar Month View on click.
- `ai-task-generation`: Extend AI task extraction prompt and parser to extract optional `dueDate` (`YYYY-MM-DD`) values when deadlines or dates are stated in a note.

## Impact

- **New Files**:
  - `src/services/calendarService.ts` (date/event parser for Markdown notes + task deadline aggregator)
  - `src/editors/calendarViewProvider.ts` (manages the Month View `WebviewPanel` in `ViewColumn.One` and the synchronized Day Details `WebviewPanel` in `ViewColumn.Beside`)
  - `src/webviews/calendar/index.tsx`, `src/webviews/calendar/CalendarMonthApp.tsx`, `src/webviews/calendar/CalendarDayDetailsApp.tsx`
- **Modified Files**:
  - `package.json` (`janus.openCalendar` command contribution)
  - `esbuild.js` (`calendar` webview entry point)
  - `src/extension.ts` (wire `CalendarService`, `CalendarViewProvider`, `CompanionWatcher` refresh, and `janus.openCalendar`)
  - `src/ui/notesTreeDataProvider.ts` (add pinned `CalendarTreeItem` at root level)
  - `src/services/aiTaskGeneratorService.ts` (include optional `dueDate` extraction)

