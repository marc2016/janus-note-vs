# Spec Delta

## MODIFIED Requirements

### Requirement: Footer Bar AI Task Generation and Model Selector
The system SHALL render an AI task generation button (`Aufgaben generieren`) and an AI inbox sorting button (`Inbox einsortieren`) in the Markdown editor's bottom footer bar (`NotesLinksFooter`), allowing users to generate folder tasks from the current note and sort entries from `inbox.md` with visual loading feedback, without rendering an AI model selector dropdown in the footer bar.

#### Scenario: Clicking AI task generation button in the footer bar
- **WHEN** user clicks the `Aufgaben generieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model extracts tasks from the note into `<folder>/tasks.json`, and updates the folder tasks badge once complete

#### Scenario: Clicking AI inbox sorting button in the footer bar
- **WHEN** user clicks the `Inbox einsortieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model analyzes and sorts `inbox.md` entries into target notes and folders, resetting the loading state once complete

#### Scenario: Configuring AI model from error notification opens Settings Panel
- **WHEN** AI task generation or inbox sorting fails and the user clicks `KI-Modell konfigurieren` in the error notification
- **THEN** the system opens the Janus Settings Panel (`janus.openSettings`) so the user can configure the provider, model, or API key

