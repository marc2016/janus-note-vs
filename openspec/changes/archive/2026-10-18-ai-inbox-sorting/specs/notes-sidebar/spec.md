# Spec Delta

## ADDED Requirements

### Requirement: Localized Display Names for Default Root Categories
The system SHALL store the three default top-level categories using internal English folder names on disk (`meetings`, `projects`, `knowledge`) while rendering localized display labels in the Notes TreeView based on the active VS Code UI language (`vscode.env.language`).

#### Scenario: Rendering root category folders in German locale
- **WHEN** `vscode.env.language` starts with `de` and the Notes TreeView renders the top-level directories `meetings`, `projects`, and `knowledge`
- **THEN** the TreeView displays their labels as `Allgemeine Meetings`, `Projekte`, and `Wissensbasis` while keeping their underlying filesystem URIs pointing to `meetings`, `projects`, and `knowledge`

#### Scenario: Rendering root category folders in English locale
- **WHEN** `vscode.env.language` starts with `en` (or any non-German locale) and the Notes TreeView renders the top-level directories `meetings`, `projects`, and `knowledge`
- **THEN** the TreeView displays their labels as `General Meetings`, `Projects`, and `Knowledge Base`

## MODIFIED Requirements

### Requirement: Notes Initialization Command
The system SHALL provide a command `janus.initNotesRoot` that bootstraps the notes collection with `inbox.md` and the three default top-level category folders (`meetings`, `projects`, `knowledge`).

#### Scenario: Executing initialization
- **WHEN** the user executes `janus.initNotesRoot`
- **THEN** an `inbox.md` file and the three top-level directories `meetings`, `projects`, and `knowledge` are created if they do not already exist, the workspace is marked as initialized, `inbox.md` is opened in the editor, and the Notes TreeView refreshes to show the note hierarchy

