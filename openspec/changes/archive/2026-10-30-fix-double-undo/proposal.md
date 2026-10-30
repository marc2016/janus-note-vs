# Proposal

## Why

Pressing `Cmd+Z` / `Ctrl+Z` in the Janus Markdown Editor sometimes duplicates content. The editor (CodeMirror) has its own undo history, and the same key press also reaches VS Code, which undoes the last `WorkspaceEdit` on the TextDocument. Both undos then meet in the document synchronization: when the undone step was a deletion, both sides re-insert the text, and it appears twice.

## What Changes

- Undo and redo key presses in the Janus Markdown Editor (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, `Ctrl+Y`) are handled only by the editor's own history and are no longer passed on to VS Code.
- `Edit → Undo` from the menu and the `Undo` command keep undoing the TextDocument in VS Code. They reach the document once, and the editor applies the result as an external change, as today.
- If VS Code receives the key press before the editor can stop it, a key binding active only in the Janus editor routes undo/redo to the editor instead of the TextDocument.

Non-goals: merging the two histories, undo across closing and reopening a note, changing what counts as one undo step.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirement for a single undo history in the editor.

## Impact

- `src/webviews/markdown/lib/editorKeymap.ts` (or a small new extension): undo/redo key handling that stops propagation.
- Only if needed after the manual check: `package.json` key bindings for `activeCustomEditorId == 'janus.markdownEditor'`, a command that posts `undo`/`redo` to the active editor panel, and its handler in `MarkdownEditorApp.tsx`.
- No new settings or dependencies.
