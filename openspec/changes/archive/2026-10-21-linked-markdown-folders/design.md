# Design: Linked Markdown Folders (Multi-Root Support)

## Context

See [proposal.md](proposal.md) for motivation.

Currently, `CompanionManager.getNotesRootUri()` returns a single `vscode.Uri` corresponding to `janus.notesRoot`. `NotesTreeDataProvider.getChildren()` relies strictly on `checkNotesRootStatus()`: if `isInitialized` is false, it returns `[]`, causing VS Code to display `viewsWelcome`.

To support regular project folders (e.g. `docs/`, `specs/`) without forcing the Janus Vault convention (`meetings/`, `projects/`, `knowledge/`, `inbox.md`, `tasks.json`), the system must support multiple independent folder roots with distinct display and feature profiles.

## Goals / Non-Goals

**Goals:**
- Provide a configuration setting `janus.includeFolders: string[]` specifying relative workspace paths to include in the Janus Notes sidebar.
- Allow adding and removing linked folders via interactive commands (`janus.addLinkedFolder`, `janus.removeLinkedFolder`).
- Display linked folders in the `NotesTreeDataProvider` as pure Markdown directory hierarchies, completely free of pinned tasks, calendar entries, or forced vault subdirectories.
- Show linked folders immediately even if the primary Janus Vault is uninitialized, bypassing the blank Welcome View.
- Discover and autocomplete notes across both `notesRoot` and all `includeFolders` for bi-directional linking (`[[...]]`) and backlinks.

**Non-Goals:**
- Supporting arbitrary folders outside the current VS Code workspace folders (all paths are relative to workspace).
- Generating companion files (`*.tasks.json`, `*.chart.json`) or `inbox.md` inside linked folders.

## Decisions

### 1. Configuration Model (`janus.includeFolders`)
- Store additional folders as an array of relative paths in `.vscode/settings.json`:
  ```json
  {
    "janus.includeFolders": ["docs", "specs"]
  }
  ```
- Defaults to `[]`.
- Changes to `janus.includeFolders` trigger sidebar refresh and link index invalidation.

### 2. Multi-Root Tree Structure in `NotesTreeDataProvider`
- In `NotesTreeDataProvider.getChildren(element)`:
  - If `element === undefined` (root level):
    - Retrieve `vaultStatus = await checkNotesRootStatus()` and `includedUris = companionManager.getIncludedFolderUris()`.
    - If vault is initialized: include `AllTasksTreeItem`, `CalendarTreeItem`, and directory items of the vault.
    - For each included folder URI: render a `LinkedFolderTreeItem` with a folder icon, label (basename or relative path), and `contextValue = 'linkedFolder'`.
    - If vault is uninitialized BUT `includedUris.length > 0`: return the `LinkedFolderTreeItem`s directly (preventing `viewsWelcome`).
    - If vault is uninitialized AND `includedUris.length === 0`: return `[]` to allow `viewsWelcome` to render.

### 3. Pure Markdown Scoping in Linked Folders
- Subtree resolution inside linked folders:
  - `readDirectoryItems(dirUri, isSubfolder, isPureFolder = true)`:
  - Only scans and returns `FolderTreeItem` and `NoteTreeItem`.
  - Skips checking or rendering directory-level `tasks.json` checklist items.
  - Companion files are neither created nor shown inside pure linked folders.

### 4. Cross-Folder Discovery in `CompanionManager` & `NoteLinkService`
- In `CompanionManager`:
  - `getIncludedFolderUris(scopeUri?: vscode.Uri): vscode.Uri[]`: resolves configured paths against workspace folder.
  - `getAllNotesRoots(scopeUri?: vscode.Uri): vscode.Uri[]`: returns unique deduplicated array of `[notesRootUri, ...getIncludedFolderUris()]`.
  - `isUnderNotesRoot(uri: vscode.Uri)`: updated to return true if the URI is under `notesRootUri` OR any URI in `getIncludedFolderUris()`.
- In `noteLinkService.ts` & `noteLinking.ts`:
  - `findMarkdownNotesInRoot` & `findLinkCandidatesInRoot`: iterate across all URIs returned by `companionManager.getAllNotesRoots()`.
  - Note names are uniquely identifiable by relative path or base title across all linked folders.

### 5. Interactive Commands
- `janus.addLinkedFolder(folderUri?: vscode.Uri)`:
  - If called without arguments (e.g. from title bar `+`), presents a quick pick of existing workspace folders.
  - If called with a URI (e.g. from Explorer context menu), normalizes the path relative to workspace.
  - Updates `janus.includeFolders` in workspace configuration and refreshes the tree.
- `janus.removeLinkedFolder(item?: NotesTreeItem)`:
  - Removes the target folder from `janus.includeFolders`.
  - Refreshes tree view and active context keys.

## Risks / Trade-offs

- **[Risk] Folder path overlap or nesting (e.g. `docs` inside `notes`)**
  - **Mitigation**: Deduplicate roots in `CompanionManager.getAllNotesRoots()` and skip rendering nested roots twice.
- **[Risk] Deleted folder on disk while still configured in `janus.includeFolders`**
  - **Mitigation**: Handle missing directories gracefully in `getChildren()` without crashing the tree.

