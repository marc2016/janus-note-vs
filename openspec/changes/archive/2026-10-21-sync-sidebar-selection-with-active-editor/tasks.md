# Tasks

## 1. Tree Item Identity and getParent Support in NotesTreeDataProvider

- [x] 1.1 Add stable `id` properties to `FolderTreeItem`, `NoteTreeItem`, `CompanionTreeItem`, `FolderTasksTreeItem`, `AllTasksTreeItem`, and `CalendarTreeItem`, and verify with unit tests.
- [x] 1.2 Implement `getParent(element: NotesTreeItem)` in `NotesTreeDataProvider` to resolve parents for notes, subfolders, companions, and folder tasks, and verify with comprehensive unit tests for root-level and nested notes.
- [x] 1.3 Implement `getTreeItemForUri(uri: vscode.Uri)` helper in `NotesTreeDataProvider` to resolve note tree items given a note URI within `janus.notesRoot`, and verify unit tests return the expected `NoteTreeItem`.

## 2. Active Editor Synchronization in Extension Activation

- [x] 2.1 Implement active note URI detection and debounced sync logic in `src/extension.ts` connecting `onDidChangeActiveTextEditor` and tab group changes to `notesTreeView.reveal(...)`, and verify compilation with `npm run compile`.
- [x] 2.2 Connect custom Markdown editor view state changes to trigger sidebar tree selection synchronization when switching between custom editor tabs, and verify compilation with `npm run compile`.

## 3. Verification & Integration Testing

- [x] 3.1 Add unit tests for `getParent` hierarchy resolution, `getTreeItemForUri`, and active note URI scoping in `test/suite/notesTreeDataProvider.test.ts`, and verify via `npm test`.
- [x] 3.2 Run full test suite and linter/build (`npm test` and `npm run compile`) to verify 0 regressions across all tests.
