# Spec Delta

## ADDED Requirements

### Requirement: Export Folder or Multi-Selection to PDF Command
The system SHALL provide a command `janus.exportFolderToPdf` that allows users to export all Markdown notes within a folder (including subdirectories) or an active multi-selection of notes into a single cohesive PDF document.

#### Scenario: Invoking from sidebar folder context menu
- **WHEN** user right-clicks a folder in the Janus Notes sidebar and selects "Ordner als PDF exportieren..."
- **THEN** the system discovers all Markdown notes in the folder hierarchy and opens the export configuration interface

#### Scenario: Invoking from sidebar multi-selection context menu
- **WHEN** user selects two or more notes in the Janus Notes sidebar, right-clicks, and selects "Ausgewählte Notizen als PDF exportieren..."
- **THEN** the system opens the export configuration interface populated with the selected notes

#### Scenario: Invoking from Folder Overview dashboard
- **WHEN** user clicks the "Als PDF exportieren" action button in the Folder Overview dashboard header
- **THEN** the system discovers all Markdown notes in that folder and opens the export configuration interface

### Requirement: Interactive Compendium Export Configuration
The system SHALL display an interactive configuration interface that presents the discovered list of notes, allowing the user to reorder notes (via Move Up / Move Down controls), toggle Table of Contents generation via checkbox, and confirm or cancel the export.

#### Scenario: Reordering candidate notes
- **WHEN** user changes the sequence of notes using the Move Up or Move Down controls in the configuration interface
- **THEN** the revised ordering is preserved and used as the sequence of notes in the compiled PDF

#### Scenario: Toggling Table of Contents
- **WHEN** user toggles the Table of Contents checkbox in the configuration interface
- **THEN** the configuration state updates to reflect whether the generated document will include a leading Table of Contents

#### Scenario: Confirming export configuration
- **WHEN** user clicks the export button in the configuration interface
- **THEN** the system prompts the user with a file save dialog proposing a default PDF name based on the folder or collection title

#### Scenario: Cancelling configuration
- **WHEN** user cancels or closes the configuration interface
- **THEN** the system closes the configuration view without generating files or showing errors

### Requirement: Multi-Note Compendium HTML & TOC Compilation
The system SHALL compile multiple ordered notes into a consolidated print HTML document. When enabled, a Table of Contents page SHALL be generated at the beginning of the document with clickable internal anchor links targeting each note. Each subsequent note SHALL begin on a new page via CSS page-break rules.

#### Scenario: Compiling with Table of Contents
- **WHEN** multiple notes are compiled with Table of Contents enabled
- **THEN** the output HTML contains a leading TOC section listing all note titles with anchor links (`href="#note-X"`), followed by each note wrapped in a dedicated section with corresponding id (`id="note-X"`)

#### Scenario: Compiling without Table of Contents
- **WHEN** multiple notes are compiled with Table of Contents disabled
- **THEN** the output HTML starts directly with the first note without a leading TOC section

#### Scenario: Page separation between notes
- **WHEN** multiple notes are compiled into the HTML document
- **THEN** each note after the first note (or after the TOC) enforces `page-break-before: always` to ensure clean pagination

