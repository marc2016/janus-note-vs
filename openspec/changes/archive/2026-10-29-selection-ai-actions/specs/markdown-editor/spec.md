# Spec Delta

## ADDED Requirements

### Requirement: AI Actions for Selected Text
When the user selects at least 20 characters of text in the Janus Markdown Editor, the editor SHALL show a small popup next to the selection with the actions `Diagramm erstellen` and `Zusammenfassen`. The popup SHALL appear only after a mouse selection is finished or a keyboard selection stops changing, SHALL NOT appear when the selection lies within a fenced code block, a Mermaid block or a table, and SHALL disappear when the user types, presses `Esc` or clears the selection. `Diagramm erstellen` SHALL insert the placeholder block of `/ki-diagramm` on its own lines after the last selected line and open the Janus chat for it with the selected text as context. `Zusammenfassen` SHALL open the Janus chat with the selected text as context and request a summary. Neither action SHALL change the selected text. When the chat asks the editor to insert text after a selection, the editor SHALL insert it on its own lines after the last line containing the selected text, as one undoable edit, and only if the selected text is still in the note; otherwise it SHALL leave the note unchanged and report that back.

#### Scenario: Popup for a selection
- **WHEN** the user selects a sentence of 60 characters in a paragraph and releases the mouse
- **THEN** a popup with `Diagramm erstellen` and `Zusammenfassen` appears next to the selection

#### Scenario: No popup for short selections or code
- **WHEN** the user selects a single word, or text inside a fenced code block
- **THEN** no popup appears

#### Scenario: Popup disappears
- **WHEN** the popup is shown and the user types a character or presses `Esc`
- **THEN** the popup disappears

#### Scenario: Diagram from a selection
- **WHEN** the user selects lines 12 to 15 and clicks `Diagramm erstellen`
- **THEN** the placeholder block is inserted starting at line 16, the selected text is unchanged, and the Janus chat opens for the new diagram

#### Scenario: Inserting a summary
- **WHEN** the chat asks to insert a summary after the selected text of lines 12 to 15, and the text is unchanged
- **THEN** a callout starting with `> [!NOTE]` and `> **Zusammenfassung:**` is inserted after line 15, and `Cmd+Z` removes it again

#### Scenario: Selected text changed in the meantime
- **WHEN** the selected text was edited before the user clicks `Darunter einfügen`
- **THEN** the note is unchanged and the chat says that the selected text was not found anymore
