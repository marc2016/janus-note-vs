# Spec Delta

## ADDED Requirements

### Requirement: Folder Nodes
The note graph SHALL show each folder that at least one note links to as a folder node, visually distinct from note nodes (shape and icon) and labeled with the folder name. Each linking note SHALL have an edge to the folder node. Folders that no note links to SHALL NOT appear. Clicking a folder node SHALL open the Folder Overview for that folder, and the graph search SHALL also match folder names and paths. The graph SHALL NOT draw edges from a folder to the notes it contains.

#### Scenario: Linked folder in the graph
- **WHEN** `project-plan.md` and `kickoff.md` link to `projects/App-Launch/`
- **THEN** the graph shows a folder node `App-Launch` with edges from `project-plan` and `kickoff`

#### Scenario: Unlinked folders stay hidden
- **WHEN** no note links to `knowledge/`
- **THEN** the graph shows no folder node for `knowledge`

#### Scenario: Opening a folder from the graph
- **WHEN** the user clicks the folder node `App-Launch`
- **THEN** the Folder Overview for `projects/App-Launch` opens

#### Scenario: Searching folders
- **WHEN** the user searches `App-Launch` in the graph
- **THEN** the folder node `App-Launch` is among the matches
