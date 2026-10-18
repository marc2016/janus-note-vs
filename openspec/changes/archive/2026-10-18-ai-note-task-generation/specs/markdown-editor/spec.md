# Spec Delta

## ADDED Requirements

### Requirement: Footer Bar AI Task Generation and Model Selector
The system SHALL render an AI task generation button and an interactive AI model selector badge in the Markdown editor's bottom footer bar (`NotesLinksFooter`), allowing users to view or switch the active AI model and generate folder tasks from the current note with visual loading feedback.

#### Scenario: Clicking AI task generation button in the footer bar
- **WHEN** user clicks the `Aufgaben generieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model extracts tasks from the note into `<folder>/tasks.json`, and updates the folder tasks badge once complete

#### Scenario: Switching active AI model from the footer bar
- **WHEN** user clicks the active AI model badge in the footer bar
- **THEN** system opens the AI model selection QuickPick and updates the displayed model name in the footer bar upon selection

