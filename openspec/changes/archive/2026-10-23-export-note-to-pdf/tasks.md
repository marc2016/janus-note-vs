# Tasks

## 1. Browser Discovery & Configuration

- [x] 1.1 Add `janus.export.browserPath` setting to `package.json` configuration contributions and verify schema validation.
- [x] 1.2 Implement `findChromiumBrowser()` in `src/services/browserLocator.ts` supporting macOS, Windows, Linux, and custom config override; verify with unit tests in `test/browserLocator.test.ts`.

## 2. Print HTML Compilation Pipeline

- [x] 2.1 Implement `compileNoteToPrintHtml()` in `src/services/pdfExportService.ts` with Markdown parsing via `marked`, resolving relative image links to `file://` URIs, and styling task checkboxes; verify with unit tests in `test/pdfExportService.test.ts`.
- [x] 2.2 Add print-optimized CSS rules (`@page`, A4 sizing, page-break hygiene for headings, tables, and code blocks) and embedded Mermaid JS initialization to the HTML template; verify HTML output structure via unit test.

## 3. Headless PDF Generation

- [x] 3.1 Implement headless Chromium CLI execution in `PdfExportService.generatePdf()` using temporary HTML files, `--headless`, and `--print-to-pdf`, with cleanup and error handling; verify with unit test covering headless CLI arguments and error scenarios.

## 4. VS Code Commands & Context Menus

- [x] 4.1 Register command `janus.exportNoteToPdf` in `src/extension.ts` supporting active editor and tree item targets, save dialog prompt, progress notification, and completion notification with open actions.
- [x] 4.2 Add menu contributions in `package.json` for `view/item/context` (Janus Notes sidebar note items) and `editor/title` (active note editor).

## 5. Editor Toolbar Integration & Verification

- [x] 5.1 Add PDF export button to `MarkdownToolbar.tsx` and handle `exportPdf` postMessage in `MarkdownEditorApp.tsx` and `MarkdownEditorProvider`.
- [x] 5.2 Verify the full TypeScript compilation (`npm run compile`) and test suite (`npm test`).

