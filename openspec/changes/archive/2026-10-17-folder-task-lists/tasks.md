# Tasks

## 1. Data Model & Folder Tasks Service

- [x] 1.1 Update `TaskItem` and `TasksCompanion` schema in `src/models/tasks.ts` to support directory-scoped tasks and optional `note` reference, and verify with unit tests
- [x] 1.2 Implement `FolderTasksService` in `src/services/folderTasksService.ts` for directory scanning, reading, updating, and open task count calculation, and verify with unit tests

## 2. Interactive Checklist Webview UI

- [x] 2.1 Implement `TaskListApp.tsx` checklist UI with checkboxes, strikethrough, quick-add input, filter pills (all/open/done), and note chips in `src/webviews/tasks/TaskListApp.tsx`
- [x] 2.2 Update `TasksEditorProvider.ts` to support `tasks.json` files and hook up message communication with the new checklist webview, and verify with compile check

## 3. Virtual Global Tasks Aggregator View

- [x] 3.1 Implement `GlobalTasksViewProvider` with webview panel, folder grouping sections, and bi-directional disk writeback to folder `tasks.json`, and verify with unit tests
- [x] 3.2 Register command `janus.openAllTasks` in `package.json` and `src/extension.ts`, and verify via compile check

## 4. Sidebar Tree Integration & Polish

- [x] 4.1 Update `NotesTreeDataProvider` in `src/ui/notesTreeDataProvider.ts` to display pinned `AllTasksTreeItem` at the top and `FolderTasksTreeItem` inside folders, and verify with unit tests
- [x] 4.2 Run full test suite with `npm test` and production bundle with `npm run build` to verify clean build and regression-free test coverage
