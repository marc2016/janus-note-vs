# Spec Delta

## ADDED Requirements

### Requirement: Note Graph Access from Root Overview
When the Folder Overview shows the configured notes root, it SHALL offer a `Netzwerk` action in the header that opens the note graph panel. The action SHALL NOT be shown for other folders or for multi-item selections.

#### Scenario: Opening the graph from the root overview
- **WHEN** the Folder Overview shows the notes root and user clicks `Netzwerk`
- **THEN** the system opens or reveals the note graph panel

#### Scenario: Subfolder overview
- **WHEN** the Folder Overview shows `projects/App-Launch`
- **THEN** no `Netzwerk` action is shown
