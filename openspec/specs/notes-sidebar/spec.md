# notes-sidebar Specification

## Purpose
Provides a dedicated Janus Activity Bar sidebar with a curated TreeView of notes under the configured notes root, interactive companion child items, and onboarding/initialization states.

## Requirements

### Requirement: Activity Bar View Container and Notes TreeView
The system SHALL contribute a custom View Container to the VS Code Activity Bar with a Janus icon, containing a TreeView for navigating Janus notes.

#### Scenario: View container is present in Activity Bar
- **WHEN** the extension activates in a workspace
- **THEN** a Janus View Container icon appears in the Activity Bar with the Notes view available inside it

### Requirement: Notes Directory Scoping in TreeView
The system SHALL display only Markdown notes (`*.md`, `*.markdown`) and subdirectories located within the configured `janus.notesRoot` directory or any directory configured in `janus.includeFolders` in the Notes TreeView. Non-note files and files outside these configured directories SHALL NOT appear in the tree view. Folder items in the tree view SHALL expose an inline action button `$(dashboard)` to open the central Folder Overview.

#### Scenario: Displaying notes and folders
- **WHEN** a user expands the Notes TreeView in an initialized workspace or a workspace with linked folders
- **THEN** only Markdown files and folder hierarchies within `janus.notesRoot` and `janus.includeFolders` are displayed as items

#### Scenario: Hovering on folder item shows inline overview action
- **WHEN** user hovers over a folder item in the Notes TreeView
- **THEN** an inline action button with icon `$(dashboard)` (`janus.openFolderOverview`) is displayed

### Requirement: Companion Files Displayed as Expandable Child Items
The system SHALL discover attached companion files (`*.tasks.json`, `*.chart.json`) for each Markdown note and display them as expandable child items directly beneath that note in the TreeView.

#### Scenario: Note with companions has expandable children
- **WHEN** a note has a corresponding `*.tasks.json` or `*.chart.json` companion file
- **THEN** the note item in the TreeView has a collapsible state and reveals the companion items when expanded

#### Scenario: Clicking companion opens specialized editor
- **WHEN** a user clicks on a companion child item in the TreeView
- **THEN** the corresponding custom editor (Janus Task Board for tasks, Janus Diagram View for chart) is opened for that companion file

### Requirement: Initialization Detection and Welcome Views
The system SHALL track whether the workspace notes collection has been initialized or has linked folders configured. When uninitialized and no linked folders are configured, the system SHALL evaluate whether the target root contains non-note files and display an appropriate Welcome View offering both vault initialization and linking an existing folder.

#### Scenario: Uninitialized root with existing project files
- **WHEN** the workspace is uninitialized, has no linked folders configured, and the target notes directory contains files other than notes and companions
- **THEN** a Welcome View is displayed informing the user that existing project files are present and offering actions to select a separate notes folder, link an existing folder, or initialize in the current folder

#### Scenario: Uninitialized clean or empty root
- **WHEN** the workspace is uninitialized, has no linked folders configured, and the target notes directory contains no conflicting files
- **THEN** a Welcome View is displayed prompting the user to initialize Janus Notes or link an existing folder

### Requirement: Notes Initialization Command
The system SHALL provide a command `janus.initNotesRoot` that bootstraps the notes collection with `inbox.md` and the three default top-level category folders (`meetings`, `projects`, `knowledge`).

#### Scenario: Executing initialization
- **WHEN** the user executes `janus.initNotesRoot`
- **THEN** an `inbox.md` file and the three top-level directories `meetings`, `projects`, and `knowledge` are created if they do not already exist, the workspace is marked as initialized, `inbox.md` is opened in the editor, and the Notes TreeView refreshes to show the note hierarchy

### Requirement: Create Folder Action
The system SHALL allow users to create new subdirectories within the notes collection via the `janus.createFolder` command, accessible from the Notes view title bar and item context menus.

#### Scenario: Creating a folder in selected directory
- **WHEN** user executes `janus.createFolder` with a folder selected in the Notes view
- **THEN** system prompts for a folder name and creates the directory inside the selected folder

#### Scenario: Creating a folder at notes root
- **WHEN** user executes `janus.createFolder` with no item selected
- **THEN** system prompts for a folder name and creates the directory inside `janus.notesRoot`

### Requirement: Create Note Action
The system SHALL allow users to create new Markdown notes within the notes collection via the `janus.createNote` command, accessible from the Notes view title bar and item context menus.

#### Scenario: Creating a new note in selected folder or root
- **WHEN** user executes `janus.createNote` and enters a note name
- **THEN** system creates the Markdown file (appending `.md` if omitted), initializes it with a title heading, reveals it in the Notes view, and opens it directly in the Janus Markdown Editor

### Requirement: Rename Item with Companion Synchronization
The system SHALL allow users to rename folders and notes via the `janus.renameItem` command from the item context menu, keeping attached companion files synchronized.

