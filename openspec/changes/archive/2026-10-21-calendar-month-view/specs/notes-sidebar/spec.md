# Spec Delta

## ADDED Requirements

### Requirement: Pinned Calendar Entry in Notes TreeView
The system SHALL display a pinned `Kalender` entry at the top of the Notes TreeView (directly below `Alle Aufgaben`) in initialized workspaces that shows the number of upcoming or active calendar entries and opens the Calendar Month View when clicked.

#### Scenario: Displaying calendar entry at root of tree
- **WHEN** the user views the Notes TreeView in an initialized collection
- **THEN** the system renders a top-level item `Kalender` with a calendar icon and a count of scheduled events/deadlines

#### Scenario: Clicking calendar tree item opens Calendar Month View
- **WHEN** the user clicks the `Kalender` item in the Notes TreeView
- **THEN** the system executes `janus.openCalendar` and opens the Calendar Month View webview

