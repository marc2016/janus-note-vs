# Tasks

## 1. Sidebar Inline Action & Command Contribution

- [x] 1.1 Register `janus.openFolderOverview` command and inline `$(dashboard)` menu contribution in `package.json` for `janusFolder` and `janusLinkedFolder` items, and verify contribution points.
- [x] 1.2 Implement command handler in `src/extension.ts` routing folder tree items to `FolderOverviewViewProvider`, and verify with unit tests.

## 2. AI Folder Summary Service

- [x] 2.1 Implement `AiFolderSummaryService` in `src/services/aiFolderSummaryService.ts` to discover notes, extract contents with truncation guards, build structured German summary prompts, and query `AiModelService`, and verify with unit tests.

## 3. Folder Overview Webview Provider & Backend

- [x] 3.1 Implement `FolderOverviewViewProvider` in `src/editors/folderOverviewViewProvider.ts` to manage WebviewPanel lifecycle, aggregate folder notes and task statistics, and process messages (`ready`, `generateSummary`, `saveSummaryAsNote`, `openNote`, `openTaskBoard`), and verify with unit tests.
- [x] 3.2 Configure `esbuild.js` to bundle `src/webviews/folderOverview/index.tsx` into `dist/webviews/folderOverview.js`.

## 4. Folder Overview React UI Component

- [x] 4.1 Implement `FolderOverviewApp.tsx` with folder header statistics, interactive note cards grid, folder task summary card, and AI summarization section with subfolder scope toggle, loading state, clipboard copy, and "Als Notiz speichern" button.

## 5. Verification & Regression Testing

- [x] 5.1 Run full build and test suite (`npm run compile && npm run build && npm test`) to verify all existing and new tests pass with zero regressions.

