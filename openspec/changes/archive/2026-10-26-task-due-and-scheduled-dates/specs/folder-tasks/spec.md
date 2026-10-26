# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
