# Spec Delta

## MODIFIED Requirements

### Requirement: Notes Directory Scoping in TreeView
The system SHALL display only Markdown notes (`*.md`, `*.markdown`) and subdirectories located within the configured `janus.notesRoot` directory or any directory configured in `janus.includeFolders` in the Notes TreeView. Non-note files and files outside these configured directories SHALL NOT appear in the tree view. Folder items in the tree view SHALL expose an inline action button `$(dashboard)` to open the central Folder Overview.

#### Scenario: Displaying notes and folders
- **WHEN** a user expands the Notes TreeView in an initialized workspace or a workspace with linked folders
- **THEN** only Markdown files and folder hierarchies within `janus.notesRoot` and `janus.includeFolders` are displayed as items

#### Scenario: Hovering on folder item shows inline overview action
- **WHEN** user hovers over a folder item in the Notes TreeView
- **THEN** an inline action button with icon `$(dashboard)` (`janus.openFolderOverview`) is displayed

