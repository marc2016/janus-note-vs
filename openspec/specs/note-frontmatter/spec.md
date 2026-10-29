# note-frontmatter Specification

## Purpose

Reads a note's YAML frontmatter block so other Janus features can use the note's title, alternative names (aliases), and tags without depending on its file name.

## Requirements

### Requirement: Frontmatter Block Recognition
The system SHALL treat a note as having frontmatter only if its first line (ignoring a byte order mark) is exactly `---` and a later line is exactly `---` or `...`. The lines between them form the frontmatter block. A note without such a block, or whose block cannot be read, SHALL be treated as having no frontmatter, without an error message.

#### Scenario: Note with frontmatter
- **WHEN** a note starts with `---`, then `title: REST-Schnittstelle`, then `---`, then the body
- **THEN** the note's frontmatter title is `REST-Schnittstelle`

#### Scenario: Horizontal rule later in the note
- **WHEN** a note starts with `# Überschrift` and contains a line `---` further down
- **THEN** the note has no frontmatter

#### Scenario: Unclosed block
- **WHEN** a note starts with `---` and contains no closing `---` or `...` line
- **THEN** the note has no frontmatter and no error is shown

### Requirement: Title, Aliases, and Tags Keys
The system SHALL read the keys `title`, `aliases` (or `alias`), and `tags` (or `tag`) from the frontmatter block, case-insensitively. `title` SHALL be a single string. `aliases` and `tags` SHALL accept a single string, an inline list (`[a, "b c"]`), or a block list (lines starting with `- `). For `tags`, a single string SHALL additionally be split at commas and whitespace, and a leading `#` on a tag SHALL be dropped. Values in single or double quotes SHALL be unquoted. Empty values SHALL be ignored. All other keys SHALL be ignored.

#### Scenario: Inline lists
- **WHEN** the frontmatter contains `aliases: [API, "REST API"]` and `tags: [projekt, backend]`
- **THEN** the note's aliases are `API` and `REST API`, and its tags are `projekt` and `backend`

#### Scenario: Block lists
- **WHEN** the frontmatter contains `aliases:` followed by the lines `  - API` and `  - Schnittstelle`
- **THEN** the note's aliases are `API` and `Schnittstelle`

#### Scenario: Single values and singular keys
- **WHEN** the frontmatter contains `alias: API` and `tag: "#projekt, backend"`
- **THEN** the note's aliases are `API` and its tags are `projekt` and `backend`

#### Scenario: Other keys and comments
- **WHEN** the frontmatter contains `date: 2026-10-24`, `# Kommentar` and `status: offen`
- **THEN** no title, alias or tag is read from those lines
