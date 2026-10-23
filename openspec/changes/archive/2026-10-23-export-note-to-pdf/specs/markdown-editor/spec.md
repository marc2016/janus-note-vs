# Spec Delta

## MODIFIED Requirements

### Requirement: Fixed Formatting Toolbar
The system SHALL provide a single pinned, fixed formatting toolbar with actions for history, headings, inline marks, lists, blockquotes, tables, code blocks, PDF export, and opening the underlying raw source file at the end of the toolbar, without displaying a separate top application header bar or manual theme toggle button. Inline mark actions SHALL expand to surrounding word boundaries when invoked with a collapsed cursor inside an unformatted word.

#### Scenario: Applying inline formatting from toolbar
- **WHEN** user selects text and clicks the Bold button
- **THEN** the editor wraps the selected range in `**` markers and preserves all other document lines unchanged

#### Scenario: Applying inline formatting with collapsed cursor inside a word
- **WHEN** user places the cursor within an unformatted word without an active selection (e.g. `foo|bar`) and clicks the Bold button or presses the formatting shortcut
- **THEN** the editor automatically expands the target to the word boundaries and wraps the entire word in `**` markers (resulting in `**foobar**`)

#### Scenario: Toggling inline formatting off with collapsed cursor inside formatted text
- **WHEN** user places the cursor inside text already formatted with an inline mark (e.g. `**foo|bar**`) and clicks the corresponding format button or shortcut
- **THEN** the editor strips the surrounding mark markers and restores plain unformatted text

#### Scenario: Applying inline formatting with collapsed cursor outside of words
- **WHEN** user triggers an inline formatting action (Bold, Italic, Strikethrough, Code) with the cursor positioned at whitespace or on an empty line
- **THEN** the editor inserts a pair of formatting markers with the cursor placed between them (e.g. `****` with cursor at offset 2)

#### Scenario: Inserting block elements from toolbar
- **WHEN** user clicks the Table or Code Block button
- **THEN** the editor inserts the appropriate Markdown template at the cursor position without reformatting existing lines

#### Scenario: Exporting PDF from toolbar
- **WHEN** user clicks the PDF export button in the formatting toolbar
- **THEN** the system triggers the `janus.exportNoteToPdf` command for the currently edited document

#### Scenario: Opening source file from toolbar
- **WHEN** user clicks the Open Source File button at the end of the formatting toolbar
- **THEN** the system triggers the action to open the source Markdown file in an adjacent editor column

