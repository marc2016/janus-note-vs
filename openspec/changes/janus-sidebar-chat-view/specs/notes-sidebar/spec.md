# Spec Delta

## MODIFIED Requirements

### Requirement: Activity Bar View Container and Notes TreeView
The system SHALL contribute a custom View Container to the VS Code Activity Bar with a Janus icon, containing both the Notes TreeView (`janus.notesView`) for navigating Janus notes and the Janus AI & Search WebviewView (`janus.chatView`).

#### Scenario: View container is present in Activity Bar
- **WHEN** the extension activates in a workspace
- **THEN** a Janus View Container icon appears in the Activity Bar with the Notes view (`janus.notesView`) and the Janus AI & Search view (`janus.chatView`) available inside it

