# Design

## Context

Janus Note allows users to work with human-readable Markdown notes and accompanying data models. Currently, there is no built-in way to export or print notes as standalone PDF files.

See `proposal.md` for motivation and `specs/note-pdf-export/spec.md` for functional requirements.

## Goals / Non-Goals

**Goals:**
- Provide vector-sharp, professional PDF export for Markdown notes using local Chromium-based rendering.
- Preserve document formatting including headings, styled tables, code blocks, bullet/numbered lists, task checkboxes, and embedded images.
- Support rendering Mermaid diagram code blocks into sharp vector graphics in the PDF.
- Keep the extension lightweight by utilizing installed system browsers (Chrome, Edge, Brave, Chromium) rather than bundling a heavy browser binary (such as Puppeteer).
- Expose the export action seamlessly from the Markdown editor toolbar, editor title bar, and sidebar context menus.

**Non-Goals:**
- Bulk export of entire vaults or folders in a single combined PDF (focused on single-note export).
- In-extension PDF reader/annotator (opening/previewing is delegated to the operating system's default PDF application or VS Code's PDF viewer).
- Cloud-based conversion APIs.

## Decisions

### 1. Headless CLI Invocation vs. Bundled Puppeteer
- **Decision:** Invoke the system's existing Chromium binary (Chrome, Edge, Brave, or Chromium) via Node's `child_process.execFile` using headless printing flags (`--headless`, `--disable-gpu`, `--print-to-pdf="<dest>"`).
- **Rationale:** Bundling Puppeteer or Chromium would inflate the extension package size by over 150 MB and introduce architecture-specific binaries. Virtually all target development environments on macOS, Windows, and Linux have Chrome, Edge, or Brave installed.
- **Alternatives Considered:**
  - *Bundled Puppeteer:* High package size, platform-specific binaries, installation failures in corporate environments.
  - *Pure JS PDF generator (jsPDF / pdfmake):* Mediocre CSS support, poor table handling, rasterized blurry text or complex layout bugs.

### 2. Standalone HTML Compiler Independent of Active Editor DOM
- **Decision:** The export pipeline converts Markdown to HTML headlessly via `marked` and a dedicated `MarkdownPdfCompiler` service, rather than scraping the active CodeMirror DOM.
- **Rationale:** Allows exporting notes directly from the Janus Notes sidebar context menu without requiring the note to be open in an active editor tab.

### 3. Rendering Mermaid Diagrams in Headless Chromium
- **Decision:** Include Mermaid JS in the generated HTML template (`<script>mermaid.initialize({ startOnLoad: true });</script>`) so that headless Chromium renders Mermaid code blocks directly into SVG before capturing the PDF.
- **Rationale:** Running Mermaid directly inside Node.js requires JSDOM and virtual canvas polyfills which are brittle. Because Chromium is already rendering the HTML document, it can execute the embedded client script natively.

### 4. Print-First Paper Styling (@page & @media print)
- **Decision:** Apply a dedicated print stylesheet with clean black-on-white typography, 20mm margins, A4 page dimensions, and page-break hygiene (`break-inside: avoid` on tables, code blocks, blockquotes, and diagrams; `break-after: avoid` on headings).
- **Rationale:** Notes should look like professionally formatted documents when printed or shared, regardless of whether the user is running VS Code in Dark Mode.

### 5. Multi-Platform Browser Detection with Configurable Override
- **Decision:** Implement `BrowserLocator` with platform-specific candidate paths for macOS (`/Applications/Google Chrome.app`, `/Applications/Microsoft Edge.app`, etc.), Windows (`ProgramFiles/Google/Chrome`, etc.), and Linux (`google-chrome`, `chromium`, etc.), backed by a VS Code setting `janus.export.browserPath`.
- **Rationale:** Out-of-the-box zero-configuration experience for 99% of users, with an escape hatch for custom or portable browser installations.

## Risks / Trade-offs

- **[Risk]** Host machine has no Chromium browser installed.
  - **Mitigation:** Detect missing browser early and display an actionable notification informing the user that Chrome, Edge, Brave, or Chromium is needed, with a button to open Janus settings to specify a custom browser path.
- **[Risk]** Large local images or complex diagrams slow down headless print capture.
  - **Mitigation:** Run the export with a VS Code progress notification (`vscode.window.withProgress`) and add a timeout safeguard on the browser execution process.
- **[Risk]** Broken relative image paths in Markdown notes.
  - **Mitigation:** Normalize and resolve relative markdown image targets against the note's filesystem directory into absolute `file://` URIs before HTML compilation.

