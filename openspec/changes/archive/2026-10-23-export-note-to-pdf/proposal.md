# Proposal

## Why

Janus Note allows users to create structured human-readable Markdown notes enriched with diagrams, task checklists, and companion files. However, users currently have no built-in way to export or share these notes as high-quality, standalone printable documents (PDF) with colleagues, clients, or for archival purposes. Implementing a direct PDF export powered by the local Chromium/Chrome engine provides professional, vector-sharp typography, accurate page breaks, and embedded SVG diagrams without bloat or external cloud services.

## What Changes

- Add a new command `janus.exportNoteToPdf` that exports the active or selected Markdown note to a formatted PDF file.
- Implement `PdfExportService` that parses Markdown via `marked`, resolves relative image links, formats interactive task checklists, renders Mermaid diagrams as inline SVGs, and applies print-optimized CSS rules (`@page`, A4 sizing, margin handling, orphan/widow avoidance, clean paper styling).
- Support automatic discovery of Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Chromium) across macOS, Windows, and Linux, and invoke headless PDF printing (`--headless --print-to-pdf`).
- Add a configurable setting `janus.export.browserPath` for custom browser binaries.
- Add an action button in the Markdown Editor toolbar (`MarkdownToolbar`) to trigger PDF export directly from the active note editor.
- Add context menu entries for Markdown notes in the Janus Notes sidebar (`view/item/context`) and editor title menu (`editor/title`).
- Display a progress indicator during generation and a completion notification offering to open the PDF or reveal it in the operating system file manager.

## Capabilities

### New Capabilities
- `note-pdf-export`: Headless Chromium-based PDF generation pipeline for Markdown notes, including print stylesheet, asset resolution, diagram rendering, and system browser discovery.

### Modified Capabilities
- `markdown-editor`: Add a PDF export button to the fixed formatting toolbar in the Live Preview editor.

## Impact

- **UI / Commands**: New command `janus.exportNoteToPdf`, new toolbar button in `MarkdownToolbar.tsx`, new context menu entries in `package.json`.
- **Services**: New `PdfExportService` and browser locator utility in `src/services/`.
- **Dependencies**: Uses existing `marked` and `mermaid` dependencies. No heavy PDF dependencies (e.g. full Puppeteer) needed; relies on system Chromium CLI.
- **Configuration**: New configuration property `janus.export.browserPath`.

