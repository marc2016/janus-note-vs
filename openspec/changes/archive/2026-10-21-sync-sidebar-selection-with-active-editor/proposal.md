# Proposal: Sync Sidebar Selection with Active Editor

## Why

When opening or switching notes in the VS Code editor, users lose visual orientation of where the active note is located within the Janus folder hierarchy. Automatically selecting and revealing the active note in the Notes TreeView keeps the sidebar synchronized with the user's current editing context.

## What Changes

- Automatically reveal and select the note item in the Janus Notes TreeView whenever an editor (standard text editor or Janus Custom Editor) containing a Markdown note within `janus.notesRoot` becomes active.
- Implement `getParent(element)` on `NotesTreeDataProvider` to enable programmatic tree item traversal and `vscode.TreeView.reveal(element, options)`.
- Support lookup/creation of matching `NotesTreeItem` instances for arbitrary note URIs within `janus.notesRoot`.
- Listen to active editor change events (`onDidChangeActiveTextEditor` and custom editor tab changes via `onDidChangeTabs` or custom editor focus) with debouncing to prevent UI thrashing.
- Gracefully ignore files opened outside the configured `janus.notesRoot` or non-markdown files.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `notes-sidebar`: Add requirement for synchronizing active editor note selection and revealing the corresponding item in the Notes TreeView.

## Impact

- **Affected Code**:
  - `src/ui/notesTreeDataProvider.ts`: Implement `getParent(element: NotesTreeItem): vscode.ProviderResult<NotesTreeItem>` and item lookup helpers for URIs.
  - `src/extension.ts`: Register event listeners for active editor transitions and invoke `notesTreeView.reveal(...)`.
- **APIs/Dependencies**: VS Code TreeDataProvider `getParent` and `TreeView.reveal` APIs; no new external npm dependencies required.

