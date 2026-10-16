# Spec Delta

## ADDED Requirements

### Requirement: Interactive Visual GFM Table Component
The system SHALL render GitHub Flavored Markdown (GFM) pipe tables as interactive, visual HTML table components with in-cell editing, row and column manipulation handles, and smooth cell keyboard navigation in the Live Preview editor while preserving standard GFM syntax in document storage.

#### Scenario: Visual table component presentation
- **WHEN** user views or types a GFM pipe table in the Live Preview editor
- **THEN** the table is rendered as an interactive visual HTML table component with distinct header and body styling matching active VS Code theme colors

#### Scenario: In-cell editing without raw pipe markers
- **WHEN** user clicks inside a table cell to edit its content
- **THEN** the editor provides in-cell editing directly within the visual cell boundaries without displaying raw markdown pipe or delimiter hyphens

#### Scenario: Table row and column manipulation
- **WHEN** user interacts with the table's grip handles or action buttons
- **THEN** the system allows adding, inserting, moving, duplicating, and deleting rows and columns, updating the underlying Markdown text accordingly

#### Scenario: Keyboard cell navigation
- **WHEN** user presses `Tab`, `Shift-Tab`, or `Enter` inside a table cell
- **THEN** the cursor navigates between adjacent cells or appends a new row when moving past the final cell

#### Scenario: Preserving standard GFM pipe syntax on disk
- **WHEN** user modifies table cells or structure in the visual component and saves the document
- **THEN** the saved file contains standard GFM pipe table text with zero proprietary metadata or formatting degradation
