# Tasks

## 1. Sidebar Multi-Selection Configuration & Event Handling

- [x] 1.1 Enable `canSelectMany: true` on `notesTreeView` in `src/extension.ts` and verify tree view instantiation properties.
- [x] 1.2 Implement debounced `onDidChangeSelection` listener in `src/extension.ts` that triggers `folderOverviewViewProvider.openSelection(e.selection)` when two or more items are selected, and verify with unit tests.

## 2. Service & Provider Multi-Item Ingestion

- [x] 2.1 Extend `AiFolderSummaryService` in `src/services/aiFolderSummaryService.ts` with `generateSelectionSummary` supporting arbitrary collections of notes and folders with truncation guards, and verify with unit tests.
- [x] 2.2 Extend `FolderOverviewViewProvider` in `src/editors/folderOverviewViewProvider.ts` with `openSelection(items)` and `getSelectionOverviewData(items)`, resolving common directory vs root persistence paths, and verify with unit tests.

## 3. Webview React UI Multi-Selection Presentation

- [x] 3.1 Update `FolderOverviewApp.tsx` to display multi-selection titles, selected count pills, aggregated task cards, and persistence feedback, and rebuild via `npm run build`.

## 4. Verification & Regression Testing

- [x] 4.1 Run full build and test suite (`npm run compile && npm run build && npm test`) to verify all existing and new tests pass with zero regressions.

