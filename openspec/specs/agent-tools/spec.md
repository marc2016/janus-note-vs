# agent-tools Specification

## Purpose

Exposes Janus Note features to VS Code Language Models and Copilot Chat through the `@janus` chat participant and typed VS Code Language Model Tools (`vscode.lm.registerTool`).

## Requirements

### Requirement: Chat Participant Registration
The system SHALL register the `@janus` chat participant in the VS Code Chat panel, delegating prompt processing to the user's active VS Code Language Model (e.g., Copilot, Claude 3.5 Sonnet, GPT-4o).

#### Scenario: User queries @janus with an open note
- **WHEN** user sends `@janus organize my tasks` with `project.md` active
- **THEN** `@janus` receives the request with current note path context and invokes available Janus tools

### Requirement: Language Model Tool for Reading Notes and Companions
The system SHALL provide a tool `janus_read_note_and_companions` that returns the textual content of a Markdown note and the parsed data of any attached companion files.

#### Scenario: Reading existing note and companions
- **WHEN** a Language Model calls `janus_read_note_and_companions` with a valid note path
- **THEN** the tool returns the note's Markdown text along with parsed contents of `<note>.tasks.json` and `<note>.chart.json` if present

### Requirement: Language Model Tool for Mutating Tasks
The system SHALL provide a tool `janus_mutate_tasks` that updates, adds, or checks off tasks in a `*.tasks.json` companion file, enforcing strict schema validation.

#### Scenario: Valid task mutation
- **WHEN** a Language Model calls `janus_mutate_tasks` with valid task item updates
- **THEN** the tool validates the input against the task schema, updates the companion file on disk, and returns a confirmation result

#### Scenario: Invalid schema rejected
- **WHEN** a Language Model passes malformed task payload to `janus_mutate_tasks`
- **THEN** the tool returns a descriptive schema validation error without writing corrupted data to disk

### Requirement: Language Model Tool for Mutating Diagrams
The system SHALL provide a tool `janus_mutate_chart` that creates or updates a `*.chart.json` companion file with a valid diagram definition.

#### Scenario: Updating diagram companion
- **WHEN** a Language Model calls `janus_mutate_chart` with diagram syntax (e.g. Mermaid flowchart code)
- **THEN** the tool writes the validated chart companion file and returns success

### Requirement: Note Modification Diff Preview and Approval
The system SHALL support safe Markdown updates by allowing the agent or tool to present proposed modifications via VS Code's native diff editor before applying changes.

#### Scenario: Proposing changes to Markdown note
- **WHEN** the agent proposes textual updates to `notes.md`
- **THEN** the system generates a diff preview in the editor allowing the user to review and confirm changes prior to writing to the document
