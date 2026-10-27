# Spec Delta

## MODIFIED Requirements

### Requirement: Language Model Tool for Mutating Tasks
The system SHALL provide a tool `janus_mutate_tasks` that updates, adds, or checks off tasks in a folder's `tasks.json` companion file, enforcing strict schema validation. The tool's published input schema SHALL describe the optional task fields `priority` (`low`, `medium`, `high`), `dueDate` and `scheduledDate` (`YYYY-MM-DD`), and `note`, so language models can set them.

#### Scenario: Valid task mutation
- **WHEN** a Language Model calls `janus_mutate_tasks` with valid task item updates for a note or folder
- **THEN** the tool validates the input against the task schema, updates `<folder>/tasks.json` on disk, and returns a confirmation result

#### Scenario: Setting task dates through the tool
- **WHEN** a Language Model calls `janus_mutate_tasks` with action `update` and a task carrying `scheduledDate: "2026-11-03"`
- **THEN** the task in `<folder>/tasks.json` has that `scheduledDate` and its other fields are unchanged

#### Scenario: Invalid schema rejected
- **WHEN** a Language Model passes malformed task payload to `janus_mutate_tasks`
- **THEN** the tool returns a descriptive schema validation error without writing corrupted data to disk
