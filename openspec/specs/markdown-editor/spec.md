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
The system SHALL provide a single pinned, fixed formatting toolbar with actions for history, headings, inline marks, lists, blockquotes, tables, code blocks, and opening the underlying raw source file at the end of the toolbar, without displaying a separate top application header bar or manual theme toggle button. Inline mark actions SHALL expand to surrounding word boundaries when invoked with a collapsed cursor inside an unformatted word.

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

#### Scenario: Opening source file from toolbar
- **WHEN** user clicks the Open Source File button at the end of the formatting toolbar
- **THEN** the system triggers the action to open the source Markdown file in an adjacent editor column

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

### Requirement: Hierarchical Bullet List Styling
The system SHALL visually style Markdown unordered lists (`- `, `* `, `+ `) with clean typographic bullet points (`•`) and render proportional visual indentation based on nesting depth in the Live Preview editor while preserving exact Markdown syntax in document storage.

#### Scenario: Visual bullet point presentation
- **WHEN** user views an unordered list item (e.g. `- Item 1`) in the Live Preview editor
- **THEN** the marker is rendered visually as a typographic bullet point (`•`) without altering the raw `- ` text in the document

#### Scenario: Nested list hierarchical indentation
- **WHEN** user indents a list item with whitespace (e.g. `  - Child item`)
- **THEN** the editor renders the line with visual indentation padding proportional to its nesting depth

#### Scenario: Coexistence with task checkboxes
- **WHEN** user views or edits a task item starting with `- [ ]` or `- [x]`
- **THEN** the interactive checkbox is rendered and not obscured or duplicated by standard bullet point decorations

#### Scenario: Ordered list indentation
- **WHEN** user indents an ordered list item (e.g. `  1. Step one`)
- **THEN** the line renders with matching hierarchical indentation padding while displaying the numbered prefix

### Requirement: Configurable Markdown Syntax Visibility Modes
The system SHALL provide a 3-way toggle control in the formatting toolbar allowing users to switch between three Markdown syntax visibility modes: `auto` (focus), `visible` (raw), and `hidden` (clean), updating Live Preview decorations dynamically and persisting the active mode across editor reloads.

#### Scenario: Switching syntax visibility modes from toolbar
- **WHEN** user clicks the syntax visibility toggle button in the toolbar
- **THEN** the editor cycles to the next visibility mode (`auto` -> `visible` -> `hidden` -> `auto`) and updates the button icon and tooltip accordingly

#### Scenario: Auto mode reveals syntax markers only when cursor is inside the line or word
- **WHEN** syntax visibility mode is set to `auto`
- **THEN** heading prefixes (`### `) and inline formatting markers (`**`, `*`, `~~`, `` ` ``) are hidden by default and only become visible when the cursor is positioned on that line or within that formatted range

#### Scenario: Visible mode displays all syntax markers permanently
- **WHEN** syntax visibility mode is set to `visible`
- **THEN** all raw Markdown syntax markers remain visible throughout the document regardless of cursor position

#### Scenario: Hidden mode conceals syntax markers regardless of cursor position
- **WHEN** syntax visibility mode is set to `hidden`
- **THEN** raw Markdown syntax markers remain concealed even when the user clicks or navigates the cursor through formatted text

### Requirement: Interactive Visual GFM Table Component
The system SHALL render GitHub Flavored Markdown (GFM) pipe tables as interactive, visual HTML table components with in-cell editing, row and column manipulation handles, and smooth cell keyboard navigation in the Live Preview editor while preserving standard GFM syntax in document storage.

#### Scenario: Visual table component presentation
- **WHEN** user views or types a GFM pipe table in the Live Preview editor
- **THEN** the table is rendered as an interactive visual HTML table component with distinct header and body styling matching active VS Code theme colors

#### Scenario: In-cell editing without raw pipe markers
- **WHEN** user clicks inside a table cell to edit its content
- **THEN** the editor provides in-cell editing directly within the visual cell boundaries without displaying raw markdown pipe or delimiter hyphens

#### Scenario: Table row and column manipulation
- **WHEN** user interacts with the table's grip handles or action buttons
- **THEN** the system allows adding, inserting, moving, duplicating, and deleting rows and columns, updating the underlying Markdown text accordingly

#### Scenario: Keyboard cell navigation
- **WHEN** user presses `Tab`, `Shift-Tab`, or `Enter` inside a table cell
- **THEN** the cursor navigates between adjacent cells or appends a new row when moving past the final cell

#### Scenario: Preserving standard GFM pipe syntax on disk
- **WHEN** user modifies table cells or structure in the visual component and saves the document
- **THEN** the saved file contains standard GFM pipe table text with zero proprietary metadata or formatting degradation

### Requirement: Zero-Diff Persistence
The system SHALL persist document edits by transmitting exact text transactions to the VS Code TextDocument.

#### Scenario: Verifying clean git diff on save
- **WHEN** user edits a single sentence in a 100-line Markdown file and saves
- **THEN** only that single line is modified in the document, with zero extraneous blank lines, backslashes, or trailing whitespace modifications

### Requirement: Links and Companions Footer Bar
The system SHALL render a fixed footer bar at the bottom of the Live Preview editor displaying interactive badges for attached companion files, outgoing links, and incoming backlinks.

#### Scenario: Rendering footer bar with companions and links
- **WHEN** user views a Markdown note in the Janus Markdown Editor
- **THEN** system renders a bottom panel showing companion chips (tasks board with task summary, diagram view), outgoing link chips, and backlink chips

#### Scenario: Visual presentation when no links exist
- **WHEN** user views a note without outgoing links or backlinks
- **THEN** system displays the footer bar with companion status and an option to add links, without cluttering the screen

### Requirement: Interactive Navigation and Link Creation
The system SHALL allow users to click any link or companion chip in the footer bar to open the target in its associated Janus editor, and provide a button to add new links via a quick-pick selector.

#### Scenario: Clicking a linked note badge
- **WHEN** user clicks a linked note badge in the footer bar
- **THEN** system opens the target note in the Janus Markdown Editor

#### Scenario: Clicking an attached task board badge
- **WHEN** user clicks a task board companion badge in the footer bar
- **THEN** system opens the companion file directly in the Janus Task Board editor

#### Scenario: Adding a link via footer button
- **WHEN** user clicks the add link button in the footer bar
- **THEN** system presents a quick-pick list of workspace notes and appends the selected link to the active document

### Requirement: Footer Bar AI Task Generation and Model Selector
The system SHALL render an AI task generation button and an interactive AI model selector badge in the Markdown editor's bottom footer bar (`NotesLinksFooter`), allowing users to view or switch the active AI model and generate folder tasks from the current note with visual loading feedback.

#### Scenario: Clicking AI task generation button in the footer bar
- **WHEN** user clicks the `Aufgaben generieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model extracts tasks from the note into `<folder>/tasks.json`, and updates the folder tasks badge once complete

#### Scenario: Switching active AI model from the footer bar
- **WHEN** user clicks the active AI model badge in the footer bar
- **THEN** system opens the AI model selection QuickPick and updates the displayed model name in the footer bar upon selection

