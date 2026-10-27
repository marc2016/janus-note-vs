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
The system SHALL visually style Markdown unordered lists (`- `, `* `, `+ `) with clean typographic bullet points (`•`) and render proportional visual indentation based on nesting depth in the Live Preview editor while preserving exact Markdown syntax in document storage. The nesting depth SHALL be determined by the actual list structure (how many list items an item is nested within), not by the raw count of leading whitespace characters.

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

#### Scenario: Nesting depth under ordered list markers
- **WHEN** a list is nested twice under ordered items using CommonMark widths (e.g. `1. A` / `   1. B` / `      1. C`)
- **THEN** the items render at visual nesting levels 0, 1, and 2 respectively

#### Scenario: Nesting depth under wide ordered markers
- **WHEN** a bullet item is nested under a wide ordered marker (e.g. `10. A` followed by `    - B`)
- **THEN** the bullet item renders at visual nesting level 1

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
The system SHALL allow users to click any link or companion chip in the footer bar to open the target in its associated editor, displaying the origin line number on backlink chips (e.g. `Note A :15`) and navigating directly to that line with line highlighting when clicked.

#### Scenario: Clicking a linked note badge
- **WHEN** user clicks a linked note badge in the footer bar
- **THEN** system opens the target note in the Janus Markdown Editor

#### Scenario: Clicking an attached task board badge
- **WHEN** user clicks a task board companion badge in the footer bar
- **THEN** system opens the companion file directly in the Janus Task Board editor

#### Scenario: Adding a link via footer button
- **WHEN** user clicks the add link button in the footer bar
- **THEN** system presents a quick-pick list of workspace notes and appends the selected link to the active document

#### Scenario: Clicking a backlink chip with line number
- **WHEN** user clicks a backlink chip showing an origin line (e.g. `Note A :15`) in the footer bar
- **THEN** the system opens `Note A`, scrolls line `15` into the center of the view, places the cursor at line 15, and highlights line 15 until the next cursor move or edit

### Requirement: Footer Bar AI Task Generation and Model Selector
The system SHALL render an AI task generation button (`Aufgaben generieren`) and an AI inbox sorting button (`Inbox einsortieren`) in the Markdown editor's bottom footer bar (`NotesLinksFooter`), allowing users to generate folder tasks from the current note and sort entries from `inbox.md` with visual loading feedback, without rendering an AI model selector dropdown in the footer bar.

#### Scenario: Clicking AI task generation button in the footer bar
- **WHEN** user clicks the `Aufgaben generieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model extracts tasks from the note into `<folder>/tasks.json`, and updates the folder tasks badge once complete

#### Scenario: Clicking AI inbox sorting button in the footer bar
- **WHEN** user clicks the `Inbox einsortieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model analyzes and sorts `inbox.md` entries into target notes and folders, resetting the loading state once complete

#### Scenario: Configuring AI model from error notification opens Settings Panel
- **WHEN** AI task generation or inbox sorting fails and the user clicks `KI-Modell konfigurieren` in the error notification
- **THEN** the system opens the Janus Settings Panel (`janus.openSettings`) so the user can configure the provider, model, or API key

### Requirement: Date Picker Slash Commands and Toolbar Action
The system SHALL provide interactive slash commands (`/date`, `/datum`, `/today`, `/heute`) and a dedicated calendar toolbar button in the Markdown editor to insert ISO-formatted dates and optional times.

#### Scenario: Triggering DatePicker via /date or /datum slash command
- **WHEN** user types `/date` or `/datum` and confirms the autocomplete command in the Markdown editor
- **THEN** the slash command text is removed and a DatePicker popover appears anchored to the cursor position

#### Scenario: Directly inserting today's date via /today or /heute
- **WHEN** user types `/today` or `/heute` and confirms the autocomplete command
- **THEN** the command text is immediately replaced with the current date in ISO format (`YYYY-MM-DD`) without opening the popover

#### Scenario: Opening DatePicker from the formatting toolbar
- **WHEN** user clicks the calendar button in the Markdown editor toolbar
- **THEN** the DatePicker popover opens for the active cursor position

#### Scenario: Selecting a date and optional time in the popover
- **WHEN** user selects a date (e.g. `2026-10-24`) and optionally enters a time (e.g. `14:00`) in the DatePicker popover and confirms
- **THEN** the formatted ISO string (`2026-10-24` or `2026-10-24 14:00`) is inserted at the cursor position, the popover closes, and keyboard focus returns to the editor

