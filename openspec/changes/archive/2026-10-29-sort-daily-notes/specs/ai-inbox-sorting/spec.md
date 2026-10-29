# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
