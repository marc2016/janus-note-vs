# Tasks

## 1. Link & Line Parsing in Note Link Service

- [x] 1.1 Implement `parseLinkTargetAndLine(rawTarget: string)` supporting colon (`:line`) and anchor (`#Lline`) line numbers, update `extractDocumentLinks` and `resolveOutgoingLink` in `src/services/noteLinkService.ts`, and verify with unit tests.
- [x] 1.2 Update `findBacklinks` in `src/services/noteLinkService.ts` to track and return 1-based origin line numbers (`lineNumber?: number`) for incoming backlinks, and verify with unit tests.

## 2. Footer Bar & Editor Navigation Dispatch

- [x] 2.1 Update `NotesLinksFooter.tsx` to render origin line numbers on backlink chips (e.g. `Note A :15`) and pass the target line number on click, and verify with unit tests.
- [x] 2.2 Update `MarkdownEditorProvider.ts` to parse line targets from `openLink` messages, open non-markdown code files using `vscode.window.showTextDocument` with line selection, and dispatch `revealLine` messages (with pending webview cache for newly opened editors), and verify with unit tests.

## 3. CodeMirror Line Highlighting & Viewport Scrolling

- [x] 3.1 Implement CodeMirror 6 `lineHighlightExtension` with `setHighlightLine` StateEffect, `highlightLineField` decoration, and auto-clear on cursor movement (`tr.selection`) or document edit (`tr.docChanged`), and verify with unit tests.
- [x] 3.2 Handle `revealLine` in `MarkdownEditorApp.tsx` to clamp line bounds, center the line with `scrollIntoView`, set cursor position, and trigger the highlight decoration, and verify with unit tests.

## 4. Verification & Integration Testing

- [x] 4.1 Run full build and test suite (`npm run compile && npm run build && npm test`) to verify all existing and new tests pass with zero regressions.

