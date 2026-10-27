# Spec Delta

## MODIFIED Requirements

### Requirement: Folder Tasks Summary
The system SHALL aggregate and display the task progress and status overview from the folder's `tasks.json` companion file (when present), providing a button to open the folder task list. Each task in the preview SHALL show its due date and scheduled date when set, using the same German short date format and overdue hints as the task list. The preview is read-only for dates.

#### Scenario: Displaying task status
- **WHEN** the folder contains a `tasks.json` with 2 open tasks and 1 completed task
- **THEN** the Folder Overview renders a task status summary card showing 1/3 completed tasks and lists the open tasks

#### Scenario: Displaying task dates in the preview
- **WHEN** a previewed task has `dueDate: "2026-11-05"` and `scheduledDate: "2026-11-02"` and the current year is 2026
- **THEN** the task row shows a "Geplant" chip with `02.11.` and a "Fällig" chip with `05.11.`

#### Scenario: Overdue task in the preview
- **WHEN** a previewed open task has a due date before today
- **THEN** its due date chip is marked as overdue in the same way as in the task list

#### Scenario: Task without dates
- **WHEN** a previewed task has neither `dueDate` nor `scheduledDate`
- **THEN** the task row shows no date chips and no action for adding a date

#### Scenario: Priority badge
- **WHEN** a previewed task has priority `high`, `medium`, or `low`
- **THEN** the task row shows a priority badge with a distinct style for each of the three values

#### Scenario: Opening task board from overview
- **WHEN** user clicks the `Aufgaben` action in the folder header or `Zu den Aufgaben` on the task card
- **THEN** system opens the folder task list for that folder (`janus.openFolderTasks`), creating the folder's `tasks.json` first if it does not exist
