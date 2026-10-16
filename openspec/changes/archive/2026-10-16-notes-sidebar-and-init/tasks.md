# Tasks

## 1. Manifest Contributions and Assets

- [x] 1.1 Add Activity Bar View Container `janus-notes`, View `janus.notesView`, and configuration property `janus.initialized` in `package.json`, and verify with `npm run compile`
- [x] 1.2 Add `viewsWelcome` definitions for clean vs. non-empty uninitialized folders in `package.json`, and verify configuration syntax
- [x] 1.3 Add Janus icon asset for Activity Bar in `resources/` or reference existing icon asset, and verify icon path resolves

## 2. TreeDataProvider and Item Models

- [x] 2.1 Implement `NotesTreeItem` classes (`FolderItem`, `NoteItem`, `CompanionItem`) with appropriate icons, collapsible states, and click commands in `src/ui/notesTreeDataProvider.ts`, and verify with compile check
- [x] 2.2 Implement `NotesTreeDataProvider` to read only `.md` files and subdirectories under `notesRoot`, and verify unit tests cover folder traversal and file filtering
- [x] 2.3 Implement child item resolution for `NoteItem` to query `CompanionManager` and return attached `*.tasks.json` and `*.chart.json` companions, and verify unit tests confirm child companion items

## 3. Initialization Logic and Context Key State

- [x] 3.1 Implement helper function to check initialization state and detect non-note files in `notesRoot`, updating context keys `janus.isInitialized` and `janus.hasNonNoteFiles`, and verify with unit tests
- [x] 3.2 Implement `initNotesRootCommand` in `src/commands/notesRootCommands.ts` to create `inbox.md`, set `janus.initialized`, open the note, and trigger tree refresh, and verify behavior with tests

## 4. Extension Integration and Verification

- [x] 4.1 Register `NotesTreeDataProvider`, commands, and context updates in `src/extension.ts`, linking tree refresh to `CompanionWatcher`, and verify compile succeeds
- [x] 4.2 Run the full test suite with `npm run test` and TypeScript check with `npm run compile` to verify clean build and test coverage
