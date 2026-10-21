# Design: Sync Sidebar Selection with Active Editor

## Context

See [proposal.md](proposal.md) for motivation.

Currently, the Janus Notes sidebar (`janus.notesView`) renders notes and folders via `NotesTreeDataProvider`. However, when a user navigates between notes using VS Code's editor tabs, Quick Open (`Cmd+P`), or document links, the sidebar tree remains on whatever item was previously selected.

VS Code supports programmatic tree item reveal and selection via `vscode.TreeView.reveal(element, options)`. Calling `reveal()` requires the `TreeDataProvider` to implement `getParent(element)`. Currently, `NotesTreeDataProvider` does not implement `getParent`, preventing programmatic reveals. Furthermore, notes can be viewed in both standard text editors and the Janus custom Markdown editor (`MarkdownEditorProvider`), necessitating comprehensive detection of active note changes.

## Goals / Non-Goals

**Goals:**
- Implement `getParent(element: NotesTreeItem)` in `NotesTreeDataProvider` to enable tree traversal from any child node up to the root.
- Assign stable `id` properties to tree items (`FolderTreeItem`, `NoteTreeItem`, `CompanionTreeItem`, `FolderTasksTreeItem`, `AllTasksTreeItem`, `CalendarTreeItem`) so VS Code reliably identifies tree nodes.
- Expose a helper method `getTreeItemForUri(uri: vscode.Uri)` to create or resolve a `NoteTreeItem` for a given file URI.
- Detect active editor changes across standard text editors, custom Markdown editors, and tab changes using debounced event listeners.
- Automatically reveal and select the corresponding note in `janus.notesView` with `select: true, focus: false, expand: true`.

**Non-Goals:**
- Auto-revealing companion files (`*.tasks.json`, `*.chart.json`) or folder task items; auto-reveal targets Markdown notes.
- Synchronizing selection for non-Markdown files or files located outside the configured `janus.notesRoot`.
- Forcing the Janus sidebar view container to open if the user has closed or hidden the sidebar (reveal only syncs when the view is visible or requested).

## Decisions

### 1. `getParent` Implementation via Path Resolution
- **Choice**: Derive parent items by inspecting `element.uri` relative to `janus.notesRoot`.
  - For a `NoteTreeItem`: If its directory equals `notesRootUri`, return `undefined` (top-level note). Otherwise, return `FolderTreeItem` for `path.dirname(element.uri.fsPath)`.
  - For a `FolderTreeItem`: If its parent directory equals `notesRootUri`, return `FolderTreeItem` with `isRootChild = true`. If it is the notes root itself, return `undefined`. Otherwise, return `FolderTreeItem` for the parent folder.
  - For a `CompanionTreeItem`: Parent is `NoteTreeItem(element.noteUri)`.
  - For a `FolderTasksTreeItem`: Parent is `FolderTreeItem(element.folderUri)`.
  - For `AllTasksTreeItem` and `CalendarTreeItem`: Return `undefined` (top-level pinned items).
- **Alternative considered**: Maintaining an in-memory parent-pointer cache. Rejected because filesystem paths already define a canonical, stateless hierarchy, avoiding synchronization bugs when files are added or renamed.

### 2. Stable Tree Item IDs
- **Choice**: Set `this.id = uri.toString()` (or with a type prefix like `note:${uri.toString()}`) on tree items.
- **Rationale**: VS Code's tree engine uses item IDs to match items returned by `getParent()` and `getChildren()`. Without unique IDs, object references must match exactly, which fails when tree items are reconstructed dynamically.

### 3. Editor Event Detection Pipeline
- **Choice**: Combine three event triggers to reliably detect active note URI:
  1. `vscode.window.onDidChangeActiveTextEditor`: Triggers for standard text editors.
  2. `vscode.window.tabGroups?.onDidChangeTabs`: Triggers when switching tabs (including custom editor tabs).
  3. `MarkdownEditorProvider`: On tab view state change (`onDidChangeViewState`) when webview panel becomes active.
- **URI Extractor**:
  - Inspect `vscode.window.tabGroups?.activeTabGroup?.activeTab?.input`. If instance of `vscode.TabInputText` or `vscode.TabInputCustom`, read `uri`.
  - Fall back to `vscode.window.activeTextEditor?.document?.uri`.
- **Filtering**:
  - Verify file path is within `notesRootUri`.
  - Verify file is a markdown file (`isMarkdownNote(uri.fsPath)`).

### 4. Debounced Reveal Execution
- **Choice**: Wrap the reveal call in a 150ms debounce timer.
- **Rationale**: Switching between editors or opening multiple files during startup or searches can trigger bursts of events. Debouncing ensures only the steady-state active note is revealed without visual flicker or unnecessary filesystem checks.

## Risks / Trade-offs

- **[Risk]** `reveal()` fails if the tree view is not visible or collapsed.
  - **Mitigation**: VS Code handles hidden tree views safely by queuing state or ignoring if inactive; wrap `notesTreeView.reveal()` in a `.catch()` block to log warnings rather than crashing the extension.
- **[Risk]** Stolen focus from the active editor while typing or navigating.
  - **Mitigation**: Pass `{ select: true, focus: false, expand: true }` to `reveal()` so focus remains uninterrupted in the editor.
- **[Risk]** Root category localized folder labels vs actual folder path in `getParent`.
  - **Mitigation**: `FolderTreeItem` calculates `displayLabel` from `uri` and `isRootChild`. When constructing a parent `FolderTreeItem`, determine whether the parent folder is a direct child of `notesRootUri` so the localized label is applied consistently.

