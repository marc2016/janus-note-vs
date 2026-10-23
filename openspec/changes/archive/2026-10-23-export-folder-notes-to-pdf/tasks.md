# Tasks

## 1. Multi-Note HTML Compilation & TOC Pipeline

- [x] 1.1 Implement `compileMultiNoteToPrintHtml()` in `src/services/pdfExportService.ts` supporting Table of Contents with clickable `#note-X` anchor links, individual note sections, and page break rules; verify with unit tests in `tests/pdfExportService.test.ts`.
- [x] 1.2 Implement `collectMarkdownNotesFromSelection()` in `src/services/noteLinkService.ts` to recursively discover and deduplicate notes from folders or multi-selections; verify with unit tests in `tests/noteLinkService.test.ts`.

## 2. Interactive Export Configuration Webview

- [x] 2.1 Implement `ExportCompendiumApp.tsx` in `src/webviews/exportCompendium/` with note list, Move Up / Move Down buttons, Table of Contents checkbox toggle, and export confirmation button.
- [x] 2.2 Implement `ExportCompendiumViewProvider` in `src/editors/exportCompendiumViewProvider.ts` to manage the WebviewPanel lifecycle, send note candidates, and handle export confirmation messages.
- [x] 2.3 Add exportCompendium webview entry to `esbuild.js` and verify bundle generation.

## 3. VS Code Commands & Menus

- [x] 3.1 Register command `janus.exportFolderToPdf` in `src/extension.ts` handling folder items, multi-selections, save dialog, progress indicator, and completion actions.
- [x] 3.2 Add command and menu contributions to `package.json` for folder context menus (`viewItem == janusFolder || viewItem == linkedFolder`) and Folder Overview header.

## 4. Verification

- [x] 4.1 Verify TypeScript compilation (`npm run compile`), full build (`npm run build`), and test suite (`npm test`).

