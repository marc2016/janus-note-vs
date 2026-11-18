# Spec Delta

## ADDED Requirements

### Requirement: Auto-Save of Notes
The Janus Markdown Editor SHALL save the note automatically according to `janus.autoSave` (`off`, `afterDelay`, `onFocusChange`; default `afterDelay`). `afterDelay` SHALL save once the user has not edited for `janus.autoSaveDelay` ms (default `1000`, minimum `250`) and when focus leaves the editor or its tab is hidden or closed. `onFocusChange` SHALL save only on the latter. `off` SHALL never save automatically. Auto-save SHALL save like the save button.

#### Scenario: Saving after a typing pause
- **WHEN** `janus.autoSave` is `afterDelay` with a delay of `1000`, and the user types `Ende` and then stops typing
- **THEN** about one second after the last key press the file on disk ends with `Ende` and the note is no longer marked as unsaved

#### Scenario: Continuous typing does not save in between
- **WHEN** `janus.autoSave` is `afterDelay` and the user keeps typing with pauses shorter than the delay
- **THEN** the note is not saved until the user pauses for at least the delay

#### Scenario: Saving when switching tabs
- **WHEN** `janus.autoSave` is `afterDelay` or `onFocusChange`, and the user types and immediately switches to another editor tab
- **THEN** the file on disk contains the typed text

#### Scenario: Focus change mode does not save while typing
- **WHEN** `janus.autoSave` is `onFocusChange` and the user types and pauses inside the editor
- **THEN** the note stays marked as unsaved until focus leaves the editor

#### Scenario: Auto-save turned off
- **WHEN** `janus.autoSave` is `off` and the user types and switches to another tab
- **THEN** the note stays unsaved until the user saves it

#### Scenario: Nothing to save
- **WHEN** the note has no unsaved changes and focus leaves the editor
- **THEN** the file is not saved again

#### Scenario: Changing the setting while a note is open
- **WHEN** a note is open and the user changes `janus.autoSave` from `off` to `afterDelay`
- **THEN** the next pause in typing saves the note without reopening it

#### Scenario: Auto-save fails
- **WHEN** an automatic save fails (for example because the file is read-only)
- **THEN** the system shows the same error message as for a failed manual save and the note stays marked as unsaved

## MODIFIED Requirements

### Requirement: Save Button and Reliable Saving
The editor toolbar SHALL start with a save button showing a floppy disk icon. The button SHALL be enabled and visibly highlighted while the note has unsaved changes, meaning the underlying document has unsaved changes or the editor holds edits it has not sent to the document yet, and SHALL be disabled otherwise. Clicking the button, or pressing `Cmd+S` (macOS) / `Ctrl+S` (other platforms) while the editor has focus, SHALL first apply all of the editor's pending edits to the document and then save it, so that the saved file contains everything shown in the editor; the key press SHALL NOT additionally trigger VS Code's own save. When the note is saved in any other way (menu, `Save All`, VS Code auto-save, Janus auto-save), the button SHALL update accordingly.

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

#### Scenario: Button after an automatic save
- **WHEN** Janus auto-save has saved the note
- **THEN** the save button becomes disabled

#### Scenario: Nothing to save
- **WHEN** the note has no unsaved changes
- **THEN** the save button is disabled and clicking it does nothing
