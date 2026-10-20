# Spec Delta

## ADDED Requirements

### Requirement: Settings Action in Notes Sidebar Header
The system SHALL contribute a settings button (`janus.openSettings` with `$(gear)` icon) in the Notes TreeView title bar (`view/title`) so users can open the Janus Settings Panel with a single click from the sidebar.

#### Scenario: Clicking the gear icon in the Notes sidebar header
- **WHEN** the user clicks the `$(gear)` button in the Notes view title bar
- **THEN** the system executes `janus.openSettings` and opens the Janus Settings Panel in the editor area