#### Scenario: Renaming a note with companion files
- **WHEN** user renames a note `alpha.md` to `beta.md`
- **THEN** system renames `alpha.md` to `beta.md` and automatically renames any existing companion files (`alpha.tasks.json` -> `beta.tasks.json`, `alpha.chart.json` -> `beta.chart.json`)

#### Scenario: Renaming a directory
- **WHEN** user renames a folder in the Notes view
- **THEN** system prompts for the new name and renames the directory on disk

### Requirement: Delete Item with Companion Cleanup
The system SHALL allow users to delete folders, notes, and companions via the `janus.deleteItem` command, prompting for confirmation and moving deleted items to the system trash.

#### Scenario: Deleting a note moves attached companions to trash
- **WHEN** user confirms deletion of a note that has attached companion files
- **THEN** system moves the note file and all attached companion files to the system trash and refreshes the Notes view

#### Scenario: Canceling deletion aborts operation
- **WHEN** user cancels the deletion confirmation prompt
- **THEN** system does not delete any files and leaves the collection unchanged

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

### Requirement: Localized Display Names for Default Root Categories
The system SHALL store the three default top-level categories using internal English folder names on disk (`meetings`, `projects`, `knowledge`) while rendering localized display labels in the Notes TreeView based on the active VS Code UI language (`vscode.env.language`).

#### Scenario: Rendering root category folders in German locale
- **WHEN** `vscode.env.language` starts with `de` and the Notes TreeView renders the top-level directories `meetings`, `projects`, and `knowledge`
- **THEN** the TreeView displays their labels as `Allgemeine Meetings`, `Projekte`, and `Wissensbasis` while keeping their underlying filesystem URIs pointing to `meetings`, `projects`, and `knowledge`

#### Scenario: Rendering root category folders in English locale
- **WHEN** `vscode.env.language` starts with `en` (or any non-German locale) and the Notes TreeView renders the top-level directories `meetings`, `projects`, and `knowledge`
- **THEN** the TreeView displays their labels as `General Meetings`, `Projects`, and `Knowledge Base`

### Requirement: Settings Action in Notes Sidebar Header
The system SHALL contribute a settings button (`janus.openSettings` with `$(gear)` icon) in the Notes TreeView title bar (`view/title`) so users can open the Janus Settings Panel with a single click from the sidebar.

#### Scenario: Clicking the gear icon in the Notes sidebar header
- **WHEN** the user clicks the `$(gear)` button in the Notes view title bar
- **THEN** the system executes `janus.openSettings` and opens the Janus Settings Panel in the editor area

### Requirement: Pinned Calendar Entry in Notes TreeView
The system SHALL display a pinned `Kalender` entry at the top of the Notes TreeView (directly below `Alle Aufgaben`) in initialized workspaces that shows the number of upcoming or active calendar entries and opens the Calendar Month View when clicked.

#### Scenario: Displaying calendar entry at root of tree
- **WHEN** the user views the Notes TreeView in an initialized collection
- **THEN** the system renders a top-level item `Kalender` with a calendar icon and a count of scheduled events/deadlines

#### Scenario: Clicking calendar tree item opens Calendar Month View
- **WHEN** the user clicks the `Kalender` item in the Notes TreeView
- **THEN** the system executes `janus.openCalendar` and opens the Calendar Month View webview

### Requirement: Active Editor Note Selection Synchronization in TreeView
The system SHALL automatically reveal and select the corresponding note item in the Notes TreeView when an editor containing a Markdown note within the configured `janus.notesRoot` becomes active.

#### Scenario: Active editor switched to a note within notes root
- **WHEN** an editor containing a Markdown note located within `janus.notesRoot` becomes active
- **THEN** the Notes TreeView reveals the corresponding note item, expands its ancestor folders, and selects the item without stealing focus from the active editor

#### Scenario: Active editor switched to file outside notes root
- **WHEN** an editor containing a file outside `janus.notesRoot` or a non-markdown file becomes active
- **THEN** the Notes TreeView does not attempt to reveal the file and preserves its existing selection state

#### Scenario: Rapid editor switching
- **WHEN** multiple editor switches occur in rapid succession
- **THEN** the system debounces the tree reveal calls and only reveals the final active note item

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

### Requirement: Multi-Selection in Notes TreeView
The system SHALL allow multiple items (notes and folders) to be simultaneously selected in the Notes TreeView (`janus.notesView`) via standard multi-select gestures (`canSelectMany: true`). When two or more items are selected, the system SHALL automatically reveal or update the Overview dashboard displaying the aggregated contents of the active selection.

#### Scenario: Selecting two or more items opens selection overview
- **WHEN** user selects two or more notes or folders in the Notes TreeView using Shift-click or Cmd/Ctrl-click
- **THEN** the system reveals or updates the central Overview dashboard showing the aggregated items of the selection

#### Scenario: Single item selection retains standard behavior
- **WHEN** user selects a single item in the Notes TreeView
- **THEN** the system selects the item in the tree without automatically replacing the active editor with an overview


