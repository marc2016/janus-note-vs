# Spec Delta

## Purpose

Provides high-fidelity, vector-sharp PDF export for Markdown notes using local Chromium-based browser rendering with print-optimized styling, inline SVG Mermaid diagrams, and interactive task checklists.

## ADDED Requirements

### Requirement: Export Note to PDF Command
The system SHALL provide a command `janus.exportNoteToPdf` that exports the active Markdown note or a note selected from the Notes sidebar to a PDF file on the local file system.

#### Scenario: Exporting active note from command palette or editor
- **WHEN** user executes `janus.exportNoteToPdf` while an editor with a Markdown note is active
- **THEN** the system prompts the user with a file save dialog proposing the note's base name with `.pdf` extension

#### Scenario: Exporting note from Notes sidebar context menu
- **WHEN** user right-clicks a Markdown note in the Janus Notes sidebar and selects "Als PDF exportieren..."
- **THEN** the system prompts the user with a file save dialog proposing the selected note's base name with `.pdf` extension

#### Scenario: User cancels save dialog
- **WHEN** user cancels the file save dialog
- **THEN** the system aborts the export operation without generating files or showing errors

### Requirement: Chromium-Based Headless PDF Rendering
The system SHALL discover an installed Chromium-compatible browser binary (Google Chrome, Microsoft Edge, Brave, or Chromium) or use a configured custom browser binary path to render the HTML document into a PDF in headless mode.

#### Scenario: Automatic browser discovery
- **WHEN** the export command executes and no custom `janus.export.browserPath` is set
- **THEN** the system searches standard platform installation locations for Chrome, Edge, Brave, or Chromium on macOS, Windows, and Linux

#### Scenario: Custom browser path configuration
- **WHEN** user configures `janus.export.browserPath` with a valid executable path
- **THEN** the system uses the configured executable to generate the PDF

#### Scenario: Browser executable not found
- **WHEN** no compatible browser executable is found on the host system and no valid custom path is set
- **THEN** the system displays an actionable error message informing the user that a Chromium-based browser is required or to configure `janus.export.browserPath`

### Requirement: Print-Optimized Styling and Layout
The system SHALL compile the note's Markdown into a standalone HTML document incorporating a clean, high-contrast print stylesheet (`@page { size: A4; margin: 20mm; }`) that enforces page-break hygiene (`break-inside: avoid` on tables, code blocks, blockquotes, and diagrams; `break-after: avoid` on headings) and clean black-on-white typography regardless of the current editor color theme.

#### Scenario: Print layout hygiene
- **WHEN** the document contains multi-line code blocks, tables, or headings near page boundaries
- **THEN** headings remain attached to their subsequent content block without orphan lines at the bottom of a page, and code blocks avoid being split across pages where possible

### Requirement: Diagram and Asset Resolution
The system SHALL convert relative image paths in the Markdown note to absolute `file://` URIs, render task checkboxes (`- [ ]`, `- [x]`) as clean vector checkboxes, and render Mermaid diagram code blocks into inline SVG graphics within the exported HTML before PDF generation.

#### Scenario: Rendering Mermaid diagram blocks
- **WHEN** the Markdown document contains ````mermaid` code blocks
- **THEN** the system renders each block into an inline SVG diagram in the exported PDF rather than raw text

#### Scenario: Resolving relative image paths
- **WHEN** the Markdown document contains relative image links (e.g. `![](./assets/diagram.png)`)
- **THEN** the system resolves the path relative to the note's parent folder so the image renders properly in the generated PDF

### Requirement: Completion Notification and Actions
The system SHALL display a progress notification during PDF generation and, upon successful completion, show an informational notification allowing the user to open the exported PDF directly or reveal it in the operating system file manager.

#### Scenario: Successful PDF export completion
- **WHEN** the headless PDF generation completes successfully
- **THEN** the system displays a notification "PDF erfolgreich exportiert" with actions "Öffnen" and "Im Dateimanager anzeigen"

