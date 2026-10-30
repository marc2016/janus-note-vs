# Spec Delta

## ADDED Requirements

### Requirement: Save Button and Reliable Saving
The editor toolbar SHALL start with a save button showing a floppy disk icon. The button SHALL be enabled and visibly highlighted while the note has unsaved changes, meaning the underlying document has unsaved changes or the editor holds edits it has not sent to the document yet, and SHALL be disabled otherwise. Clicking the button, or pressing `Cmd+S` (macOS) / `Ctrl+S` (other platforms) while the editor has focus, SHALL first apply all of the editor's pending edits to the document and then save it, so that the saved file contains everything shown in the editor; the key press SHALL NOT additionally trigger VS Code's own save. When the note is saved in any other way (menu, `Save All`, auto-save), the button SHALL update accordingly.

#### Scenario: Button reflects unsaved changes
- **WHEN** the user opens a saved note and types a character
- **THEN** the save button becomes enabled and highlighted

#### Scenario: Saving with the button
- **WHEN** the note has unsaved changes and the user clicks the save button
- **THEN** the file on disk contains the editor's current text and the button becomes disabled

#### Scenario: Saving right after typing
- **WHEN** the user types `Ende` and presses `Cmd+S` immediately afterwards
- **THEN** the saved file ends with `Ende`, and the note is not marked as unsaved afterwards

#### Scenario: Saving from outside the editor
- **WHEN** the note has unsaved changes and the user chooses `File → Save All`
- **THEN** the save button becomes disabled

#### Scenario: Nothing to save
- **WHEN** the note has no unsaved changes
- **THEN** the save button is disabled and clicking it does nothing
