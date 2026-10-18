# Spec Delta

## MODIFIED Requirements

### Requirement: Language Model Tool for Reading Notes and Companions
The system SHALL provide a tool `janus_read_note_and_companions` that returns the textual content of a Markdown note and the parsed data of the containing folder's `tasks.json` and the note's `*.chart.json` companion file.

#### Scenario: Reading existing note and companions
- **WHEN** a Language Model calls `janus_read_note_and_companions` with a valid note path
- **THEN** the tool returns the note's Markdown text along with parsed contents of the containing folder's `tasks.json` and `<note>.chart.json` if present

### Requirement: Language Model Tool for Mutating Tasks
The system SHALL provide a tool `janus_mutate_tasks` that updates, adds, or checks off tasks in a folder's `tasks.json` companion file, enforcing strict schema validation.

#### Scenario: Valid task mutation
- **WHEN** a Language Model calls `janus_mutate_tasks` with valid task item updates for a note or folder
- **THEN** the tool validates the input against the task schema, updates `<folder>/tasks.json` on disk, and returns a confirmation result

#### Scenario: Invalid schema rejected
- **WHEN** a Language Model passes malformed task payload to `janus_mutate_tasks`
- **THEN** the tool returns a descriptive schema validation error without writing corrupted data to disk