#### Scenario: Canceling the DatePicker popover
- **WHEN** user presses `Escape` or clicks outside the DatePicker popover
- **THEN** the popover closes without modifying editor content and keyboard focus returns to the editor

### Requirement: Interactive Clickable Links in Live Preview
The system SHALL render inline wiki-links and markdown links as interactive clickable links in the Live Preview editor, allowing users to open linked documents and URLs directly without modifier keys, and when links include line number specifications (`:line` or `#Lline`), navigate to and highlight the targeted line in either the Janus Markdown Editor or native VS Code text editor.

#### Scenario: Clicking an existing note link
- **WHEN** user clicks on an inline link to an existing note (e.g. `[[Meeting-Notes]]`) in the Live Preview editor
- **THEN** system opens the target note in the Janus Markdown Editor

#### Scenario: Clicking an external URL
- **WHEN** user clicks on an inline link pointing to an HTTP/HTTPS URL (e.g. `[Documentation](https://example.com)`)
- **THEN** system launches the external URL in the default web browser

#### Scenario: Clicking a non-existent note link prompts for creation
- **WHEN** user clicks on an inline link pointing to a note that does not exist in `notesRoot`
- **THEN** system displays a confirmation notification asking whether to create the note, and creates and opens the note upon confirmation

#### Scenario: Syntax concealing in auto mode when cursor is outside
- **WHEN** syntax visibility mode is set to `auto` and cursor is outside the link
- **THEN** link syntax delimiters (`[[` and `]]`, or `[` and `](...)`) are hidden and the link is presented cleanly with clickable styling

#### Scenario: Syntax revelation in auto mode when cursor enters link
- **WHEN** syntax visibility mode is set to `auto` and user moves the cursor into the link text
- **THEN** raw syntax delimiters are revealed allowing direct text editing

#### Scenario: Clicking a link to a code file with line specification
- **WHEN** user clicks a link targeting a code or text file with a line number (e.g. `[[src/service.ts:42]]` or `[Logic](src/service.ts#L42)`)
- **THEN** the system opens the file in a VS Code text editor, scrolls to line 42, and selects/highlights line 42

#### Scenario: Clicking a link to a markdown note with line specification
- **WHEN** user clicks a link targeting a markdown note with a line number (e.g. `[[Guide:20]]` or `[[Guide#L20]]`)
- **THEN** the system opens the note in the Janus Markdown Editor, scrolls line 20 into the center of the view, places the cursor at line 20, and highlights the line until the next cursor movement or edit

#### Scenario: Line number exceeding document length
- **WHEN** user clicks a link with a line number that exceeds the total line count of the target file
- **THEN** the system clamps the target line to the final line of the document and highlights the final line

### Requirement: Tab Key Indentation
The system SHALL handle `Tab` and `Shift-Tab` inside the Janus Markdown Editor to indent and outdent content following common Markdown editor conventions, keeping keyboard focus in the editor. Inside list items (unordered, ordered, and task items), `Tab` SHALL nest the item one level deeper under its previous sibling and `Shift-Tab` SHALL move it one level up, carrying its child items along. Nested items SHALL be indented with spaces to the content column of the parent list marker as defined by CommonMark (e.g. 2 spaces under `- `, 3 spaces under `1. `, 4 spaces under `10. `). Outside list items, `Tab` and `Shift-Tab` SHALL indent and outdent the affected lines by one indent unit of 2 spaces. Table cell navigation and open autocomplete popups SHALL take precedence over these bindings.

#### Scenario: Nesting a bullet list item
- **WHEN** the cursor is anywhere on the line `- Child` that directly follows the sibling `- Parent` and the user presses `Tab`
- **THEN** the line becomes `  - Child` (indented by 2 spaces) and the cursor stays at the same position relative to the item text

#### Scenario: Nesting an ordered list item uses the parent marker width
- **WHEN** the cursor is on the second item of the list `1. First` / `2. Second` and the user presses `Tab`
- **THEN** the second item is indented by 3 spaces so that it renders as a nested list under `1. First` in any CommonMark/GFM renderer

