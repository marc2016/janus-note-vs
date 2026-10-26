# Spec Delta

## MODIFIED Requirements

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
