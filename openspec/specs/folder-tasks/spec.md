# folder-tasks Specification

## Purpose

Provides directory-scoped task storage via `tasks.json` and a virtual aggregated global task list across the entire Janus notes workspace without requiring root files.

## Requirements

### Requirement: Directory-Scoped Task Storage
The system SHALL store and manage task items within a `tasks.json` file in each folder of the notes collection, supporting task completion states, priorities, creation dates, optional associations with notes, an optional due date (`dueDate`, `YYYY-MM-DD`), and an optional scheduled date (`scheduledDate`, `YYYY-MM-DD`). Reading, updating, and recovering partially malformed tasks SHALL preserve both date fields. Task files without these fields SHALL remain valid.

#### Scenario: Storing tasks in a directory tasks.json
- **WHEN** user creates or updates a task in a folder
- **THEN** system persists the task array in `<folder>/tasks.json` with unique ID, title, completed status, priority, and optional note reference

#### Scenario: Persisting due and scheduled dates
- **WHEN** a task with `dueDate: "2026-11-03"` and `scheduledDate: "2026-10-30"` is updated (e.g. its completion is toggled)
- **THEN** both date fields are still present with unchanged values in `<folder>/tasks.json`

#### Scenario: Recovering a partially malformed task keeps its dates
- **WHEN** a task entry in `tasks.json` fails strict validation (e.g. an empty title) but contains `dueDate` and `scheduledDate`
- **THEN** the recovered task keeps both dates

#### Scenario: Loading task files without date fields
- **WHEN** an existing `tasks.json` contains tasks without `dueDate` or `scheduledDate`
- **THEN** the tasks load unchanged with no dates set

### Requirement: Virtual Global Task List Aggregation
The system SHALL dynamically discover all `tasks.json` files across the active notes root and aggregate their tasks into a single virtual collection without creating a physical file in the root.

#### Scenario: Aggregating tasks across all subdirectories
- **WHEN** user opens the global task list
- **THEN** system scans all subdirectories in `janus.notesRoot`, collects all tasks, and groups them by their containing folder

### Requirement: Bi-directional Synchronization of Global Tasks
The system SHALL immediately reflect any task mutation performed in the virtual global task list back to the corresponding folder's `tasks.json` file on disk.

#### Scenario: Toggling a task in the global list
- **WHEN** user toggles a task belonging to `project-a` in the virtual global task list
- **THEN** system updates the task's completion state directly in `project-a/tasks.json` and notifies registered watchers

### Requirement: Task Due and Scheduled Date Editing
The system SHALL let users set, change, and remove a due date (deadline) and a scheduled date (planned work day) for each task in the task list, in both folder and global mode, and persist the change to the task's folder `tasks.json`. Each task row SHALL display a distinct chip for each date that is set (labelled as due vs. scheduled, with the date in German format `DD.MM.`, and the year added when it is not the current year) and an action to add a date that is not yet set. Open tasks whose due or scheduled date lies before today SHALL be marked as overdue. A scheduled date later than the due date SHALL be indicated but SHALL NOT be rejected.

#### Scenario: Setting a due date on a task
- **WHEN** the user opens the date action of the task `Bericht schreiben` in the task list and picks `03.11.2026` as due date
- **THEN** the task row shows a due chip `03.11.` and the task is stored in its folder's `tasks.json` with `dueDate: "2026-11-03"`

#### Scenario: Setting a scheduled date on a task
- **WHEN** the user picks `30.10.2026` as scheduled date for the task `Bericht schreiben`
- **THEN** the task row shows a scheduled chip `30.10.` next to the due chip and the task is stored with `scheduledDate: "2026-10-30"`

#### Scenario: Changing an existing date
- **WHEN** the user clicks the existing due chip of a task and picks a different date
- **THEN** the chip shows the new date and `dueDate` is updated in `tasks.json`

