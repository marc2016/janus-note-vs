# Spec Delta

## ADDED Requirements

### Requirement: Cursor Movement Over Hidden Syntax
When the live preview hides Markdown syntax (heading markers, bold, italic, strikethrough or inline code markers, or the hidden parts of wiki links and Markdown links), the Janus Markdown Editor SHALL still move the cursor to the visually adjacent line with `ArrowUp` and `ArrowDown`, also when that line starts with hidden syntax. Clicking such a line SHALL place the cursor in that line. Hiding the syntax SHALL NOT change the look of the note, the syntax visibility modes, or when hidden syntax is revealed.

#### Scenario: Moving up into a heading
- **WHEN** syntax visibility mode is `auto`, the cursor is in the line directly below a heading `## Überschrift` and the user presses `ArrowUp`
- **THEN** the cursor moves into the heading line, and the heading marker becomes visible

#### Scenario: Moving up into a line that starts with formatting or a link
- **WHEN** the line above the cursor starts with `**Fett**`, `*kursiv*`, `` `code` ``, `[[kickoff|Kickoff-Notiz]]` or `[Website](https://example.com)` and the user presses `ArrowUp`
- **THEN** the cursor moves into that line, not into the line above it

#### Scenario: Hidden mode
- **WHEN** syntax visibility mode is `hidden` and the user presses `ArrowUp` below a heading
- **THEN** the cursor moves into the heading line and the heading marker stays hidden
