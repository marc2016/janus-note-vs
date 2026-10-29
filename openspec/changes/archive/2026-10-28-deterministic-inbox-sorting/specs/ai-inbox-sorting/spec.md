## MODIFIED Requirements

### Requirement: Thematic Splitting and Target Classification of Inbox Content
The system SHALL split the actionable content of `<notesRoot>/inbox.md` into blocks deterministically, without the AI model: every Markdown heading of level 2 or deeper starts a new block, and any text before the first such heading forms its own block. If the content contains no such heading, every blank-line-separated paragraph forms a block. The system SHALL then ask the active AI model only to assign blocks, either to an existing note (`append`) or to a new note (`create`) inside one of the three canonical root categories (`meetings`, `projects`, `knowledge`). The model refers to blocks by their number and SHALL NOT be asked to return block content. A block the model does not assign, or assigns to an invalid target, SHALL count as unassigned.

#### Scenario: Proposing append and create targets from inbox.md within canonical root categories
- **WHEN** `inbox.md` contains multiple thoughts on different topics and the user triggers inbox sorting
- **THEN** the system queries the active AI model with the numbered inbox blocks and the existing folders and notes, and returns proposals whose `targetRelativePath` always resides under `meetings/`, `projects/`, or `knowledge/`

#### Scenario: Splitting by headings
- **WHEN** `inbox.md` contains a short intro paragraph followed by three `##` sections
- **THEN** the system sends four blocks to the AI model: the intro paragraph and one block per `##` section, each section block including its heading and all lines up to the next `##`-or-deeper heading

#### Scenario: Splitting by paragraphs when no headings exist
- **WHEN** `inbox.md` contains three paragraphs separated by blank lines and no `##` headings, where one paragraph is a bullet list without blank lines between its items
- **THEN** the system sends three blocks to the AI model, and the bullet list stays one block

#### Scenario: Ignoring invalid or duplicate block references
- **WHEN** the AI model references a block number that does not exist, or assigns the same block twice
- **THEN** the system ignores the unknown reference and keeps only the first assignment of the duplicated block

#### Scenario: Normalizing localized or unprefixed target paths to canonical English root folders
- **WHEN** the AI model proposes a path using a localized root folder name (e.g. `Projekte/App-Launch/app.md`, `Allgemeine Meetings/sync.md`, or `Wissensbasis/llm.md`)
- **THEN** the system normalizes the root segment to its canonical internal English folder name (`projects/App-Launch/app.md`, `meetings/sync.md`, or `knowledge/llm.md`)

#### Scenario: Empty or header-only inbox.md
- **WHEN** `inbox.md` contains no actionable content beyond the `# Inbox` heading or a default welcome paragraph
- **THEN** the system informs the user that there are no entries to sort without calling the AI model or modifying any files

#### Scenario: Ignoring any variant of the default welcome paragraph
- **WHEN** the first paragraph after `# Inbox` starts with the line `Willkommen in deinen Janus Notes!`, regardless of the wording of the following lines in that paragraph
- **THEN** the system excludes that whole paragraph from the blocks sent to the AI model

### Requirement: Selective Cleanup of Sorted Entries in inbox.md
The system SHALL remove only the blocks that were actually written to a target note from `inbox.md`. Unselected blocks, blocks the AI model left unassigned, and blocks that changed while sorting was in progress SHALL stay in `inbox.md` with their original text, under the preserved `# Inbox` header. The system SHALL determine the remaining blocks from the content of `inbox.md` at the time of writing, including unsaved changes in an open editor, not from the content read before the AI request.

#### Scenario: All inbox entries are sorted
- **WHEN** every block was assigned and the user confirms all proposals (or runs in direct mode)
- **THEN** all blocks are written to their target notes and `inbox.md` is reset to `# Inbox\n\n`

#### Scenario: Partial selection in preview mode preserves unselected entries
- **WHEN** `inbox.md` contains two sections and the user deselects the second section in the preview QuickPick
- **THEN** the system sorts only the first section into its target note and keeps the second section intact inside `inbox.md`

#### Scenario: Unassigned blocks are never removed
- **WHEN** `inbox.md` contains three blocks, the AI model assigns only two of them, and the user confirms both proposals
- **THEN** the two assigned blocks are written to their targets, the third block stays in `inbox.md` unchanged, and the user is told that one block remained in the inbox

#### Scenario: Block edited during sorting is skipped
- **WHEN** the user changes the text of a block in `inbox.md` while the AI request or the preview is pending
- **THEN** the system neither writes that block to its target note nor removes it from `inbox.md`, and any text the user added to `inbox.md` in the meantime is kept

## ADDED Requirements

### Requirement: Verbatim Transfer of Inbox Blocks
The system SHALL write each sorted block's original text from `inbox.md` into the target note without any rewording, shortening, or reformatting by the AI model. The only additions SHALL be the headings defined for appending and creating notes.

#### Scenario: Appending a block without its own heading
- **WHEN** a paragraph block without a heading is appended to an existing note, with the AI-proposed title `Heartbeat-Intervall`
- **THEN** the note gains `## Heartbeat-Intervall (YYYY-MM-DD HH:mm)` followed by the paragraph exactly as it appeared in `inbox.md`

#### Scenario: Appending a block that has its own heading
- **WHEN** a block starting with `## Sync-Architektur: WebSocket Heartbeats` is appended to an existing note
- **THEN** the note gains `## Sync-Architektur: WebSocket Heartbeats (YYYY-MM-DD HH:mm)` followed by the remaining block lines exactly as they appeared in `inbox.md`

#### Scenario: Creating a new note from a block
- **WHEN** a block is sorted into a note path that does not exist yet
- **THEN** the new note contains a `#` title heading followed by the block text exactly as it appeared in `inbox.md`

### Requirement: Existing Note Outline as Classification Context
The system SHALL include, for each existing Markdown note in the notes root except `inbox.md`, its relative path, its title (first `#` heading, or the file name), and its `##` headings in the AI request. Timestamp suffixes added by earlier sorting runs SHALL be removed from those headings. To keep the request bounded, the system SHALL limit the number of headings per note and SHALL send only paths for notes beyond a fixed note limit.

#### Scenario: Note headings appear in the request
- **WHEN** `projects/App-Launch/app-launch.md` has the title `App-Launch` and the headings `## Push-Notifications` and `## Beta-Feedback (2026-10-20 09:15)`
- **THEN** the AI request lists that note with the title `App-Launch` and the headings `Push-Notifications` and `Beta-Feedback`

#### Scenario: Large note collections stay bounded
- **WHEN** the notes root contains more notes than the fixed note limit
- **THEN** the AI request includes title and headings for notes up to the limit and only the relative path for the remaining notes
