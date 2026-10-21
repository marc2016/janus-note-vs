# note-linking Specification

## Purpose

Enables automated discovery, bi-directional backlink indexing, and companion status aggregation for interconnected Markdown notes in the workspace.

## Requirements

### Requirement: Wiki-Link and Markdown Link Parsing
The system SHALL parse outgoing references from Markdown document text, recognizing wiki-style links (`[[Note Name]]` or `[[note.md]]`) and standard Markdown links (`[Title](target.md)`).

#### Scenario: Parsing wiki-links in note text
- **WHEN** a note containing `[[Meeting-Notes]]` and `[Design](specs/design.md)` is opened or modified
- **THEN** system extracts both references as outgoing links associated with the source note

### Requirement: Bi-directional Backlink Indexing
The system SHALL identify all notes in the active notes root that reference the current note and expose them as backlinks.

#### Scenario: Discovering backlinks to active note
- **WHEN** Note B contains a link to Note A (`[[Note A]]`) and user opens Note A
- **THEN** system identifies Note B as an incoming backlink for Note A

### Requirement: Companion Status and Task Summary Resolution
The system SHALL query the containing folder's `tasks.json` and the active note's `*.chart.json` companion file, determine their existence, and summarize open vs. completed task counts when a folder task list exists.

#### Scenario: Resolving companion files with tasks summary
- **WHEN** user opens `projekt-alpha/alpha.md` whose folder contains `projekt-alpha/tasks.json` with 3 open tasks and 2 completed tasks
- **THEN** system reports companion status with folder task list existence and summary counts (3 open, 5 total)

### Requirement: Inline File and Note Link Autocomplete and Insertion
The system SHALL provide an inline autocompletion dropdown in the Markdown editor triggered by typing `[[`, executing slash commands (`/link`, `/verlinken`, `/note`), invoking the `Cmd+K` / `Ctrl+K` shortcut, or clicking the toolbar link button, allowing users to search and insert wiki-links to Markdown notes and workspace files at the cursor.

#### Scenario: Typing [[ triggers inline file autocompletion
- **WHEN** user types `[[` in the Markdown editor
- **THEN** an inline autocompletion list appears anchored to the cursor showing candidate notes and files with icon indicators

#### Scenario: Executing slash command triggers link completion
- **WHEN** user selects `/link`, `/verlinken`, or `/note` from the slash command menu
- **THEN** the slash command text is replaced with `[[` and the inline file autocompletion list opens immediately

#### Scenario: Using shortcut Cmd+K or Ctrl+K with selection
- **WHEN** user selects text in the editor and presses `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux)
- **THEN** the selected text is wrapped in `[[` and `]]` markers

#### Scenario: Using shortcut Cmd+K or Ctrl+K with collapsed cursor
- **WHEN** user presses `Cmd+K` or `Ctrl+K` with a collapsed cursor without text selection
- **THEN** `[[` is inserted at the cursor and the inline file autocompletion list opens

#### Scenario: Clicking link icon in toolbar
- **WHEN** user clicks the link button (`$(link)`) in the Markdown editor toolbar
- **THEN** `[[` is inserted at the active cursor position and the inline file autocompletion list opens

#### Scenario: Filtering and selecting a file from the list
- **WHEN** user types search terms while the autocompletion is open and selects a candidate item
- **THEN** the query is replaced with the complete wiki-link (e.g. `[[Meeting-Notes]]` or `[[assets/schema.png]]`) and closed with `]]`


