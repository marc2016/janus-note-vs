# Spec Delta

## MODIFIED Requirements

### Requirement: Footer Bar AI Task Generation and Model Selector
The system SHALL render an AI task generation button, an AI inbox sorting button (`Inbox einsortieren`), and an interactive AI model selector badge in the Markdown editor's bottom footer bar (`NotesLinksFooter`), allowing users to view or switch the active AI model, generate folder tasks from the current note, and sort entries from `inbox.md` with visual loading feedback.

#### Scenario: Clicking AI task generation button in the footer bar
- **WHEN** user clicks the `Aufgaben generieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model extracts tasks from the note into `<folder>/tasks.json`, and updates the folder tasks badge once complete

#### Scenario: Clicking AI inbox sorting button in the footer bar
- **WHEN** user clicks the `Inbox einsortieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model analyzes and sorts `inbox.md` entries into target notes and folders, resetting the loading state once complete

#### Scenario: Switching active AI model from the footer bar
- **WHEN** user clicks the active AI model badge in the footer bar
- **THEN** system opens the AI model selection QuickPick and updates the displayed model name in the footer bar upon selection