#### Scenario: Removing a date
- **WHEN** the user clicks the scheduled chip of a task and chooses to remove the date
- **THEN** the scheduled chip disappears and the `scheduledDate` field is removed from the task in `tasks.json`, while all other task fields stay unchanged

#### Scenario: Editing dates in the global task list
- **WHEN** the user sets a due date on a task belonging to `project-a` in the global task list
- **THEN** the date is written to `project-a/tasks.json` and the change is reflected wherever the task is shown

#### Scenario: Date changes in the folder task editor are saved immediately
- **WHEN** the user sets or removes a date in the task list opened for a single folder's `tasks.json`
- **THEN** the change is written to `tasks.json` on disk without a manual save, so the calendar and other task views show it right away

#### Scenario: Overdue open task
- **WHEN** an open task has a due date or a scheduled date before today
- **THEN** the corresponding chip is visibly marked as overdue

#### Scenario: Completed tasks are not marked overdue
- **WHEN** a completed task has a due date before today
- **THEN** the due chip is shown without the overdue marking

#### Scenario: Scheduled after due date
- **WHEN** a task's scheduled date is later than its due date
- **THEN** both dates are stored as entered and the scheduled chip indicates that it lies after the deadline

### Requirement: Scrollable Task List With Fixed Toolbar
The task list, in both folder and global mode, SHALL keep its header (title, open-task counter, sort selection), the quick-add bar and the search field visible at the top, and SHALL make the list of tasks below them scrollable when it does not fit into the view.

#### Scenario: Scrolling a long task list
- **WHEN** a folder's `tasks.json` contains more tasks than fit into the editor height
- **THEN** the user can scroll to the last task, while the header, quick-add bar and search field stay visible

#### Scenario: Scrolling the global task list
- **WHEN** the global task list contains more folder groups and tasks than fit into the view
- **THEN** the user can scroll through all groups, while the header, quick-add bar and search field stay visible

### Requirement: Open and Completed Task Sections
The task list SHALL show open tasks first and SHALL show completed tasks in a separate, collapsible section labelled „Erledigt“ with the number of completed tasks, below the open tasks. In global mode, each folder group SHALL have its own open tasks and done section. Toggling a task's completion SHALL move it between the sections. The done section SHALL be collapsed by default. While a search query is active, done sections that contain matching tasks SHALL be shown expanded, without changing the collapse state remembered for when the search is cleared. The header SHALL show the number of open tasks. The task list SHALL NOT offer separate „Alle / Nur Offene / Erledigt“ filter buttons.

#### Scenario: Completed tasks are separated
- **WHEN** a folder has the open tasks `A`, `B` and the completed task `C`
- **THEN** `A` and `B` are listed in the open section, and a collapsed section „Erledigt (1)“ is shown below them

#### Scenario: Expanding the done section
- **WHEN** the user clicks the collapsed „Erledigt (1)“ section
- **THEN** the section expands and shows `C`

#### Scenario: Completing a task moves it
- **WHEN** the user checks the open task `A`
- **THEN** `A` leaves the open section, the done section shows „Erledigt (2)“, and `A` is stored as completed in `tasks.json`

#### Scenario: Reopening a task moves it back
- **WHEN** the user unchecks the completed task `C` in the expanded done section
- **THEN** `C` appears in the open section according to the selected sort order

#### Scenario: Done sections per folder in global mode
- **WHEN** the global task list shows folders `project-a` (one completed task) and `project-b` (no completed tasks)
- **THEN** `project-a` shows a section „Erledigt (1)“ below its open tasks, and `project-b` shows no done section

#### Scenario: Search reveals matching completed tasks
- **WHEN** the done section is collapsed and the user searches for a term that matches a completed task
- **THEN** the done section is shown expanded with the matching completed task, and after clearing the search it is collapsed again

