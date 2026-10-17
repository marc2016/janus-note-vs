# companion-editors Specification

## Purpose

Provides interactive Webview Custom Editors for companion data files (`*.tasks.json` and `*.chart.json`) with bidirectional synchronization, undo/redo support, and rich visual presentation.

## Requirements

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

### Requirement: Custom Editor for Diagram Companion
The system SHALL register a Custom Text Editor provider for `*.chart.json` files that renders an interactive diagram view (e.g. Mermaid flowchart/graph visualization).

#### Scenario: Opening a chart companion file
- **WHEN** user opens any file matching `*.chart.json`
- **THEN** the system renders the visual diagram preview webview

#### Scenario: Invalid JSON in chart file
- **WHEN** user opens a corrupted `*.chart.json` file
- **THEN** the system displays a clear syntax error message in the webview and allows switching to the text editor

### Requirement: Bidirectional Document and Undo Synchronization
The system SHALL coordinate edits between the webview and VS Code's `CustomTextEditorProvider` to ensure full integration with native undo, redo, and dirty document states.

#### Scenario: Native Undo command invoked
- **WHEN** user performs an edit in the webview and subsequently triggers VS Code's Undo command
- **THEN** the system reverts the document to its prior state and updates the webview UI to reflect the reverted data
