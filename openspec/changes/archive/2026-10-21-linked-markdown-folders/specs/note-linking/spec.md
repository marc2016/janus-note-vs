# Spec Delta

## MODIFIED Requirements

### Requirement: Bi-directional Backlink Indexing
The system SHALL identify all notes across the active `notesRoot` and all directories configured in `janus.includeFolders` that reference the current note and expose them as backlinks.

#### Scenario: Discovering backlinks to active note
- **WHEN** Note B contains a link to Note A (`[[Note A]]`) and user opens Note A
- **THEN** system identifies Note B as an incoming backlink for Note A

#### Scenario: Backlink discovery from linked folder to vault note
- **WHEN** a note in a linked folder (e.g. `docs/api.md`) contains a link `[[Meeting-Notes]]` to a note in the vault
- **THEN** opening `Meeting-Notes.md` lists `docs/api.md` as an incoming backlink

#### Scenario: Backlink discovery between two linked folders
- **WHEN** a note in `docs/` references a note in `specs/`
- **THEN** the system exposes the cross-folder reference in the backlinks list

### Requirement: Inline File and Note Link Autocomplete and Insertion
The system SHALL provide an inline autocompletion dropdown in the Markdown editor triggered by typing `[[`, executing slash commands (`/link`, `/verlinken`, `/note`), invoking the `Cmd+K` / `Ctrl+K` shortcut, or clicking the toolbar link button, allowing users to search and insert wiki-links to Markdown notes and workspace files discovered across `janus.notesRoot` and all directories listed in `janus.includeFolders`.

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

#### Scenario: Autocompleting notes from linked folders
- **WHEN** user types `[[` in any Markdown editor
- **THEN** the autocomplete popup includes candidates from both `notesRoot` and all directories in `janus.includeFolders`

#### Scenario: Inserting link to note in linked folder
- **WHEN** user selects a candidate located in a linked folder (e.g. `docs/architecture.md`)
- **THEN** the system inserts the clean target path (e.g. `[[docs/architecture]]`) at the cursor

