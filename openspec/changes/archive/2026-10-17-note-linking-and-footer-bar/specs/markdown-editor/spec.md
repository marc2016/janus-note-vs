# Spec Delta

## ADDED Requirements

### Requirement: Links and Companions Footer Bar
The system SHALL render a fixed footer bar at the bottom of the Live Preview editor displaying interactive badges for attached companion files, outgoing links, and incoming backlinks.

#### Scenario: Rendering footer bar with companions and links
- **WHEN** user views a Markdown note in the Janus Markdown Editor
- **THEN** system renders a bottom panel showing companion chips (tasks board with task summary, diagram view), outgoing link chips, and backlink chips

#### Scenario: Visual presentation when no links exist
- **WHEN** user views a note without outgoing links or backlinks
- **THEN** system displays the footer bar with companion status and an option to add links, without cluttering the screen

### Requirement: Interactive Navigation and Link Creation
The system SHALL allow users to click any link or companion chip in the footer bar to open the target in its associated Janus editor, and provide a button to add new links via a quick-pick selector.

#### Scenario: Clicking a linked note badge
- **WHEN** user clicks a linked note badge in the footer bar
- **THEN** system opens the target note in the Janus Markdown Editor

#### Scenario: Clicking an attached task board badge
- **WHEN** user clicks a task board companion badge in the footer bar
- **THEN** system opens the companion file directly in the Janus Task Board editor

#### Scenario: Adding a link via footer button
- **WHEN** user clicks the add link button in the footer bar
- **THEN** system presents a quick-pick list of workspace notes and appends the selected link to the active document
