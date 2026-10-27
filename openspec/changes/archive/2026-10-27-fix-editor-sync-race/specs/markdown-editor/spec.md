# Spec Delta

## ADDED Requirements

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
