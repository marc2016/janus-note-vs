# ai-inbox-sorting Specification

## Purpose

Enables AI-assisted sorting of deterministically split entries from `inbox.md` into the workspace's canonical top-level categories (`meetings`, `projects`, `knowledge`), enforcing strict append-only guarantees for existing files, configurable preview confirmation vs. direct execution, and selective cleanup of sorted entries in `inbox.md`.

## Requirements

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

### Requirement: Strict Append-Only Protection for Existing Notes
The system SHALL never overwrite, truncate, or delete existing content in any target Markdown note when sorting inbox entries; if a target file already exists on disk, the system MUST append the new section to the end of the file preceded by a section heading containing the topic, date, and time (`## <Title> (YYYY-MM-DD HH:mm)`) even if the AI model proposed a `create` action.

#### Scenario: Appending a section to an existing note
- **WHEN** a sorting proposal targets an existing note `projects/App-Launch/app-launch.md`
- **THEN** the system reads the existing file content and appends the sorted section at the end separated by a blank line (`\n\n`) under a `## <Title> (YYYY-MM-DD HH:mm)` heading, preserving 100% of the existing file content byte-for-byte

#### Scenario: Fallback to append when a proposed new note already exists
- **WHEN** a sorting proposal specifies action `create` for `knowledge/ki-prompts.md` but `knowledge/ki-prompts.md` already exists on disk
- **THEN** the system automatically switches the operation to `append` and appends the section to the end of `knowledge/ki-prompts.md` without overwriting existing content

### Requirement: Toggleable Preview Confirmation and Direct Execution Modes
The system SHALL support switching between a preview confirmation mode (`janus.ai.inboxSortConfirm: true` by default) and a direct execution mode (`janus.ai.inboxSortConfirm: false`), allowing users to review and deselect individual sorting proposals before execution or sort immediately.

#### Scenario: Reviewing and selectively confirming proposals in preview mode
- **WHEN** `janus.ai.inboxSortConfirm` is `true` (default) and the user triggers inbox sorting
- **THEN** the system displays a multi-select QuickPick with all proposed targets pre-selected (`[x]`), allowing the user to deselect specific entries or toggle the confirmation mode before applying

#### Scenario: Executing immediately in direct mode
- **WHEN** `janus.ai.inboxSortConfirm` is `false` and the user triggers inbox sorting
- **THEN** the system immediately executes all proposed sorting operations without displaying the confirmation QuickPick

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

### Requirement: Verbatim Transfer of Inbox Blocks
The system SHALL write each sorted block's original text from `inbox.md` into the target note without any rewording, shortening, or reformatting by the AI model. The only changes SHALL be the headings defined for appending and creating notes, and the rewrite of relative link and image paths defined in "Relative Path Rewrite for Moved Inbox Blocks".

#### Scenario: Appending a block without its own heading
- **WHEN** a paragraph block without a heading is appended to an existing note, with the AI-proposed title `Heartbeat-Intervall`
- **THEN** the note gains `## Heartbeat-Intervall (YYYY-MM-DD HH:mm)` followed by the paragraph exactly as it appeared in `inbox.md`

#### Scenario: Appending a block that has its own heading
- **WHEN** a block starting with `## Sync-Architektur: WebSocket Heartbeats` is appended to an existing note
- **THEN** the note gains `## Sync-Architektur: WebSocket Heartbeats (YYYY-MM-DD HH:mm)` followed by the remaining block lines exactly as they appeared in `inbox.md`

#### Scenario: Creating a new note from a block
- **WHEN** a block is sorted into a note path that does not exist yet
- **THEN** the new note contains a `#` title heading followed by the block text exactly as it appeared in `inbox.md`

#### Scenario: Block with relative links keeps everything else verbatim
- **WHEN** a block containing the sentence `Siehe [Plan](knowledge/plan.md) für Details.` is sorted into `projects/app/launch.md` and `knowledge/plan.md` exists
- **THEN** the target note contains `Siehe [Plan](../../knowledge/plan.md) für Details.` and every other character of the block is unchanged

