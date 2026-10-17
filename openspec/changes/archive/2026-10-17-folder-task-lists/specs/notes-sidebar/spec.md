# Spec Delta

## ADDED Requirements

### Requirement: Pinned Global Tasks Entry
The system SHALL display a pinned entry at the top of the Notes TreeView in initialized workspaces that shows the total number of open tasks across all folders and opens the virtual global task list when clicked.

#### Scenario: Displaying global tasks at root of tree
- **WHEN** user views the Notes TreeView in an initialized collection
- **THEN** system renders a top-level item `📋 Alle Aufgaben` with description of open task count (e.g. `(4 offen)`)

#### Scenario: Clicking global tasks item opens aggregator view
- **WHEN** user clicks `📋 Alle Aufgaben` in the tree view
- **THEN** system opens the virtual global task list view aggregating tasks across all folders

### Requirement: Directory Tasks Tree Item
The system SHALL display a tasks item inside folders that contain a `tasks.json` file, revealing the folder task count and opening the folder checklist when clicked.

#### Scenario: Folder with tasks displays tasks item
- **WHEN** a folder contains `tasks.json` with 3 tasks
- **THEN** expanding the folder displays a `📋 Aufgaben (3)` item that opens the folder's `tasks.json` checklist on click
