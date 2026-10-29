# note-linking Specification

## Purpose

Enables automated discovery, bi-directional backlink indexing, and companion status aggregation for interconnected Markdown notes in the workspace.

## Requirements

### Requirement: Wiki-Link and Markdown Link Parsing
The system SHALL parse outgoing references from Markdown document text, recognizing wiki-style links (`[[Note Name]]`, `[[note.md]]`, `[[note#L42]]`, `[[note:42]]`) and standard Markdown links (`[Title](target.md)` or `[Title](target.ts:42)`), preserving optional line number targets specified via colon suffix (`:line`) or hash anchor (`#Lline`).

#### Scenario: Parsing wiki-links in note text
- **WHEN** a note containing `[[Meeting-Notes]]` and `[Design](specs/design.md)` is opened or modified
- **THEN** system extracts both references as outgoing links associated with the source note

#### Scenario: Parsing link with line target
- **WHEN** a note contains `[[src/auth/login.ts:42]]` or `[Login](src/auth/login.ts#L42)`
- **THEN** the system extracts the target path (`src/auth/login.ts`) and identifies target line `42`

### Requirement: Bi-directional Backlink Indexing
The system SHALL identify all notes across the active `notesRoot` and all directories configured in `janus.includeFolders` that reference the current note, record the 1-based source line number where each reference occurs, and expose them as backlinks.

#### Scenario: Discovering backlinks to active note
- **WHEN** Note B contains a link to Note A (`[[Note A]]`) and user opens Note A
- **THEN** system identifies Note B as an incoming backlink for Note A

#### Scenario: Backlink discovery from linked folder to vault note
- **WHEN** a note in a linked folder (e.g. `docs/api.md`) contains a link `[[Meeting-Notes]]` to a note in the vault
- **THEN** opening `Meeting-Notes.md` lists `docs/api.md` as an incoming backlink

#### Scenario: Backlink discovery between two linked folders
- **WHEN** a note in `docs/` references a note in `specs/`
- **THEN** the system exposes the cross-folder reference in the backlinks list

#### Scenario: Recording origin line number of backlink
- **WHEN** Note B references Note A on line 15 (`15: Referenz zu [[Note A]]`)
- **THEN** the backlink entry for Note B includes line number `15` as its origin location

### Requirement: Companion Status and Task Summary Resolution
The system SHALL query the containing folder's `tasks.json` and the active note's `*.chart.json` companion file, determine their existence, and summarize open vs. completed task counts when a folder task list exists.

#### Scenario: Resolving companion files with tasks summary
- **WHEN** user opens `projekt-alpha/alpha.md` whose folder contains `projekt-alpha/tasks.json` with 3 open tasks and 2 completed tasks
- **THEN** system reports companion status with folder task list existence and summary counts (3 open, 5 total)

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

### Requirement: Link Update on Note and Folder Rename
When a note or folder is renamed through Janus, the system SHALL rewrite every wiki-link and Markdown link in the Markdown notes under `janus.notesRoot` and all directories in `janus.includeFolders` that resolved to the renamed note, or to a note inside the renamed folder, before the rename, so that it resolves to the same note afterwards. Links that did not resolve to an affected note before the rename SHALL NOT be changed. Links inside fenced code blocks and inline code spans SHALL NOT be changed.

#### Scenario: Wiki-link to a renamed note
- **WHEN** `projects/plan.md` contains `[[kickoff]]` and `meetings/kickoff.md` is renamed to `meetings/kickoff-2026.md`
- **THEN** `projects/plan.md` contains `[[kickoff-2026]]`

#### Scenario: Markdown link with relative path
- **WHEN** `projects/alpha/plan.md` contains `[Kickoff](../../meetings/kickoff.md)` and `meetings/kickoff.md` is renamed to `meetings/start.md`
- **THEN** the link becomes `[Kickoff](../../meetings/start.md)`

#### Scenario: Folder rename
- **WHEN** `index.md` contains `[[projects/alpha/plan]]` and `[Spec](projects/alpha/spec.md)`, and folder `projects/alpha` is renamed to `projects/apollo`
- **THEN** the links become `[[projects/apollo/plan]]` and `[Spec](projects/apollo/spec.md)`

#### Scenario: Basename wiki-link and folder rename
- **WHEN** `index.md` contains `[[plan]]`, which resolves to `projects/alpha/plan.md`, and folder `projects/alpha` is renamed to `projects/apollo`
- **THEN** `[[plan]]` stays unchanged because it still resolves to the same note

#### Scenario: Link form is preserved
- **WHEN** a note contains `[[kickoff|Erstes Treffen]]`, `[[kickoff#L12]]`, `[[kickoff.md]]` and `[Notes](./kickoff.md#agenda)`, and `kickoff.md` in the same folder is renamed to `start.md`
- **THEN** the links become `[[start|Erstes Treffen]]`, `[[start#L12]]`, `[[start.md]]` and `[Notes](./start.md#agenda)`

#### Scenario: Link labels are not changed
- **WHEN** a note contains `[Kickoff-Notizen](kickoff.md)` and `kickoff.md` is renamed to `start.md`
- **THEN** the link becomes `[Kickoff-Notizen](start.md)`

#### Scenario: Links in code are not changed
- **WHEN** a note contains `[[kickoff]]` in a paragraph, inside a fenced code block, and inside an inline code span, and `kickoff.md` is renamed to `start.md`
- **THEN** only the link in the paragraph is rewritten

#### Scenario: Unrelated note with the same name
- **WHEN** `projects/a/notes.md` and `projects/b/notes.md` both exist, `projects/a/index.md` contains `[Notes](notes.md)`, and `projects/b/notes.md` is renamed to `projects/b/log.md`
- **THEN** the link in `projects/a/index.md` stays unchanged

#### Scenario: Already broken links stay untouched
- **WHEN** a note contains `[[kickof]]`, which does not resolve to any note, and `kickoff.md` is renamed to `start.md`
- **THEN** `[[kickof]]` stays unchanged

#### Scenario: Links inside the renamed note
- **WHEN** `kickoff.md` contains a link to itself, `[[kickoff#L3]]`, and is renamed to `start.md`
- **THEN** the renamed note `start.md` contains `[[start#L3]]`

#### Scenario: Rewritten basename link would become ambiguous
- **WHEN** `index.md` contains `[[draft]]`, which resolves to `projects/draft.md`, `knowledge/plan.md` also exists and is found first by name, and `projects/draft.md` is renamed to `projects/plan.md`
- **THEN** the link is rewritten to a path form (`[[projects/plan]]`) that resolves to the renamed note, not to `knowledge/plan.md`

#### Scenario: Open note with unsaved changes
- **WHEN** a note that links to `kickoff.md` is open in an editor with unsaved changes, and `kickoff.md` is renamed to `start.md`
- **THEN** the link in the open document is updated, and the user's unsaved changes in that document are kept

#### Scenario: Reporting the result
- **WHEN** a rename causes 5 links in 3 notes to be rewritten
- **THEN** the user is informed that 5 links in 3 notes were updated