### Requirement: Existing Note Outline as Classification Context
The system SHALL include, for each existing Markdown note in the notes root except `inbox.md` and notes in the `journal` folder, its relative path, its title (first `#` heading, or the file name), and its `##` headings in the AI request. Timestamp suffixes added by earlier sorting runs, with or without a time, SHALL be removed from those headings. To keep the request bounded, the system SHALL limit the number of headings per note and SHALL send only paths for notes beyond a fixed note limit. A proposal whose target lies in the `journal` folder SHALL count as unassigned, both when sorting `inbox.md` and when sorting a daily note.

#### Scenario: Note headings appear in the request
- **WHEN** `projects/App-Launch/app-launch.md` has the title `App-Launch` and the headings `## Push-Notifications`, `## Beta-Feedback (2026-10-20 09:15)` and `## Call mit Anna (2026-10-27)`
- **THEN** the AI request lists that note with the title `App-Launch` and the headings `Push-Notifications`, `Beta-Feedback` and `Call mit Anna`

#### Scenario: Large note collections stay bounded
- **WHEN** the notes root contains more notes than the fixed note limit
- **THEN** the AI request includes title and headings for notes up to the limit and only the relative path for the remaining notes

#### Scenario: Daily notes are not offered as targets
- **WHEN** the notes root contains `journal/2026-10-28.md` and the user sorts `inbox.md`
- **THEN** the AI request does not list `journal/2026-10-28.md`

#### Scenario: Proposal into journal is ignored
- **WHEN** the AI model assigns a block to `journal/2026-10-28.md`
- **THEN** the block counts as unassigned and no file in `journal/` is written by the sort

### Requirement: Sorting a Daily Note by Copying and Linking
The system SHALL let the user sort a daily note (as defined in `daily-notes`). It SHALL split the daily note into blocks with the same rules as `inbox.md`, after leaving out the frontmatter and the first `#` title heading, and SHALL assign, preview and write the blocks with the same rules as inbox sorting, including append-only protection and verbatim transfer. Unlike inbox sorting, the system SHALL NOT remove any block from the daily note. Instead, for every block written to a target note, it SHALL insert a line `-> [[<target path relative to the notes root, without .md>]]` directly after that block, separated from the block by a blank line, and SHALL leave all other content of the daily note unchanged, including unsaved changes in an open editor. A section appended from a daily note SHALL use the daily note's date as its heading suffix (`## <Title> (YYYY-MM-DD)`) instead of the sorting date and time. A block that changed while sorting was in progress SHALL be neither written nor linked.

#### Scenario: Copying a block and linking it
- **WHEN** `journal/2026-10-27.md` contains `## Call mit Anna` with the line `Backend auf Postgres umstellen`, the AI model assigns this block to the existing note `projects/App-Launch/architektur.md`, and the user confirms
- **THEN** `architektur.md` gains `## Call mit Anna (2026-10-27)` followed by `Backend auf Postgres umstellen`, and the daily note still contains the block, followed by a blank line and `-> [[projects/App-Launch/architektur]]`

#### Scenario: Title and frontmatter are not blocks
- **WHEN** a daily note consists of frontmatter `date: 2026-10-29`, the heading `# Donnerstag, 29.10.2026` and two `##` sections, and the user sorts it
- **THEN** the system sends exactly two blocks to the AI model

#### Scenario: Unselected and unassigned blocks stay unlinked
- **WHEN** a daily note has three blocks, the AI model assigns two of them, and the user deselects one of these in the preview
- **THEN** only the confirmed block is copied and gets a link line, and the other two blocks stay unchanged without a link line