### Requirement: Selectable Task Sort Order
The task list SHALL offer a sort selection with the options „Datum“, „Priorität“ and „Dateireihenfolge“, applied to the open and the completed tasks of each list or folder group. Sorting SHALL affect only the display and SHALL NOT change the order of tasks in `tasks.json`. The default SHALL be „Datum“.
- „Datum“: open overdue tasks first; then tasks by the earlier of their due and scheduled date, ascending; then tasks without any date. Ties are ordered by priority (high, medium, low), then by creation date (oldest first), then by file order.
- „Priorität“: high, then medium, then low (missing priority counts as medium). Ties are ordered as in „Datum“.
- „Dateireihenfolge“: the order in which the tasks are stored in `tasks.json`.

#### Scenario: Sorting by date
- **WHEN** today is `2026-11-01`, the selected order is „Datum“, and the open tasks are `X` (no date, high), `Y` (due `2026-11-05`), `Z` (scheduled `2026-11-03`, due `2026-11-10`) and `W` (due `2026-10-30`)
- **THEN** the open section lists `W`, `Z`, `Y`, `X`

#### Scenario: Sorting by priority
- **WHEN** the selected order is „Priorität“ and the open tasks are `P` (low), `Q` (high, due `2026-11-08`), `R` (high, due `2026-11-04`) and `S` (no priority)
- **THEN** the open section lists `R`, `Q`, `S`, `P`

#### Scenario: Sorting by file order
- **WHEN** the selected order is „Dateireihenfolge“
- **THEN** the tasks are listed in the order they are stored in `tasks.json`

#### Scenario: Sorting does not touch the file
- **WHEN** the user switches the sort order and then toggles a task
- **THEN** `tasks.json` keeps the original order of its tasks

### Requirement: Remembered Task List View State
The task list SHALL remember the selected sort order and the collapsed state of done sections and folder groups for its view, and SHALL restore them when the view is hidden and shown again or reloaded within the same VS Code session.

#### Scenario: Sort order survives switching tabs
- **WHEN** the user selects „Priorität“, switches to another editor tab and back to the task list
- **THEN** the task list is still sorted by „Priorität“

#### Scenario: Expanded done section survives reload
- **WHEN** the user expands the done section and the task list webview is reloaded
- **THEN** the done section is still expanded

### Requirement: Task Priority Indicator
Each task row SHALL show its priority as a coloured indicator at the left edge of the row (distinct colours for high, medium and low) with a tooltip naming the priority, instead of a text label. Activating the indicator by click or keyboard SHALL cycle the priority (low → medium → high → low) and persist it to `tasks.json`.

#### Scenario: Priority shown as indicator
- **WHEN** a task has priority `high`
- **THEN** its row shows the high-priority colour at its left edge and the tooltip reads „Priorität: Hoch“

#### Scenario: Cycling the priority
- **WHEN** the user clicks the priority indicator of a task with priority `medium`
- **THEN** the indicator shows the high-priority colour and the task is stored with `priority: "high"`

### Requirement: Compact Quick-Add
The task list SHALL let the user add a task by typing a title into a single input field and pressing Enter. Priority, an optional note reference and, in global mode, the target folder SHALL be selectable in an options menu next to the input. The chosen priority and target folder SHALL apply to subsequently added tasks; the note reference SHALL be cleared after a task is added. The current target folder SHALL be recognisable in global mode without opening the menu.

#### Scenario: Adding a task with defaults
- **WHEN** the user types `Bericht schreiben` into the quick-add field and presses Enter
- **THEN** a new open task `Bericht schreiben` with priority `medium` is stored in `tasks.json` and the input is cleared

#### Scenario: Adding a task with options
- **WHEN** the user opens the options menu, chooses priority „Hoch“ and note `meeting.md`, then adds the task `Folien vorbereiten`
- **THEN** the task is stored with `priority: "high"` and `note: "meeting.md"`

#### Scenario: Choosing the target folder in global mode
- **WHEN** in the global task list the user chooses the folder `project-b` in the options menu and adds a task
- **THEN** the task is written to `project-b/tasks.json`, and `project-b` is shown as the current target next to the input
