# calendar-view Specification

## Purpose

Provides an interactive monthly calendar webview and a synchronized split-editor Day Details VS Code panel that automatically extract, display, and live-update appointments from Markdown notes and task deadlines across the workspace, with one-click navigation back to source notes.

## Requirements

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
The system SHALL aggregate all tasks from folder `tasks.json` files within `janus.notesRoot` and include them in the calendar alongside note events: on their due date when they have a valid `dueDate` (`YYYY-MM-DD`), and on their scheduled date when they have a valid `scheduledDate` (`YYYY-MM-DD`). A task with both dates SHALL appear on both days. Each task entry SHALL record whether it represents the due or the scheduled date, and the Calendar Month View SHALL render due and scheduled task chips with distinct, recognizable markers. Entries for past dates SHALL remain on their original day, regardless of completion state.

#### Scenario: Task with dueDate appears on calendar day
- **WHEN** `projects/tasks.json` contains a task with `title: "Pitch Deck fertigstellen"`, `dueDate: "2026-10-24"`, and `note: "pitch.md"`
- **THEN** the calendar includes that task as a deadline entry on `2026-10-24` with its completion status, priority, folder URI, and source note reference

#### Scenario: Task with scheduledDate appears on calendar day
- **WHEN** `projects/tasks.json` contains a task with `title: "Steuer"` and `scheduledDate: "2026-10-30"` but no `dueDate`
- **THEN** the calendar includes that task as a scheduled entry on `2026-10-30` and does not show a deadline entry for it

#### Scenario: Task with both dates appears twice with distinct markers
- **WHEN** a task `Bericht schreiben` has `scheduledDate: "2026-10-30"` and `dueDate: "2026-11-03"`
- **THEN** the Calendar Month View shows a scheduled chip for it on `2026-10-30` and a due chip on `2026-11-03`, and the two chips are visually distinguishable

#### Scenario: Past dates do not roll over
- **WHEN** today is `2026-11-05` and an open task has `scheduledDate: "2026-11-02"`
- **THEN** the task appears on `2026-11-02` only and not on `2026-11-05`

#### Scenario: Invalid dates are ignored
- **WHEN** a task has `scheduledDate: "next week"`
- **THEN** no scheduled calendar entry is created for it

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
- All tasks scheduled for the selected day, as a separate group from the due tasks, with the same checkbox, priority badge, and link

#### Scenario: Clicking a day updates the Day Details sidebar panel
- **WHEN** the user clicks on `24. Oktober 2026` in the Calendar Month View
- **THEN** the Day Details sidebar panel (`Tagesdetails`) reveals and updates to display all note appointments and due tasks for `2026-10-24`

#### Scenario: Selecting another day updates existing Day Details panel
- **WHEN** the Day Details sidebar panel is active and the user clicks on `28. Oktober 2026` in the Calendar Month View
- **THEN** the Day Details sidebar panel updates in place to display the entries for `2026-10-28`

#### Scenario: Toggling a due task from the Day Details panel
- **WHEN** the user toggles the completion checkbox of a due task inside the Day Details panel
- **THEN** the system updates the task's `completed` and `status` fields in the corresponding folder's `tasks.json` and refreshes the Calendar Month View, Day Details panel, and Notes Sidebar

#### Scenario: Scheduled tasks listed separately
- **WHEN** the selected day has one task due and another task scheduled
- **THEN** the Day Details panel shows them in two separate groups, labelled as due and scheduled

#### Scenario: Toggling a scheduled task from the Day Details panel
- **WHEN** the user toggles the completion checkbox of a scheduled task inside the Day Details panel
- **THEN** the task's completion is updated in its folder's `tasks.json`, and its entries on both its scheduled and its due day show the new state after refresh

### Requirement: Real-Time Calendar Updates on Note and Task Changes
The system SHALL listen for file creation, modification, and deletion events on Markdown notes (`*.md`) and task files (`tasks.json`) in the workspace and automatically refresh both the Calendar Month View and the Day Details panel in real time.

#### Scenario: Editing a date in a Markdown note updates the calendar live
- **WHEN** the Calendar Month View (and optionally the Day Details panel) is open and the user changes a date in a note from `24.10.2026` to `25.10.2026` and saves
- **THEN** the event automatically moves from `2026-10-24` to `2026-10-25` in the open calendar webviews without manual reloading

### Requirement: Daily Notes in the Calendar
The calendar SHALL show every daily note (as defined in `daily-notes`) as a note entry on its date, titled with its first `#` heading or, without one, `Tagesnotiz`, even if the note's content contains no date. When the note's frontmatter `date` is the same date, the calendar SHALL show only one entry for it. A heading of the daily note that contains the note's own date SHALL NOT produce an additional entry. Other dates mentioned inside a daily note, including the note's own date outside headings, SHALL still produce their own entries as today.

#### Scenario: Daily note without a date in its content
- **WHEN** `journal/2026-10-29.md` contains only `# Donnerstag` and some text
- **THEN** the calendar shows an entry `Donnerstag` on 2026-10-29 that opens the note

#### Scenario: No duplicate with frontmatter date
- **WHEN** `journal/2026-10-29.md` has frontmatter `date: 2026-10-29`
- **THEN** the calendar shows one entry for this note on 2026-10-29

#### Scenario: Own date in the heading
- **WHEN** `journal/2026-10-29.md` has frontmatter `date: 2026-10-29` and the heading `# Donnerstag, 29.10.2026`
- **THEN** the calendar shows one entry for this note on 2026-10-29

#### Scenario: Appointment inside a daily note
- **WHEN** `journal/2026-10-29.md` contains `Review am 05.11.2026`
- **THEN** the calendar shows the daily note on 2026-10-29 and the review entry on 2026-11-05

### Requirement: Daily Note Action in Day Details
The Day Details panel SHALL show a button `Tagesnotiz öffnen` when the selected day has a daily note and `Tagesnotiz anlegen` when it does not. Clicking it SHALL open the daily note of the selected day in the Janus Markdown Editor, creating it first with the content defined in `daily-notes` if it does not exist. This SHALL work for any selected day, including past and future days.

#### Scenario: Creating a daily note for another day
- **WHEN** the user selects 2026-11-02 in the calendar, which has no daily note, and clicks `Tagesnotiz anlegen`
- **THEN** `journal/2026-11-02.md` is created for that date and opened, and the button then reads `Tagesnotiz öffnen`

#### Scenario: Opening an existing daily note
- **WHEN** the user selects 2026-10-29, which has a daily note, and clicks `Tagesnotiz öffnen`
- **THEN** `journal/2026-10-29.md` opens unchanged
