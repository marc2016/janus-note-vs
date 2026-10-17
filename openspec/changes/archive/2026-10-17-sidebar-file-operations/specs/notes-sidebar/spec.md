# Spec Delta

## ADDED Requirements

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
