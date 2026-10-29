# Tasks

## 1. Editor popup

- [x] 1.1 Add `src/webviews/markdown/extensions/selectionActions.ts` (tooltip field, settle tracking for mouse and keyboard, hide on typing and `Esc`, exclusion of code, Mermaid blocks and tables, minimum length) with styles in `globals.css`; verify with tests for "Popup for a selection", "No popup for short selections or code" and "Popup disappears"
- [x] 1.2 Wire the buttons in `MarkdownEditorApp.tsx`: `Zusammenfassen` posts `summarizeSelection`; `Diagramm erstellen` inserts the placeholder after the last selected line and posts `diagramFromSelection`; verify with tests that the selected text is unchanged and the block starts on the line after the selection

## 2. Host

- [x] 2.1 Handle `summarizeSelection` and `diagramFromSelection` in `MarkdownEditorProvider` (commands `janus.summarizeSelection` and `janus.editDiagramWithAi` with `sourceText`), register `janus.summarizeSelection` in `extension.ts` with chat focus; verify with provider and command tests
- [x] 2.2 Add `formatSummaryCallout`, `insertAfterText` on the provider and its webview counterpart (`insertAfterText` / `textInserted`, nearest occurrence, one undoable change); verify with tests for "Inserting a summary" and "Selected text changed in the meantime"

## 3. Chat

- [x] 3.1 Add the selection context to `ChatViewProvider` (single context slot, chip label, immediate summary, follow-ups with the previous summary, `insertSummary`/`copySummary` actions, length cap) and use `sourceText` for diagram requests; verify with tests for "Summarizing a selection", "Refining the summary", "Inserting and reporting" and "Diagram from a selection"
- [x] 3.2 Show the selection chip in `JanusChatApp.tsx` (same component, label from the host) and forward the new actions; verify with a render test and `npm run compile`

## 4. Wrap-up

- [x] 4.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 4.2 Manually check: select a paragraph and summarize it, refine with "Als Stichpunkte", insert below and undo; select text and create a diagram; check that no popup appears for a single word, in a code block and in a table, and that it disappears on typing and `Esc`
