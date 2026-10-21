# Spec Delta

## ADDED Requirements

### Requirement: Multi-Root Scope Resolution
The system SHALL resolve whether any given file URI is located within either the primary `janus.notesRoot` or any directory listed in `janus.includeFolders`, providing methods to retrieve all active root URIs and check whether a URI is within the scope of Janus Notes.

#### Scenario: Checking whether a note in a linked folder is in scope
- **WHEN** a file is located in a directory listed in `janus.includeFolders` (e.g. `docs/architecture.md`)
- **THEN** the system identifies the file as being in scope for Janus Notes

#### Scenario: Retrieving all active notes root URIs
- **WHEN** the system queries all active root URIs for a workspace
- **THEN** the system returns an array containing the `notesRootUri` (if configured) along with the resolved URIs for all paths in `janus.includeFolders`

## MODIFIED Requirements

### Requirement: Configurable Notes Root Directory
The system SHALL support configuring a relative root directory for notes via the `janus.notesRoot` setting and additional linked folders via `janus.includeFolders` in VS Code configuration, defaulting to the workspace root when unset or empty, and update active companion discovery and scoping across all configured directories when the configuration changes.

#### Scenario: Resolving notes root from configuration
- **WHEN** user sets `janus.notesRoot` to `"docs/notes"` in workspace settings
- **THEN** the system resolves the notes root directory as the `docs/notes` subfolder within the active workspace

#### Scenario: Defaulting to workspace root
- **WHEN** `janus.notesRoot` is not set or is an empty string
- **THEN** the system uses the workspace root folder as the default notes root directory

#### Scenario: Setting notes root from Explorer context menu
- **WHEN** user right-clicks a folder in the VS Code File Explorer and clicks "Janus: Als Notizen-Ordner festlegen"
- **THEN** the system writes the folder's relative path to `janus.notesRoot` in the workspace configuration and updates the active notes root

#### Scenario: Resetting notes root to workspace root
- **WHEN** user executes the "Janus: Notizen-Ordner zurücksetzen" command
- **THEN** the system resets `janus.notesRoot` to empty string and re-targets the workspace root

#### Scenario: Live update on configuration change
- **WHEN** user modifies `janus.notesRoot` or `janus.includeFolders` in VS Code settings while the workspace is open
- **THEN** the system updates its internal notes root references and refreshes companion status without requiring an editor restart

#### Scenario: Suggesting dedicated notes folder when non-note files are found
- **WHEN** user selects a folder containing non-note files (files other than Markdown notes and companion files) as notes root
- **THEN** the system offers to create a dedicated subfolder (default `notes/`) and targets that subfolder if confirmed by the user

#### Scenario: Configuration updated with linked folders
- **WHEN** user adds a folder to `janus.includeFolders` in workspace settings
- **THEN** the companion manager registers the new folder, watches for Markdown and companion files within it, and refreshes active scopes

