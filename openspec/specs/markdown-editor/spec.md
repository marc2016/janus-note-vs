# markdown-editor Specification

## Purpose

Provides a non-destructive, in-place Live Preview Markdown editor powered by CodeMirror 6 that preserves exact document whitespace and syntax without AST re-serialization while offering rich toolbars and slash commands.

## Requirements

### Requirement: Non-destructive In-Place Live Preview
The system SHALL provide a Custom Text Editor (`janus.markdownEditor`) for `*.md` files that renders Markdown headings, styles, and elements in-place using visual decorations without altering underlying document bytes or structure.

#### Scenario: Rendering headings in-place
- **WHEN** user views Markdown content containing `# Heading`
- **THEN** the editor renders the heading in large typography and hides the `# ` syntax while the cursor is outside the line

#### Scenario: Revealing raw syntax on focus
- **WHEN** user moves the cursor into a decorated heading or inline formatted word
- **THEN** the editor reveals the raw Markdown markers (`# `, `**`) allowing direct text editing

### Requirement: Fixed Formatting Toolbar
The system SHALL provide a pinned, fixed formatting toolbar with actions for headings, inline marks, lists, blockquotes, and tables that dispatch targeted text insertions.

#### Scenario: Applying inline formatting from toolbar
- **WHEN** user selects text and clicks the Bold button
- **THEN** the editor wraps the selected range in `**` markers and preserves all other document lines unchanged

#### Scenario: Inserting block elements from toolbar
- **WHEN** user clicks the Table or Code Block button
- **THEN** the editor inserts the appropriate Markdown template at the cursor position without reformatting existing lines

### Requirement: Interactive Slash Command Autocomplete
The system SHALL provide an interactive autocomplete popup triggered by typing `/` at line or word boundaries.

#### Scenario: Triggering slash command popup
- **WHEN** user types `/` in the editor
- **THEN** an autocomplete popup appears listing commands such as `/tasks`, `/chart`, `/table`, `/h1`, and `/callout`

#### Scenario: Executing a slash command
- **WHEN** user selects a command (e.g. `/tasks`) and presses Enter
- **THEN** the `/tasks` text is replaced in-place with `- [ ] ` without affecting any other lines in the file

### Requirement: Interactive Task List Checkboxes
The system SHALL render `- [ ]` and `- [x]` as interactive visual checkboxes that toggle state directly in-place.

#### Scenario: Checking a task item
- **WHEN** user clicks on an unchecked task checkbox in the live preview
- **THEN** the editor replaces the single space in `- [ ]` with `x` resulting in `- [x]`, leaving all other document lines completely untouched

### Requirement: Zero-Diff Persistence
The system SHALL persist document edits by transmitting exact text transactions to the VS Code TextDocument.

#### Scenario: Verifying clean git diff on save
- **WHEN** user edits a single sentence in a 100-line Markdown file and saves
- **THEN** only that single line is modified in the document, with zero extraneous blank lines, backslashes, or trailing whitespace modifications
