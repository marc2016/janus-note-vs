# Tasks

## 1. Manifest Contributions

- [ ] 1.1 Declare commands `janus.createFolder`, `janus.createNote`, `janus.renameItem`, and `janus.deleteItem` in `package.json`, and verify with `npm run compile`
- [ ] 1.2 Declare `view/title` and `view/item/context` menus for notes view in `package.json`, and verify configuration syntax

## 2. File Operations Implementation

- [ ] 2.1 Implement `resolveTargetDirectory` helper supporting context items, tree view selection, and notesRoot fallback in `src/commands/notesFileCommands.ts`, and verify with unit tests
- [ ] 2.2 Implement `createFolderCommand` and `createNoteCommand` with input prompt validation and note opening in Janus Markdown Editor in `src/commands/notesFileCommands.ts`, and verify with unit tests
- [ ] 2.3 Implement `renameItemCommand` with automatic companion file renaming (`*.tasks.json`, `*.chart.json`) in `src/commands/notesFileCommands.ts`, and verify with unit tests
- [ ] 2.4 Implement `deleteItemCommand` with modal confirmation, trash support, and companion file cleanup in `src/commands/notesFileCommands.ts`, and verify with unit tests

## 3. TreeView Integration and Verification

- [ ] 3.1 Refactor extension activation to use `vscode.window.createTreeView` and register file commands in `src/extension.ts`, and verify with compile check
- [ ] 3.2 Run full test suite with `npm run test` and production bundle with `npm run build` to verify clean build and test coverage
