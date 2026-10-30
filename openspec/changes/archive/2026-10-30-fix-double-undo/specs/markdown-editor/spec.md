# Spec Delta

## ADDED Requirements

### Requirement: Single Undo History in the Editor
Undo and redo key presses in the Janus Markdown Editor (`Cmd+Z`/`Ctrl+Z`, `Cmd+Shift+Z`/`Ctrl+Shift+Z` and `Ctrl+Y`) SHALL undo or redo exactly one step of the editor's own history, and SHALL NOT additionally undo or redo the underlying TextDocument in VS Code. Undo and redo triggered outside the editor, such as `Edit → Undo` in the menu or the `Undo` command, SHALL change the document once and be shown in the editor as an external change.

#### Scenario: Undoing a deletion
- **WHEN** the user deletes the line `Termin am Freitag` and presses `Cmd+Z`
- **THEN** the line `Termin am Freitag` is back exactly once, and the document contains it exactly once

#### Scenario: Undoing typed text
- **WHEN** the user types `Hallo Welt` into an empty line and presses `Cmd+Z`
- **THEN** the typed text is removed and no other content of the note changes

#### Scenario: Redo
- **WHEN** the user presses `Cmd+Z` and then `Cmd+Shift+Z`
- **THEN** the undone change is restored exactly once

#### Scenario: Undoing an applied AI proposal
- **WHEN** the user applied a diagram proposal from the chat and presses `Cmd+Z` in the editor
- **THEN** the diagram returns to its previous code once, and the rest of the note is unchanged

#### Scenario: Undo from the menu
- **WHEN** the user chooses `Edit → Undo` while the editor is open
- **THEN** the document's last change is undone once and the editor shows the result without duplicating text
