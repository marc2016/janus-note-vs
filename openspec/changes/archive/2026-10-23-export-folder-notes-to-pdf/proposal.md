# Proposal

## Why

Users organize complex projects and topics across multiple Markdown notes in folders. While exporting a single note to PDF is now supported, users cannot easily export an entire folder or a custom multi-selection of notes into a single cohesive PDF document. Providing an interactive export configuration that allows users to determine the exact note ordering and toggle an optional clickable Table of Contents (TOC) enables the creation of professional documentation booklets, meeting minutes binders, and project summaries.

## What Changes

- Add command `janus.exportFolderToPdf` accessible from folder context menus in the Janus Notes sidebar (`viewItem == janusFolder || viewItem == linkedFolder`), tree view multi-selections, and the Folder Overview dashboard.
- Introduce an interactive Export Configuration Webview modal/panel that lets users:
  - View all candidate Markdown notes discovered in the folder or selection.
  - Interactively reorder notes (via Move Up / Move Down buttons or drag reordering).
  - Toggle an optional Table of Contents (TOC) checkbox (`[x] Inhaltsverzeichnis auf der ersten Seite einbinden`).
  - Customize the document title.
- Extend `PdfExportService` to support compiling multiple notes into a single consolidated print HTML document:
  - When enabled, generate a styled Table of Contents on the first page with clickable internal PDF anchor links (`#note-1`, `#note-2`, etc.) targeting each note.
  - Separate individual notes with clean page-break rules (`page-break-before: always`).
  - Preserve vector Mermaid diagrams, checkboxes, and relative images across all included notes.
- Invoke headless Chromium PDF generation and provide a completion notification with actions to open the PDF or reveal it in the operating system file manager.

## Capabilities

### Modified Capabilities
- `note-pdf-export`: Add requirements for multi-note compendium compilation, interactive export configuration with note reordering, and Table of Contents generation.

## Impact

- **UI / Commands**: New command `janus.exportFolderToPdf`, context menu contributions for folders and multi-selection in `package.json`, and an Export button in the Folder Overview header.
- **Webview**: New lightweight export configuration UI or webview panel (`ExportPdfModal` / `ExportPdfApp`).
- **Services**: Extended `PdfExportService` with multi-note HTML compilation and TOC generation.

