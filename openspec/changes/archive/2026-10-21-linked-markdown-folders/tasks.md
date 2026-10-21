# Tasks

## 1. Configuration & Interactive Commands

- [x] 1.1 Add `janus.includeFolders` configuration array property in `package.json` with schema and description, and verify with unit tests.
- [x] 1.2 Implement `janus.addLinkedFolder` and `janus.removeLinkedFolder` commands in `src/commands/notesRootCommands.ts` for adding and removing workspace folders from configuration, and verify with unit tests.
- [x] 1.3 Add title bar `+` action and Explorer context menu contributions for `janus.addLinkedFolder`, context menu contribution for `janus.removeLinkedFolder`, and update viewsWelcome buttons in `package.json`.

## 2. Multi-Root Scope in Companion Manager

- [x] 2.1 Update `CompanionManager` in `src/companion/companionManager.ts` to implement `getIncludedFolderUris()`, `getAllNotesRoots()`, and multi-root `isUnderNotesRoot()` resolution, and verify with unit tests.

## 3. Sidebar Tree Multi-Root & Pure Folder Rendering

- [x] 3.1 Implement `LinkedFolderTreeItem` and update `NotesTreeDataProvider.getChildren()` in `src/ui/notesTreeDataProvider.ts` to render linked folders at the root level and bypass `viewsWelcome` when linked folders exist, and verify with unit tests.
- [x] 3.2 Ensure linked folders display only actual subfolders and Markdown files (`*.md`, `*.markdown`) without synthetic task or calendar items, and verify with unit tests.

## 4. Cross-Folder Linking & Autocomplete

- [x] 4.1 Update `findMarkdownNotesInRoot` and `findLinkCandidatesInRoot` in `src/companion/noteLinking.ts` and `src/services/noteLinkService.ts` to discover notes across all roots from `getAllNotesRoots()`, and verify with unit tests.
- [x] 4.2 Update backlink discovery in `src/services/noteLinkService.ts` to discover and index bi-directional links between vault notes and linked folders, and verify with unit tests.

## 5. Verification & Integration Testing

- [x] 5.1 Run full build and test suite (`npm run compile && npm run build && npm test`) to verify all existing and new tests pass with zero regressions.