#### Scenario: Creating a new note from a daily note block
- **WHEN** a daily note block is sorted into `knowledge/dark-mode.md`, which does not exist yet
- **THEN** the system creates `knowledge/dark-mode.md` with a title heading and the block text, and inserts `-> [[knowledge/dark-mode]]` below the block in the daily note

#### Scenario: Nothing left to sort
- **WHEN** a daily note contains no block, or every block already has a link line
- **THEN** the system informs the user that the daily note has no entries to sort, without calling the AI model or modifying any files

### Requirement: Already Sorted Daily Note Blocks Are Skipped
The system SHALL treat a daily note block that contains a line consisting only of `->` followed by a single wiki link (outside fenced code) as already sorted and SHALL NOT send it to the AI model again. Blocks without such a line SHALL be sorted as usual.

#### Scenario: Sorting the same daily note twice
- **WHEN** the morning blocks of `journal/2026-10-29.md` were sorted and linked, the user adds a new `## Idee` section in the afternoon and sorts the daily note again
- **THEN** the system sends only the `## Idee` block to the AI model, and the morning blocks and their link lines stay unchanged

### Requirement: Relative Path Rewrite for Moved Inbox Blocks
When writing a sorted block into its target note, the system SHALL rewrite the target path of every Markdown link and Markdown image in the block whose target is a relative path that resolves, relative to the folder of `inbox.md`, to an existing file, so that it resolves to the same file relative to the target note's folder. The rewritten path SHALL use `/` as separator and keep the link's label or alt text, optional title, and any `#anchor`, `#L42` or `:42` suffix. The system SHALL NOT change wiki-links, external URLs, anchor-only links, absolute paths, relative paths that do not resolve to an existing file from the folder of `inbox.md`, or links inside fenced code blocks and inline code spans.

#### Scenario: Image in a block moved two levels deeper
- **WHEN** a block contains `![Skizze](assets/skizze.png)`, `assets/skizze.png` exists in the notes root, and the block is sorted into `projects/app/launch.md`
- **THEN** the target note contains `![Skizze](../../assets/skizze.png)`

#### Scenario: Link with anchor and title
- **WHEN** a block contains `[Abschnitt](knowledge/plan.md#ziele "Ziele")`, `knowledge/plan.md` exists, and the block is sorted into `knowledge/notes.md`
- **THEN** the target note contains `[Abschnitt](plan.md#ziele "Ziele")`

#### Scenario: Link with explicit current-folder prefix
- **WHEN** a block contains `[Plan](./knowledge/plan.md)`, `knowledge/plan.md` exists, and the block is sorted into `meetings/sync.md`
- **THEN** the target note contains `[Plan](../knowledge/plan.md)`

#### Scenario: Wiki-links and external links stay unchanged
- **WHEN** a block contains `[[plan]]`, `[[knowledge/plan]]`, `[Docs](https://example.com/docs)` and `[Oben](#oben)`, and the block is sorted into `projects/app/launch.md`
- **THEN** all four links appear in the target note exactly as in `inbox.md`

#### Scenario: Unresolved relative link stays unchanged
- **WHEN** a block contains `[Später](ideen/später.md)` and no file `ideen/später.md` exists in the notes root
- **THEN** the link appears in the target note exactly as in `inbox.md`

#### Scenario: Links in code stay unchanged
- **WHEN** a block contains `[Plan](knowledge/plan.md)` inside a fenced code block and inside an inline code span, and `knowledge/plan.md` exists
- **THEN** both appear in the target note exactly as in `inbox.md`

#### Scenario: Target note in the notes root
- **WHEN** a block containing `[Plan](knowledge/plan.md)` is sorted into a note directly inside the notes root
- **THEN** the link appears in the target note exactly as in `inbox.md`

#### Scenario: Blocks remaining in the inbox are not rewritten
- **WHEN** a block containing `![Skizze](assets/skizze.png)` is not assigned by the AI model and stays in `inbox.md`
- **THEN** `inbox.md` still contains `![Skizze](assets/skizze.png)`
