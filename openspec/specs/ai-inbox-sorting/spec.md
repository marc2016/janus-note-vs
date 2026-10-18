# ai-inbox-sorting Specification

## Purpose

Enables AI-assisted thematic splitting and sorting of entries from `inbox.md` into the workspace's canonical top-level categories (`meetings`, `projects`, `knowledge`), enforcing strict append-only guarantees for existing files, configurable preview confirmation vs. direct execution, and selective cleanup of sorted entries in `inbox.md`.

## Requirements

### Requirement: Thematic Splitting and Target Classification of Inbox Content
The system SHALL analyze the content of `<notesRoot>/inbox.md` along with the workspace's existing folder and Markdown note hierarchy using the active AI model, splitting `inbox.md` into thematic sections and proposing either an `append` action to an existing note or a `create` action for a new note inside one of the three canonical root categories (`meetings`, `projects`, `knowledge`).

#### Scenario: Proposing append and create targets from inbox.md within canonical root categories
- **WHEN** `inbox.md` contains multiple thoughts on different topics and the user triggers inbox sorting
- **THEN** the system queries the active AI model with the `inbox.md` content and existing folders/notes, returning structured sorting proposals whose `targetRelativePath` always resides under `meetings/`, `projects/`, or `knowledge/`

#### Scenario: Normalizing localized or unprefixed target paths to canonical English root folders
- **WHEN** the AI model proposes a path using a localized root folder name (e.g. `Projekte/App-Launch/app.md`, `Allgemeine Meetings/sync.md`, or `Wissensbasis/llm.md`)
- **THEN** the system normalizes the root segment to its canonical internal English folder name (`projects/App-Launch/app.md`, `meetings/sync.md`, or `knowledge/llm.md`)

#### Scenario: Empty or header-only inbox.md
- **WHEN** `inbox.md` contains no actionable content beyond the `# Inbox` heading or default welcome text
- **THEN** the system informs the user that there are no entries to sort without calling the AI model or modifying any files

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
The system SHALL remove only the sections that were actually sorted from `inbox.md`, leaving any unselected sections untouched in `inbox.md` and preserving the `# Inbox` header.

#### Scenario: All inbox entries are sorted
- **WHEN** the user confirms all proposed entries (or runs in direct mode)
- **THEN** all sections are written to their target notes and `inbox.md` is reset to `# Inbox\n\n`

#### Scenario: Partial selection in preview mode preserves unselected entries
- **WHEN** `inbox.md` contains two sections and the user deselects the second section in the preview QuickPick
- **THEN** the system sorts only the first section into its target note and keeps the second section intact inside `inbox.md`

