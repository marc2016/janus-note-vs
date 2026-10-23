# Spec Delta

## MODIFIED Requirements

### Requirement: Central Folder Overview Webview
The system SHALL provide an interactive Webview panel (`janus.folderOverview`) rendered in the main editor area for a selected folder URI or an arbitrary multi-item selection of notes and folders, displaying folder breadcrumbs or selection details, content statistics (note counts, task progress, attached diagrams), and quick action buttons.

#### Scenario: Opening folder overview from sidebar
- **WHEN** user invokes `janus.openFolderOverview` for a folder
- **THEN** system opens or reveals the Folder Overview webview panel titled with the folder's name in the active editor column

#### Scenario: Switching between folders
- **WHEN** user invokes `janus.openFolderOverview` for a different folder while an overview panel is already active
- **THEN** the existing panel updates its content and statistics to reflect the newly selected folder

#### Scenario: Displaying multi-item selection overview
- **WHEN** user selects two or more items (notes or folders) in the sidebar
- **THEN** system opens or reveals the Overview panel titled with the selection count (e.g. `Übersicht: Auswahl (N Elemente)`), showing aggregated notes, task metrics, and summarization actions for the combined selection

### Requirement: Persisting and Copying AI Summaries
The system SHALL allow users to copy the generated AI summary to the clipboard or persist it as a permanent Markdown note (`summary.md` or `uebersicht.md`). When persisting a summary from a multi-item selection, the system SHALL save the note in the common folder if all items share one, or directly within the workspace notes root for cross-folder selections.

#### Scenario: Saving summary as note
- **WHEN** user clicks `Als Notiz speichern` after an AI summary has been generated for a single folder or a selection within the same folder
- **THEN** system creates a Markdown note in that folder containing the summary text and opens the newly created note in the Janus Markdown Editor

#### Scenario: Saving summary as note for cross-folder selection
- **WHEN** user clicks `Als Notiz speichern` after an AI summary has been generated for a multi-item selection spanning different folders
- **THEN** system creates `summary.md` in the workspace notes root and opens the newly created note in the Janus Markdown Editor

#### Scenario: Copying summary to clipboard
- **WHEN** user clicks `Kopieren`
- **THEN** system writes the raw Markdown summary to the system clipboard and shows a confirmation toast
