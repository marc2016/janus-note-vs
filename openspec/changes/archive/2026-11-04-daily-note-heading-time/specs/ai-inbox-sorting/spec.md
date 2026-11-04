# Spec Delta

## MODIFIED Requirements

### Requirement: Sorting a Daily Note by Copying and Linking
The system SHALL let the user sort a daily note (as defined in `daily-notes`). It SHALL split the daily note into blocks with the same rules as `inbox.md`, after leaving out the frontmatter and the first `#` title heading, and SHALL assign, preview and write the blocks with the same rules as inbox sorting, including append-only protection and verbatim transfer. Unlike inbox sorting, the system SHALL NOT remove any block from the daily note. Instead, for every block written to a target note, it SHALL insert a line `-> [[<target path relative to the notes root, without .md>]]` directly after that block, separated from the block by a blank line, and SHALL leave all other content of the daily note unchanged, including unsaved changes in an open editor. A section appended from a daily note SHALL use the daily note's date as its heading suffix (`## <Title> (YYYY-MM-DD)`) instead of the sorting date and time. When the block's leading heading ends with a time `(HH:mm)` (as defined in "Creation Time in Daily Note Headings" in `daily-notes`), that time SHALL be replaced by the daily note's date and the time (`## <Title> (YYYY-MM-DD HH:mm)`) instead of adding a second suffix, both when appending to an existing note and when creating a new note. A block that changed while sorting was in progress SHALL be neither written nor linked.

#### Scenario: Copying a block and linking it
- **WHEN** `journal/2026-10-27.md` contains `## Call mit Anna` with the line `Backend auf Postgres umstellen`, the AI model assigns this block to the existing note `projects/App-Launch/architektur.md`, and the user confirms
- **THEN** `architektur.md` gains `## Call mit Anna (2026-10-27)` followed by `Backend auf Postgres umstellen`, and the daily note still contains the block, followed by a blank line and `-> [[projects/App-Launch/architektur]]`

#### Scenario: Block heading with a creation time
- **WHEN** `journal/2026-10-27.md` contains `## Call mit Anna (14:32)` and the block is appended to the existing note `projects/App-Launch/architektur.md`
- **THEN** `architektur.md` gains `## Call mit Anna (2026-10-27 14:32)`, and the heading in the daily note stays `## Call mit Anna (14:32)`

#### Scenario: New note from a block with a creation time
- **WHEN** the block `## Idee: Dunkelmodus (09:15)` of `journal/2026-10-29.md` is sorted into `knowledge/dark-mode.md`, which does not exist yet
- **THEN** the created note contains the heading `## Idee: Dunkelmodus (2026-10-29 09:15)` followed by the block text

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
