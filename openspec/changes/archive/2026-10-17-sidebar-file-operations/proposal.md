# Proposal

## Why

Currently, the Janus Notes sidebar allows browsing notes and expanding companions, but users cannot create, rename, or delete folders and notes directly within the sidebar. To add a new folder or note, users have to switch to the standard VS Code Explorer or terminal, breaking the focused note-taking workflow.

Adding first-class file and folder management directly in the Janus sidebar—with companion-aware renaming and deletion—enables a complete, standalone notes workspace experience.

## What Changes

- Add command and view/title + context menu actions for **Create Folder** (`janus.createFolder`):
  - When invoked on a folder or with a folder selected in the tree, creates a subfolder within it.
  - When invoked with nothing selected or at root, creates the folder in `janus.notesRoot`.
  - Prompts for name with validation.
- Add command and view/title + context menu actions for **Create Note** (`janus.createNote`):
  - When invoked on a folder, creates a note in that folder.
  - When invoked on an existing note, creates a note in the same parent directory.
  - When invoked with nothing selected, creates the note in `janus.notesRoot`.
  - Automatically appends `.md` if omitted, generates initial header content, and opens the new note in the Janus Markdown Editor.
- Add **Rename Item** (`janus.renameItem`):
  - Available for folders and notes via context menu.
  - When renaming a Markdown note, automatically renames any attached companion files (`*.tasks.json`, `*.chart.json`) so the pairing is preserved.
- Add **Delete Item** (`janus.deleteItem`):
  - Prompts for confirmation and moves items to the system trash (`useTrash: true`).
  - When deleting a note, moves any attached companion files to the trash as well.
- Switch sidebar view registration to `window.createTreeView` to maintain selection state for title bar actions.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `notes-sidebar`: Adds requirements for creating folders and notes, renaming items with companion synchronization, and safely deleting notes and folders with companion cleanup from the Janus sidebar.

## Impact

- `package.json`: Contributes commands (`janus.createFolder`, `janus.createNote`, `janus.renameItem`, `janus.deleteItem`) and menu contributions for `view/title` and `view/item/context`.
- `src/commands/`: Adds `notesFileCommands.ts` implementing the file system operations and user prompts.
- `src/extension.ts`: Switches to `createTreeView` and registers the new file operation commands.
- `src/ui/notesTreeDataProvider.ts`: Exposes tree item selection helpers and context values.
