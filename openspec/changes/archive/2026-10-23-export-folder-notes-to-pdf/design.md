# Design

## Context

Janus Note supports exporting individual notes to PDF via headless Chromium rendering. This design extends the system to export multiple notes or entire folders into a unified PDF compendium with a configurable Table of Contents (TOC) and custom note ordering.

See `proposal.md` for user motivation and `specs/note-pdf-export/spec.md` for the functional requirements.

## Goals / Non-Goals

**Goals:**
- Allow exporting an entire folder or a multi-selection of notes into a single cohesive, high-quality PDF document.
- Provide an interactive configuration Webview where users can reorder notes (via Move Up / Down buttons or drag-and-drop), toggle an optional Table of Contents on the first page, and adjust the title.
- Generate clickable internal PDF anchor links from the Table of Contents directly to the respective notes.
- Separate individual notes with clean page-break rules (`page-break-before: always`).
- Integrate export triggers cleanly in sidebar folder context menus, tree multi-selection, and the Folder Overview dashboard.

**Non-Goals:**
- Batch exporting notes into separate individual PDF files (the user requested a consolidated single compendium PDF).
- Custom font uploading (uses clean system typography matching the single-note export).

## Decisions

### 1. Interactive Webview Dialog for Order & TOC Configuration
- **Decision:** Implement a dedicated Webview panel (`ExportCompendiumViewProvider` / `exportPdfDialog`) instead of a multi-step VS Code QuickPick.
- **Rationale:** VS Code QuickPick does not natively support reordering items (drag-and-drop or moving items up/down). A lightweight webview panel built with React and Tailwind provides an immediate, visual interface for reordering notes and toggling options like the Table of Contents checkbox.
- **Alternatives Considered:**
  - *Multi-step QuickPick:* Frustrating UX because items cannot be re-ordered in-place without repeatedly opening sub-prompts.

### 2. Multi-Note HTML Compilation & Anchor Navigation
- **Decision:** Introduce `compileMultiNoteToPrintHtml()` in `PdfExportService`:
  - When `includeToc: true`, renders a styled Table of Contents on the first page (`<div class="toc-page">...</div>`) followed by a hard page break (`page-break-after: always`).
  - Table of Contents entries use internal anchor links (`<a href="#note-${index}">${title}</a>`).
  - Each note is wrapped in a `<section id="note-${index}" class="note-section">` with `page-break-before: always` (except the very first element if no TOC is present).
  - Headings inside each note are kept relative, and the note's title is clearly styled as a major section header.
  - Image paths are resolved per note relative to each note's respective parent directory.
  - Mermaid diagrams across all notes are initialized once via a shared client script.

### 3. Note Discovery & Multi-Selection Normalization
- **Decision:** Implement a helper function `collectMarkdownNotesFromSelection(items: (NotesTreeItem | vscode.Uri)[])`:
  - If a single folder is targeted, recursively scan all Markdown notes in that folder (using `findMarkdownNotesInRoot`).
  - If multiple items are selected (which may include individual notes and/or subfolders), expand any folders recursively, deduplicate files by URI, and present the resulting list to the user in the configuration view.

### 4. Headless Chromium Re-use
- **Decision:** Reuse the existing `findChromiumBrowser` and headless `--print-to-pdf` pipeline already established in `PdfExportService`.
- **Rationale:** Keeps the architecture consistent and avoids duplicating browser discovery, temporary file management, and timeout handling.

## Risks / Trade-offs

- **[Risk]** Large compendiums with dozens of notes and many Mermaid diagrams may take longer to compile and print.
  - **Mitigation:** Show a progress notification (`vscode.window.withProgress`) with status messages ("Kompiliere HTML...", "Generiere PDF via Chromium...") and set an adaptive timeout based on note count.
- **[Risk]** Deeply nested relative image paths in different folders.
  - **Mitigation:** The compiler resolves image URLs for each note independently against that note's own directory into absolute `file://` URIs before stitching the HTML together.

