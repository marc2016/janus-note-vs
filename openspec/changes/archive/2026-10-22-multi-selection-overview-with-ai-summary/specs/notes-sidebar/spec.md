# Spec Delta

## ADDED Requirements

### Requirement: Multi-Selection in Notes TreeView
The system SHALL allow multiple items (notes and folders) to be simultaneously selected in the Notes TreeView (`janus.notesView`) via standard multi-select gestures (`canSelectMany: true`). When two or more items are selected, the system SHALL automatically reveal or update the Overview dashboard displaying the aggregated contents of the active selection.

#### Scenario: Selecting two or more items opens selection overview
- **WHEN** user selects two or more notes or folders in the Notes TreeView using Shift-click or Cmd/Ctrl-click
- **THEN** the system reveals or updates the central Overview dashboard showing the aggregated items of the selection

#### Scenario: Single item selection retains standard behavior
- **WHEN** user selects a single item in the Notes TreeView
- **THEN** the system selects the item in the tree without automatically replacing the active editor with an overview

