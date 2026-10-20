# Spec Delta

## MODIFIED Requirements

### Requirement: Context-Aware Task Extraction from Note to Folder Tasks
The system SHALL extract actionable tasks (`title`, `priority: 'low' | 'medium' | 'high'`, `status: 'todo'`, and optional `dueDate: 'YYYY-MM-DD'`) from the active Markdown note using the currently configured AI model and append only new, non-duplicate tasks to the containing folder's `tasks.json`.

#### Scenario: Generating tasks from a Markdown note into folder tasks.json
- **WHEN** user triggers task generation on a Markdown note whose folder already has 2 existing tasks in `tasks.json`
- **THEN** system sends the note content and existing folder task titles to the active AI model, validates the returned tasks against `TaskItemSchema` (including normalized `dueDate` in `YYYY-MM-DD` format when a deadline or date is mentioned for the task), appends only the newly identified tasks to `<folder>/tasks.json`, and refreshes the editor footer and sidebar task counts

#### Scenario: Handling missing or unconfigured AI model gracefully
- **WHEN** user triggers task generation but no AI model is available or configured
- **THEN** system prompts the user to select an available model or configure an AI provider before running extraction

