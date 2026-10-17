# Spec Delta

## MODIFIED Requirements

### Requirement: Custom Editor for Tasks Companion
The system SHALL register a Custom Text Editor provider for task files (`tasks.json` and legacy `*.tasks.json`) that renders an interactive Task Checklist interface instead of raw JSON.

#### Scenario: Opening a task companion file
- **WHEN** user opens any file matching `tasks.json` or `*.tasks.json`
- **THEN** the system renders the interactive Janus Task Checklist webview

#### Scenario: Toggling a task completion in webview
- **WHEN** user checks a task checkbox in the visual Task Checklist
- **THEN** the system updates the underlying JSON document with the new completion status and marks the document as dirty

#### Scenario: Adding a new task in webview
- **WHEN** user adds a task via the Task Checklist input
- **THEN** the system appends the new task item to the JSON data structure and persists changes according to user save action
