# Spec Delta

## ADDED Requirements

### Requirement: Linked Markdown Folders in Notes TreeView
The system SHALL display workspace folders configured in `janus.includeFolders` as top-level folder items in the Notes TreeView alongside or independently of the configured `janus.notesRoot`. In linked folders, the system SHALL display only subdirectories and Markdown files (`*.md`, `*.markdown`) and SHALL NOT display pinned task or calendar entries or enforce Janus Vault conventions (`meetings/`, `projects/`, `knowledge/`, `inbox.md`).

#### Scenario: Displaying linked folders alongside Janus Vault
- **WHEN** a workspace has both an initialized `janus.notesRoot` and configured `janus.includeFolders` (e.g. `["docs", "specs"]`)
- **THEN** the Notes TreeView renders the Janus Vault items (tasks, calendar, vault folders) followed by top-level folder items for `docs` and `specs`

#### Scenario: Displaying linked folders without an initialized Janus Vault
- **WHEN** a workspace has an uninitialized `janus.notesRoot` but has configured `janus.includeFolders`
- **THEN** the Notes TreeView renders the linked folders directly without showing the uninitialized Welcome View banner and without creating any vault folders

#### Scenario: Pure markdown directory tree inside linked folders
- **WHEN** user expands a linked folder in the Notes TreeView
- **THEN** only actual subfolders and Markdown files (`*.md`, `*.markdown`) are displayed, and no synthetic task or calendar nodes are displayed

### Requirement: Add and Remove Linked Folder Commands
The system SHALL provide the command `janus.addLinkedFolder` (accessible via the Notes view title bar and the VS Code Explorer context menu) to add workspace folders to `janus.includeFolders`, and the command `janus.removeLinkedFolder` (accessible via context menu on linked folder items) to remove folders from `janus.includeFolders`.

#### Scenario: Adding a folder via title bar button
- **WHEN** user clicks the `+` button in the Notes view title bar
- **THEN** the system displays a folder picker listing workspace folders and appends the selected folder's relative path to `janus.includeFolders`

#### Scenario: Adding a folder from VS Code Explorer context menu
- **WHEN** user right-clicks a folder in the VS Code Explorer and selects "Zu Janus Notizen hinzufügen"
- **THEN** the system adds the folder's relative path to `janus.includeFolders` in workspace configuration and refreshes the Notes view

#### Scenario: Removing a linked folder via item context menu
- **WHEN** user right-clicks a linked folder in the Notes view and selects "Aus Janus Notizen entfernen"
- **THEN** the system removes that folder path from `janus.includeFolders` and refreshes the Notes view without modifying or deleting files on disk

## MODIFIED Requirements

### Requirement: Notes Directory Scoping in TreeView
The system SHALL display only Markdown notes (`*.md`, `*.markdown`) and subdirectories located within the configured `janus.notesRoot` directory or any directory configured in `janus.includeFolders` in the Notes TreeView. Non-note files and files outside these configured directories SHALL NOT appear in the tree view.

#### Scenario: Displaying notes and folders
- **WHEN** a user expands the Notes TreeView in an initialized workspace or a workspace with linked folders
- **THEN** only Markdown files and folder hierarchies within `janus.notesRoot` and `janus.includeFolders` are displayed as items

### Requirement: Initialization Detection and Welcome Views
The system SHALL track whether the workspace notes collection has been initialized or has linked folders configured. When uninitialized and no linked folders are configured, the system SHALL evaluate whether the target root contains non-note files and display an appropriate Welcome View offering both vault initialization and linking an existing folder.

#### Scenario: Uninitialized root with existing project files
- **WHEN** the workspace is uninitialized, has no linked folders configured, and the target notes directory contains files other than notes and companions
- **THEN** a Welcome View is displayed informing the user that existing project files are present and offering actions to select a separate notes folder, link an existing folder, or initialize in the current folder

#### Scenario: Uninitialized clean or empty root
- **WHEN** the workspace is uninitialized, has no linked folders configured, and the target notes directory contains no conflicting files
- **THEN** a Welcome View is displayed prompting the user to initialize Janus Notes or link an existing folder

