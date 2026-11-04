# Spec Delta

## MODIFIED Requirements

### Requirement: Non-destructive In-Place Live Preview
The system SHALL provide a Custom Text Editor (`janus.markdownEditor`) for `*.md` files that renders Markdown headings, styles, and elements in-place using visual decorations without altering underlying document bytes or structure.

#### Scenario: Rendering headings in-place
- **WHEN** user views Markdown content containing `# Heading`
- **THEN** the editor renders the heading in large typography and hides the `# ` syntax while the cursor is outside the line

#### Scenario: Revealing raw syntax on focus
- **WHEN** syntax visibility mode is `auto` and the user moves the cursor onto a line containing a heading marker, inline formatting or links
- **THEN** the editor reveals the raw Markdown markers (`# `, `**`, `*`, `~~`, `` ` ``, link delimiters) of that whole line, allowing direct text editing

### Requirement: Configurable Markdown Syntax Visibility Modes
The system SHALL provide a 3-way toggle control in the formatting toolbar allowing users to switch between three Markdown syntax visibility modes: `auto` (focus), `visible` (raw), and `hidden` (clean), updating Live Preview decorations dynamically and persisting the active mode across editor reloads.

#### Scenario: Switching syntax visibility modes from toolbar
- **WHEN** user clicks the syntax visibility toggle button in the toolbar
- **THEN** the editor cycles to the next visibility mode (`auto` -> `visible` -> `hidden` -> `auto`) and updates the button icon and tooltip accordingly

#### Scenario: Auto mode reveals syntax markers only when cursor is inside the line or word
- **WHEN** syntax visibility mode is set to `auto`
- **THEN** heading prefixes (`### `), inline formatting markers (`**`, `*`, `~~`, `` ` ``) and link delimiters are hidden on every line except the line(s) holding the cursor or the ends of the selection, where all of them are visible

#### Scenario: Visible mode displays all syntax markers permanently
- **WHEN** syntax visibility mode is set to `visible`
- **THEN** all raw Markdown syntax markers remain visible throughout the document regardless of cursor position

#### Scenario: Hidden mode conceals syntax markers regardless of cursor position
- **WHEN** syntax visibility mode is set to `hidden`
- **THEN** raw Markdown syntax markers remain concealed even when the user clicks or navigates the cursor through formatted text

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
- **WHEN** syntax visibility mode is set to `auto` and the cursor is on a different line than the link
- **THEN** link syntax delimiters (`[[` and `]]`, or `[` and `](...)`) are hidden and the link is presented cleanly with clickable styling

#### Scenario: Syntax revelation in auto mode when cursor enters link
- **WHEN** syntax visibility mode is set to `auto` and the cursor is on the line containing the link, inside or outside the link text
- **THEN** raw syntax delimiters are revealed allowing direct text editing, and the link text keeps its clickable styling

#### Scenario: Clicking a link to a code file with line specification
- **WHEN** user clicks a link targeting a code or text file with a line number (e.g. `[[src/service.ts:42]]` or `[Logic](src/service.ts#L42)`)
- **THEN** the system opens the file in a VS Code text editor, scrolls to line 42, and selects/highlights line 42

#### Scenario: Clicking a link to a markdown note with line specification
- **WHEN** user clicks a link targeting a markdown note with a line number (e.g. `[[Guide:20]]` or `[[Guide#L20]]`)
- **THEN** the system opens the note in the Janus Markdown Editor, scrolls line 20 into the center of the view, places the cursor at line 20, and highlights the line until the next cursor movement or edit

#### Scenario: Line number exceeding document length
- **WHEN** user clicks a link with a line number that exceeds the total line count of the target file
- **THEN** the system clamps the target line to the final line of the document and highlights the final line

## ADDED Requirements

### Requirement: Stable Layout While Moving the Cursor in Auto Mode
In `auto` syntax visibility mode, moving the cursor or deleting text within a line SHALL NOT reveal or conceal syntax on that line, so the text of the line keeps its horizontal position and the cursor stays where the user sees it. Syntax SHALL only be revealed or concealed when the cursor moves to a different line. Changes of the line's typography caused by the edit itself (for example typing `# ` to turn the line into a heading) are not covered by this requirement.

#### Scenario: Arrow keys along a line with formatting
- **WHEN** syntax visibility mode is `auto`, the cursor is on the line `Ein **fetter** Satz mit [[Link]]` and the user presses `ArrowLeft` or `ArrowRight` repeatedly across the whole line
- **THEN** every press moves the cursor by one character, and no character of the line changes its horizontal position on screen

#### Scenario: Deleting next to formatting
- **WHEN** syntax visibility mode is `auto`, the cursor is directly after `**fett**` on its line and the user presses `Backspace`
- **THEN** the visible `*` before the cursor is deleted, and no other character of the line is revealed, hidden or moved except by that deletion
