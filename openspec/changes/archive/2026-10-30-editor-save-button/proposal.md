# Proposal

## Why

The Janus Markdown Editor gives no sign of unsaved changes; only the dot in VS Code's tab shows it. There is no save action in the toolbar either. And `Cmd+S` right after typing can save the document before the last keystrokes have been sent from the editor (they are batched for about 300 ms), so the newest characters are not saved and the tab stays dirty.

## What Changes

- A save button (floppy disk icon) at the start of the editor toolbar, before Undo/Redo. It is highlighted when the note has unsaved changes and disabled when everything is saved.
- "Unsaved" covers both the document's dirty state in VS Code and edits the editor has not sent yet.
- Clicking the button, or pressing `Cmd+S`/`Ctrl+S` in the editor, first sends all pending edits and then saves the note; the button turns inactive afterwards. VS Code does not receive the key press in addition.
- Saves from outside the editor (menu, `Save All`, auto-save) also update the button.

Non-goals: a "save all" button, a confirmation on close, changing auto-save settings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirement for the save button and reliable saving from the editor.

## Impact

- `src/webviews/markdown/components/MarkdownToolbar.tsx`: save button and its state.
- `src/webviews/markdown/MarkdownEditorApp.tsx`: dirty state (host + pending edits), `save` request, `Cmd+S` handling.
- `src/editors/markdownEditorProvider.ts`: `dirtyState` messages (on change, save, open), `save` handling after pending edits are applied (per-panel message queue).
- No new settings or dependencies.
