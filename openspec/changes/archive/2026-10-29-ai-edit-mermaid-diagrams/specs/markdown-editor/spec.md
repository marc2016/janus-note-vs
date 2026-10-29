# Spec Delta

## ADDED Requirements

### Requirement: AI Editing of Mermaid Diagrams
Every rendered Mermaid block in the Janus Markdown Editor SHALL show a `KI` button next to its `Code`/`Diagramm` toggle. Clicking it SHALL open the Janus chat with this diagram attached as context (as defined in `janus-chat-view`), without changing the note. When the chat asks the editor to replace a diagram's code, the editor SHALL replace only the code between the block's fence lines, as one undoable edit, and only if that code still equals the code the proposal was based on and the new code is valid Mermaid. Otherwise the editor SHALL leave the note unchanged and report the reason (`changed`, `missing` or `invalid`) back to the chat.

#### Scenario: Opening the chat for a diagram
- **WHEN** the user clicks `KI` on the Mermaid block in `project-plan.md` starting at line 54
- **THEN** the Janus chat opens with the context chip `Diagramm · project-plan.md, Zeile 54`, and the note is unchanged

#### Scenario: Applying a proposal
- **WHEN** the chat asks to replace the block's code with valid new Mermaid code and the block is unchanged
- **THEN** the code between the fence lines is replaced, the diagram re-renders, and `Cmd+Z` restores the previous code

#### Scenario: Block changed in the meantime
- **WHEN** the user edited the block's code after the proposal was made and then clicks `Übernehmen`
- **THEN** the note is not changed and the chat reports that the diagram was changed in the meantime

#### Scenario: Invalid proposal
- **WHEN** the proposed code is not valid Mermaid
- **THEN** the note is not changed and the chat reports that the proposal is not a valid diagram
