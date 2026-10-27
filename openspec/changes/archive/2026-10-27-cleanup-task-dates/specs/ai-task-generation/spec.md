# Spec Delta

## MODIFIED Requirements

### Requirement: Context-Aware Task Extraction from Note to Folder Tasks
The system SHALL extract actionable tasks (`title`, `priority: 'low' | 'medium' | 'high'`, `status: 'todo'`, optional `dueDate: 'YYYY-MM-DD'`, and optional `scheduledDate: 'YYYY-MM-DD'`) from the active Markdown note using the currently configured AI model and append only new, non-duplicate tasks to the containing folder's `tasks.json`. `dueDate` is the deadline by which the task must be done; `scheduledDate` is the day the note says the task will be worked on. The system SHALL provide the current local date to the model so relative dates can be resolved, and SHALL drop any date that cannot be normalized to `YYYY-MM-DD` instead of rejecting the task.

#### Scenario: Generating tasks from a Markdown note into folder tasks.json
- **WHEN** user triggers task generation on a Markdown note whose folder already has 2 existing tasks in `tasks.json`
- **THEN** system sends the note content, the current date, and existing folder task titles to the active AI model, validates the returned tasks against `TaskItemSchema` (including normalized `dueDate` and `scheduledDate` in `YYYY-MM-DD` format when the note mentions them for the task), appends only the newly identified tasks to `<folder>/tasks.json`, and refreshes the editor footer and sidebar task counts

#### Scenario: Extracting a scheduled date
- **WHEN** the note contains "Am 03.11. kümmere ich mich um das Angebot, Abgabe ist der 07.11." and the model returns both dates
- **THEN** the created task has `scheduledDate: "2026-11-03"` and `dueDate: "2026-11-07"` (for a note written in 2026)

#### Scenario: Invalid date from the model
- **WHEN** the model returns a task with `scheduledDate: "nächste Woche"`
- **THEN** the task is still created, without a `scheduledDate`

#### Scenario: Handling missing or unconfigured AI model gracefully
- **WHEN** user triggers task generation but no AI model is available or configured
- **THEN** system prompts the user to select an available model or configure an AI provider before running extraction
