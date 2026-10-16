# Design

## Context

See `proposal.md` for background and motivation. `NotesTreeDataProvider` renders folders, Markdown notes, and companion files. Currently, the tree is read-only from the user's perspective. This design specifies how commands, UI menu items, and filesystem operations are orchestrated to manage notes and folders directly inside the sidebar.

## Goals / Non-Goals

**Goals:**
- Provide intuitive creation of folders and Markdown notes from title bar buttons, folder inline buttons, and item context menus.
- Support target folder detection: use selected item in the TreeView or fall back to `janus.notesRoot`.
- Keep companion files (`*.tasks.json`, `*.chart.json`) synchronized during rename operations.
- Ensure safe deletion with confirmation, trash support (`useTrash: true`), and automatic cleanup of attached companion files.

**Non-Goals:**
- Drag-and-drop file movement in this iteration.
- Bulk multi-item rename operations.

## Decisions

### 1. TreeView Selection Handling
- In `src/extension.ts`, instantiate the tree view using `vscode.window.createTreeView('janus.notesView', { treeDataProvider: notesTreeDataProvider })` instead of `registerTreeDataProvider`.
- Store the `treeView` reference and pass it to file commands so that title-bar commands (which receive no item parameter from VS Code) can inspect `treeView.selection` to identify the active target directory.

### 2. Target Directory Resolution Strategy
A utility function `resolveTargetDirectory(contextItem, treeView, companionManager)` determines where a new file or folder should be placed:
- If `contextItem instanceof FolderTreeItem`: use `contextItem.uri`.
- If `contextItem instanceof NoteTreeItem`: use `path.dirname(contextItem.uri.fsPath)`.
- If `contextItem` is undefined, check `treeView.selection[0]`:
  - If a folder: use its URI.
  - If a note: use its parent directory.
  - Otherwise: fall back to `companionManager.getNotesRootUri()`.

### 3. File Creation and Editor Focus
- **New Folder** (`janus.createFolder`):
  - Prompts with `vscode.window.showInputBox`.
  - Validates non-empty input and rejects path separators (`/`, `\`).
  - Calls `vscode.workspace.fs.createDirectory(newFolderUri)`.
  - Refreshes the tree.
- **New Note** (`janus.createNote`):
  - Prompts with `vscode.window.showInputBox` (e.g. `untitled`).
  - Automatically appends `.md` if the user didn't type it.
  - Writes initial Markdown content (`# <Title>\n\n`).
  - Calls `vscode.commands.executeCommand('vscode.openWith', newNoteUri, 'janus.markdownEditor')` to immediately open in the Janus Markdown Editor.
  - Refreshes the tree.

### 4. Companion-Aware Rename and Delete
Implemented in `src/commands/notesFileCommands.ts`:
- **Rename Item** (`janus.renameItem`):
  - For `NoteTreeItem`: prompts with the current note name. Renames the note file and, if attached companion files exist (`*.tasks.json`, `*.chart.json`), automatically renames them to match the new base name.
  - For `FolderTreeItem`: prompts and renames the folder.
- **Delete Item** (`janus.deleteItem`):
  - Displays a modal confirmation: `"Möchtest du '<name>' wirklich in den Papierkorb verschieben?"`.
  - If deleting a note, discovers any existing companions and deletes them as well using `vscode.workspace.fs.delete(uri, { useTrash: true, recursive: true })`.

### 5. Menu Declarations in `package.json`
- `view/title`:
  - `janus.createNote` (icon: `$(new-file)`, group: `navigation@1`)
  - `janus.createFolder` (icon: `$(new-folder)`, group: `navigation@2`)
  - `janus.refreshNotesTree` (icon: `$(refresh)`, group: `navigation@3`)
- `view/item/context`:
  - For `viewItem == janusFolder`:
    - `janus.createNote` (inline + context menu)
    - `janus.createFolder` (inline + context menu)
    - `janus.renameItem` (group: `modify@1`)
    - `janus.deleteItem` (group: `modify@2`)
  - For `viewItem == janusNote`:
    - `janus.renameItem` (group: `modify@1`)
    - `janus.deleteItem` (group: `modify@2`)

## Risks / Trade-offs

- **[Risk] Accidental deletion of notes and companions**
  → *Mitigation*: Use modal confirmation and always specify `useTrash: true` so deleted files can be restored from the OS trash.
- **[Risk] Naming conflicts during rename**
  → *Mitigation*: Validate that the destination file or directory does not already exist before initiating the rename.
