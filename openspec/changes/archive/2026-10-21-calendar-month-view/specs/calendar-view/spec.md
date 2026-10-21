# Spec Delta

## Purpose

Provides an interactive monthly calendar webview and a synchronized split-editor Day Details VS Code panel that automatically extract, display, and live-update appointments from Markdown notes and task deadlines across the workspace, with one-click navigation back to source notes.

## ADDED Requirements

### Requirement: Automatic Event Extraction from Markdown Notes
The system SHALL recursively scan all Markdown notes (`*.md`, `*.markdown`) within the configured `janus.notesRoot` directory and extract calendar appointments without requiring manual registration. The extractor SHALL recognize:
- German date formats (`DD.MM.YYYY` and `DD.MM.YY`) with optional 24-hour times (`HH:MM` or `HH:MM Uhr`)
- ISO date formats (`YYYY-MM-DD` and `@YYYY-MM-DD`) with optional 24-hour times (`HH:MM`)
- YAML frontmatter `date: YYYY-MM-DD` entries (using the note's first heading or filename as the event title)

Each extracted note event SHALL record its normalized ISO date (`YYYY-MM-DD`), optional time (`HH:MM`), descriptive title, source note URI, relative note path, and line number.

#### Scenario: Extracting inline German and ISO dates from a Markdown note
- **WHEN** a note `meetings/kickoff.md` contains `- 24.10.2026 14:00 Call mit Anna` and `@2026-10-28 Projekt-Review`
- **THEN** the calendar extractor produces two note events on `2026-10-24` (at `14:00`, title `Call mit Anna`) and `2026-10-28` (title `Projekt-Review`), both linked to `meetings/kickoff.md`

#### Scenario: Extracting frontmatter date from a Markdown note
- **WHEN** a note `projects/release.md` has YAML frontmatter `date: 2026-10-30` and heading `# v1.0 Release`
- **THEN** the calendar extractor produces a note event on `2026-10-30` with title `v1.0 Release` linked to `projects/release.md`

### Requirement: Task Deadlines Included in Calendar
The system SHALL aggregate all tasks from folder `tasks.json` files within `janus.notesRoot` that have a valid `dueDate` (`YYYY-MM-DD`) and include them in the calendar on their respective due dates alongside note events.

#### Scenario: Task with dueDate appears on calendar day
- **WHEN** `projects/tasks.json` contains a task with `title: "Pitch Deck fertigstellen"`, `dueDate: "2026-10-24"`, and `note: "pitch.md"`
- **THEN** the calendar includes that task as a deadline entry on `2026-10-24` with its completion status, priority, folder URI, and source note reference

### Requirement: Monthly Calendar Webview in Main Editor Area
The system SHALL provide a command `janus.openCalendar` that opens a Calendar Month View webview panel in the primary editor column (`ViewColumn.One`). The Month View SHALL render a 7-column weekly grid (Monday through Sunday) for the active month, navigation controls for switching to the previous month, next month, or current month (`Heute`), visual highlighting for today's date, and compact event/task chips inside each day cell.

#### Scenario: Navigating between months in the Calendar Month View
- **WHEN** the user opens the Calendar Month View and clicks the next-month or previous-month button (or `Heute`)
- **THEN** the 7-column calendar grid updates to show the days and extracted events/tasks for the selected month

#### Scenario: Clicking an event chip opens the linked note
- **WHEN** the user clicks directly on a note event chip in the Calendar Month View
- **THEN** the system opens the linked Markdown note in the Janus Markdown Editor

### Requirement: Synchronized Day Details Sidebar Panel
When the user clicks a day cell in the Calendar Month View, the system SHALL reveal and update a dedicated Day Details Sidebar Webview Panel (`janus.calendarDayDetailsView` in the Janus Note view container) displaying the detailed schedule for that date. The Day Details panel SHALL list:
- All note appointments for the selected day (including time, title, source line/context, and a clickable button/badge to open the source note)
- All tasks due on the selected day (including an interactive checkbox to toggle task completion directly in `tasks.json`, priority badge, and a clickable link to the associated note or folder tasks)

#### Scenario: Clicking a day updates the Day Details sidebar panel
- **WHEN** the user clicks on `24. Oktober 2026` in the Calendar Month View
- **THEN** the Day Details sidebar panel (`Tagesdetails`) reveals and updates to display all note appointments and due tasks for `2026-10-24`

#### Scenario: Selecting another day updates existing Day Details panel
- **WHEN** the Day Details sidebar panel is active and the user clicks on `28. Oktober 2026` in the Calendar Month View
- **THEN** the Day Details sidebar panel updates in place to display the entries for `2026-10-28`

#### Scenario: Toggling a due task from the Day Details panel
- **WHEN** the user toggles the completion checkbox of a due task inside the Day Details panel
- **THEN** the system updates the task's `completed` and `status` fields in the corresponding folder's `tasks.json` and refreshes the Calendar Month View, Day Details panel, and Notes Sidebar

### Requirement: Real-Time Calendar Updates on Note and Task Changes
The system SHALL listen for file creation, modification, and deletion events on Markdown notes (`*.md`) and task files (`tasks.json`) in the workspace and automatically refresh both the Calendar Month View and the Day Details panel in real time.

#### Scenario: Editing a date in a Markdown note updates the calendar live
- **WHEN** the Calendar Month View (and optionally the Day Details panel) is open and the user changes a date in a note from `24.10.2026` to `25.10.2026` and saves
- **THEN** the event automatically moves from `2026-10-24` to `2026-10-25` in the open calendar webviews without manual reloading

