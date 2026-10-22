# Spec Delta

## MODIFIED Requirements

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

