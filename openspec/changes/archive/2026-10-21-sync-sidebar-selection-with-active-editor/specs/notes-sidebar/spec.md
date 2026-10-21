# Spec Delta

## ADDED Requirements

### Requirement: Active Editor Note Selection Synchronization in TreeView
The system SHALL automatically reveal and select the corresponding note item in the Notes TreeView when an editor containing a Markdown note within the configured `janus.notesRoot` becomes active.

#### Scenario: Active editor switched to a note within notes root
- **WHEN** an editor containing a Markdown note located within `janus.notesRoot` becomes active
- **THEN** the Notes TreeView reveals the corresponding note item, expands its ancestor folders, and selects the item without stealing focus from the active editor

#### Scenario: Active editor switched to file outside notes root
- **WHEN** an editor containing a file outside `janus.notesRoot` or a non-markdown file becomes active
- **THEN** the Notes TreeView does not attempt to reveal the file and preserves its existing selection state

#### Scenario: Rapid editor switching
- **WHEN** multiple editor switches occur in rapid succession
- **THEN** the system debounces the tree reveal calls and only reveals the final active note item

