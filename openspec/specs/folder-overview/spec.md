# folder-overview Specification

## Purpose

Provides a central interactive Folder Overview dashboard webview that aggregates notes, task statuses, and diagrams within a selected folder, offering on-demand AI summarization with an option to persist the summary as a Markdown note.

## Requirements

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

### Requirement: Notes Grid and Interactive Opening
The system SHALL display all Markdown notes directly contained within the folder as interactive cards showing note title, snippet preview, and last modified date, allowing users to open any note directly in the Janus Markdown Editor.

#### Scenario: Clicking a note card
- **WHEN** user clicks on a note card in the Folder Overview
- **THEN** system opens that note in the Janus Markdown Editor (`janus.markdownEditor`)

#### Scenario: Quick note creation
- **WHEN** user clicks the `+ Neue Notiz` button in the folder header
- **THEN** system prompts for a note title and creates the new note directly inside the active folder, opening it in the editor

### Requirement: Folder Tasks Summary
The system SHALL aggregate and display the task progress and status overview from the folder's `tasks.json` companion file (when present), providing a button to open the folder task list. Each task in the preview SHALL show its due date and scheduled date when set, using the same German short date format and overdue hints as the task list. The preview is read-only for dates.

#### Scenario: Displaying task status
- **WHEN** the folder contains a `tasks.json` with 2 open tasks and 1 completed task
- **THEN** the Folder Overview renders a task status summary card showing 1/3 completed tasks and lists the open tasks

#### Scenario: Displaying task dates in the preview
- **WHEN** a previewed task has `dueDate: "2026-11-05"` and `scheduledDate: "2026-11-02"` and the current year is 2026
- **THEN** the task row shows a "Geplant" chip with `02.11.` and a "Fällig" chip with `05.11.`

#### Scenario: Overdue task in the preview
- **WHEN** a previewed open task has a due date before today
- **THEN** its due date chip is marked as overdue in the same way as in the task list

#### Scenario: Task without dates
- **WHEN** a previewed task has neither `dueDate` nor `scheduledDate`
- **THEN** the task row shows no date chips and no action for adding a date

#### Scenario: Priority badge
- **WHEN** a previewed task has priority `high`, `medium`, or `low`
- **THEN** the task row shows a priority badge with a distinct style for each of the three values

#### Scenario: Opening task board from overview
- **WHEN** user clicks the `Aufgaben` action in the folder header or `Zu den Aufgaben` on the task card
- **THEN** system opens the folder task list for that folder (`janus.openFolderTasks`), creating the folder's `tasks.json` first if it does not exist

### Requirement: AI Folder Summarization with Subfolder Scope Toggle
The system SHALL provide an AI summarization action in the Folder Overview that reads all Markdown notes within the folder, passes them to the active AI model, and displays a structured summary of key topics, milestones, and open items, with an optional toggle to include notes from subdirectories.

#### Scenario: Generating AI summary for current folder
- **WHEN** user clicks `Zusammenfassung generieren` with the subfolder toggle unchecked
- **THEN** the system analyzes all Markdown notes directly in the folder using the active AI model and displays the generated summary in the card

#### Scenario: Generating AI summary including subfolders
- **WHEN** user checks the `Unterordner einbeziehen` toggle and clicks `Zusammenfassung generieren`
- **THEN** the system recursively discovers all Markdown notes in the folder and its subdirectories and synthesizes their combined contents

#### Scenario: Loading state during generation
- **WHEN** AI summarization is in progress
- **THEN** the button displays an animated loading state and disables repeated clicks until completion

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

### Requirement: Note Graph Access from Root Overview
When the Folder Overview shows the configured notes root, it SHALL offer a `Netzwerk` action in the header that opens the note graph panel. The action SHALL NOT be shown for other folders or for multi-item selections.

#### Scenario: Opening the graph from the root overview
- **WHEN** the Folder Overview shows the notes root and user clicks `Netzwerk`
- **THEN** the system opens or reveals the note graph panel

#### Scenario: Subfolder overview
- **WHEN** the Folder Overview shows `projects/App-Launch`
- **THEN** no `Netzwerk` action is shown
