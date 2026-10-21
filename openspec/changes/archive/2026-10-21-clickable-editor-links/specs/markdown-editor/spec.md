# Spec Delta

## ADDED Requirements

### Requirement: Interactive Clickable Links in Live Preview
The system SHALL render inline wiki-links (`[[Target]]`, `[[Target|Alias]]`) and markdown links (`[Label](Target)`) as interactive clickable links in the Live Preview editor, allowing users to open linked documents and URLs directly without modifier keys, while concealing syntax delimiters according to the active syntax visibility mode.

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

