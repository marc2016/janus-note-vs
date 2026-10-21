# Design

## Context

Janus Note already provides a custom TreeView sidebar (`NotesTreeDataProvider`), folder-level and global task management (`FolderTasksService` + `GlobalTasksViewProvider`), a WYSIWYG Markdown editor (`MarkdownEditorProvider`), and a workspace-wide `CompanionWatcher` that fires whenever `*.md` or `tasks.json` files change. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Extract dated events and appointments deterministically from all Markdown notes (`*.md`) in `janus.notesRoot` with zero latency on save.
- Combine extracted note appointments with tasks that carry a `dueDate` (`YYYY-MM-DD`) from folder `tasks.json` files.
- Provide a dedicated Month View webview (`ViewColumn.One`) paired with an on-demand VS Code split-editor Day Details panel (`ViewColumn.Beside`).
- Keep both webview panels and the sidebar tree item synchronized in real time via `CompanionWatcher`.

**Non-Goals:**
- External calendar sync (Google Calendar, CalDAV, iCal/ICS import/export).
- Recurring event rules (RRULE) or multi-timezone conversion.
- Mutating free-text dates inside Markdown notes from the calendar UI (users click the link to jump into the note to edit text; task checkboxes can be toggled directly).

## Decisions

### 1. Dual-Source Event Aggregation in `CalendarService`
- **Decision**: Implement `CalendarService` (`src/services/calendarService.ts`) as a stateless scanner that combines two sources on demand:
  1. **Markdown Note Scanner**: Recursively walks `janus.notesRoot` (skipping `.git`, `node_modules`, `dist`, hidden files) and parses each `.md` file for:
     - YAML frontmatter `date: YYYY-MM-DD` (creates an all-day note event titled after the first `# Heading` or filename).
     - Inline German dates (`\b(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b`) and ISO dates (`(?:@|\b)(\d{4})-(\d{2})-(\d{2})\b`), plus optional time (`(\d{1,2}:\d{2})(?:\s*Uhr)?`) on the same line.
     - Cleans markdown list markers (`- `, `* `, `### `, `[ ]`) and the date/time token itself to derive a concise event title (falling back to the note's heading/filename if the line only contains a date).
     - Skips lines inside fenced code blocks (` ``` `).
  2. **Folder Tasks Aggregator**: Calls `FolderTasksService.loadAllTasks(notesRootUri)` and maps any `TaskItem` with a valid `dueDate` (`YYYY-MM-DD`) into a calendar entry of kind `'task'`.
- **Rationale**: Deterministic regex parsing of Markdown notes guarantees instant updates on every save without LLM cost or stale cache artifacts, while `TaskItem.dueDate` covers AI-extracted and manually managed deadlines.
- **Alternatives considered**: Storing a separate `calendar.json` companion per note. Rejected because deleting or editing a date in Markdown would leave orphaned events unless continuously reconciled.

### 2. Coordinated Dual-Panel Webview Architecture (`ViewColumn.One` + `ViewColumn.Beside`)
- **Decision**: `CalendarViewProvider` (`src/editors/calendarViewProvider.ts`) manages two `vscode.WebviewPanel` instances sharing a single compiled bundle (`dist/webviews/calendar.js`) differentiated by initial `mode: 'month' | 'day-details'`:
  - `monthPanel` (`janus.calendarView`, opened in ` vscode.ViewColumn.One`): Renders the 7-column month grid (`Monday`–`Sunday`), month switcher, and event chips.
  - `dayDetailsPanel` (`janus.calendarDayDetailsView`, opened in `vscode.ViewColumn.Beside`): Created or revealed when the user sends `{ type: 'selectDay', date: 'YYYY-MM-DD' }` from the Month View. If `dayDetailsPanel` is already open, `CalendarViewProvider` updates its title (`Tagesdetails: <Datum>`) and posts `{ type: 'updateDayDetails', date, events }` without creating additional tabs.
- **Rationale**: Matches the user's explicit preference for a real VS Code split panel (`ViewColumn.Beside`) while reusing a single React bundle (`calendar.js`) and shared Tailwind/shadcn UI components.

```text
+-----------------------------------+       selectDay('2026-10-24')       +-----------------------------------+
|  monthPanel (ViewColumn.One)      | ==================================> |  dayDetailsPanel (Beside)         |
|  mode: 'month'                    |                                     |  mode: 'day-details'              |
|  - 7x5/6 Month Grid               | <================================== |  - Note Events + [Notiz öffnen]   |
|  - Event & Task chips             |    toggleTask / CompanionWatcher    |  - Due Tasks + Checkbox + [Notiz] |
+-----------------------------------+                                     +-----------------------------------+
```

### 3. Extending `AiTaskGeneratorService` for `dueDate`
- **Decision**: Update `ExtractedTaskSchema` and the system prompt in `src/services/aiTaskGeneratorService.ts` to request an optional `"dueDate": "YYYY-MM-DD"` field whenever a task has an explicit date or deadline in the note. Normalize German (`DD.MM.YYYY`) or ISO dates returned by the model into `YYYY-MM-DD` before persisting to `tasks.json`.
- **Rationale**: Enables AI task generation to feed directly into the calendar view without extra user steps.

## Risks / Trade-offs

- **[Risk] False-positive date matches in code blocks or URLs** → **Mitigation**: Track fenced code block state (` ``` `) while scanning lines, validate calendar ranges (`month` 1–12, `day` 1–31, `year` 2000–2100), and ignore dates embedded inside URLs (`https://...`).
- **[Risk] Workspace scan performance on frequent file watcher events** → **Mitigation**: `janus.notesRoot` note collections are lightweight text files; `CalendarViewProvider.refresh()` only runs an active scan when `monthPanel` or `dayDetailsPanel` is actually open (plus lightweight count for the tree view).