#### Scenario: Renumbering ordered lists on nesting
- **WHEN** the user presses `Tab` on `2. Second` in the list `1. First` / `2. Second` / `3. Third`
- **THEN** the nested item is renumbered to start a new sub-list at `1.` and the following parent-level item is renumbered from `3.` to `2.`

#### Scenario: Outdenting a nested list item
- **WHEN** the cursor is on the nested item `  - Child` below `- Parent` and the user presses `Shift-Tab`
- **THEN** the line becomes `- Child` at the parent's indentation level and, for ordered lists, the affected list items are renumbered consecutively

#### Scenario: Child items move with their parent
- **WHEN** the user presses `Tab` or `Shift-Tab` on a list item that has nested child items
- **THEN** the item and all of its child items shift by the same amount, preserving their relative nesting

#### Scenario: Indenting multiple selected list items
- **WHEN** the selection spans several list items and the user presses `Tab` or `Shift-Tab`
- **THEN** every list item touched by the selection is indented or outdented by one level and the selection is preserved over the same text

#### Scenario: Task list items are indented like bullets
- **WHEN** the cursor is on the task item `- [ ] Subtask` following the sibling `- [ ] Task` and the user presses `Tab`
- **THEN** the line becomes `  - [ ] Subtask` and its checkbox remains interactive

#### Scenario: No change at the list boundary
- **WHEN** the user presses `Tab` on the first item of a list (no previous sibling to nest under) or `Shift-Tab` on a top-level list item
- **THEN** the document remains unchanged and keyboard focus stays in the editor

#### Scenario: Indenting plain text outside lists
- **WHEN** the cursor is on a line that is not a list item and the user presses `Tab`
- **THEN** the line is indented by 2 spaces, and pressing `Shift-Tab` removes up to 2 spaces of leading indentation

#### Scenario: Only spaces are written
- **WHEN** the user indents any content with `Tab`
- **THEN** the document contains only space characters as inserted indentation and no tab characters

#### Scenario: Table cell navigation keeps priority
- **WHEN** the cursor is inside a table cell and the user presses `Tab` or `Shift-Tab`
- **THEN** the cursor navigates between table cells as before and no indentation is applied

#### Scenario: Autocomplete popup keeps priority
- **WHEN** an autocomplete popup (slash commands or link completion) is open and handles the `Tab` key
- **THEN** the popup's action is performed and no indentation is applied

#### Scenario: Leaving the editor with the keyboard
- **WHEN** the user presses `Esc` and then `Tab`
- **THEN** keyboard focus moves out of the editor without modifying the document

### Requirement: Reliable Typing During Document Synchronization
The system SHALL keep the Janus Markdown Editor and the underlying VS Code TextDocument in sync without losing, reverting, or reordering user input and without moving the cursor because of synchronization. Edits that the editor itself sent SHALL NOT be applied back to the editor. Document states that do not yet include the editor's most recently sent edit SHALL NOT overwrite the editor content. Genuine external changes to the document SHALL be applied as minimal changes and SHALL be combined with any of the user's local edits that have not yet been sent, rather than replacing them.

#### Scenario: Continuing to type while an edit is being saved
- **WHEN** the user types `abc`, pauses long enough for the edit to be sent, and then types `d` before the document change has been processed
- **THEN** the editor contains `abcd` afterwards, and the document contains `abcd` once the next edit has been sent

#### Scenario: Own edits are not echoed back
- **WHEN** the editor sends an edit and the TextDocument changes as a result
- **THEN** the editor content and cursor are not modified by that change

#### Scenario: Stale document state is ignored
- **WHEN** a document update arrives that was produced before the editor's latest sent edit was applied
- **THEN** the editor content remains unchanged

#### Scenario: External change keeps the cursor in place
- **WHEN** the cursor is in paragraph 3 and the document is changed from outside the editor in paragraph 1 (e.g. undo in VS Code or an edit in a text editor)
- **THEN** the editor shows the change in paragraph 1 and the cursor stays at the same text position in paragraph 3

#### Scenario: External change while local edits are unsent
- **WHEN** the user has typed text that has not been sent yet and an external change modifies a different part of the document
- **THEN** the editor shows both the user's typed text and the external change, and the next sent edit contains both

#### Scenario: Pending edits are saved when leaving the editor
- **WHEN** the user types and then immediately switches to another editor tab or focus leaves the editor before the debounce interval has elapsed
- **THEN** the typed text is sent to the document without waiting for the interval and is not lost
