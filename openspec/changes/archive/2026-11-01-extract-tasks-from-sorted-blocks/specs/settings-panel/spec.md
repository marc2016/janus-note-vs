## MODIFIED Requirements

### Requirement: AI Behavior and Workspace Notes Root Controls in Settings Panel
The system SHALL allow users to toggle `janus.ai.inboxSortConfirm` (preview before inbox sorting) and `janus.ai.inboxSortExtractTasks` (extract tasks from sorted blocks), and view, change, or reset the workspace `janus.notesRoot` folder directly from the Settings Panel.

#### Scenario: Toggling inbox sort confirmation in the Settings Panel
- **WHEN** the user toggles the inbox sort preview checkbox in the Settings Panel
- **THEN** the system updates `janus.ai.inboxSortConfirm` in workspace/global configuration immediately

#### Scenario: Toggling task extraction during inbox sorting in the Settings Panel
- **WHEN** the user toggles the checkbox for extracting tasks while sorting in the Settings Panel
- **THEN** the system updates `janus.ai.inboxSortExtractTasks` in workspace/global configuration immediately, and the checkbox shows the stored value when the panel is opened again

#### Scenario: Triggering notes root change or reset from the Settings Panel
- **WHEN** the user clicks the button to change or reset the notes folder in the Settings Panel
- **THEN** the system executes `janus.setNotesRoot` or `janus.resetNotesRoot` and refreshes the displayed notes root path in the Settings Panel
