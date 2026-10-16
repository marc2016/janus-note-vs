# companion-manager Specification

## Purpose

Manages the automatic discovery, pairing, filesystem watching, and editor navigation between Markdown notes and their machine-operable companion files (`*.tasks.json`, `*.chart.json`).

## Requirements

### Requirement: Automatic Companion Discovery and Pairing
The system SHALL detect companion files in the same directory as any active Markdown note following the naming conventions `<note>.tasks.json` and `<note>.chart.json`.

#### Scenario: Existing companion files detected
- **WHEN** user opens `ideas.md` in the editor and `ideas.tasks.json` exists in the same folder
- **THEN** the system links `ideas.tasks.json` as the companion task file for `ideas.md`

#### Scenario: Note has no companion files
- **WHEN** user opens `ideas.md` and no `<ideas>.*.json` files exist in the same directory
- **THEN** the system marks the document as having no attached companion files

### Requirement: CodeLens Navigation in Markdown Notes
The system SHALL render CodeLens links at the top of active Markdown documents displaying the count of attached companion files and providing quick access actions.

#### Scenario: CodeLens indicator for companion tasks
- **WHEN** user views a Markdown note with an existing `*.tasks.json` companion
- **THEN** the system displays a CodeLens action showing task count (e.g., "$(checklist) Tasks: 3 items") that opens the visual task editor when clicked

#### Scenario: CodeLens indicator to create missing companion
- **WHEN** user views a Markdown note that does not have a `*.tasks.json` companion
- **THEN** the system provides a CodeLens action "+ Add Tasks Companion" to initialize one

### Requirement: Companion File Creation with Valid Schema
The system SHALL initialize new companion files with valid initial JSON schemas when triggered by the user or agent.

#### Scenario: Initializing a tasks companion file
- **WHEN** user invokes command to create a task companion for `project.md`
- **THEN** the system creates `project.tasks.json` with a valid initial task board schema and opens the visual editor

#### Scenario: Initializing a diagram companion file
- **WHEN** user invokes command to create a diagram companion for `project.md`
- **THEN** the system creates `project.chart.json` with a valid initial diagram schema

### Requirement: Filesystem Synchronization and Watcher
The system SHALL monitor companion files on disk and dispatch update notifications to active webviews and CodeLens providers whenever companion files are created, modified, or deleted externally.

#### Scenario: External file modification
- **WHEN** an external process (e.g., git or script) updates `notes.tasks.json` on disk
- **THEN** the system refreshes the visual task editor and updates the CodeLens summary
