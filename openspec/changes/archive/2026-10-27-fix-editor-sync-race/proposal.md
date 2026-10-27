# Proposal

## Why

While typing in the Janus Markdown Editor, characters sometimes disappear and the cursor sometimes jumps. The webview sends its full text to the extension host after a 250 ms pause. The host applies it and then echoes every document change, including this one, back to the webview. If the user has kept typing in the meantime, the echoed (older) text replaces the newer text. Every host update also replaces the whole CodeMirror document, which resets the cursor. The editor's core promise, reliable editing, is broken by this.

## What Changes

- **No echo of the webview's own edits**: The extension host no longer sends a document change back to the webview when that change was just applied from the webview.
- **Stale updates are ignored**: Webview content messages carry a sequence number. Host updates carry the last sequence number the host has applied. The webview ignores host updates that do not yet include its latest sent edit.
- **Changes from outside are merged, not overwritten**: Real external changes (undo/redo in VS Code, the same file edited in a text editor, AI actions, link insertion) are applied as a minimal change. If the user has unsent local edits at that moment, the external change is rebased onto them instead of discarding them.
- **Cursor and selection preserved**: Because external changes are applied as minimal changes instead of full-document replacement, the cursor and selection stay in place unless the change touches them.
- **Pending edits are flushed**: Unsent local edits are sent right away when the editor loses focus or the webview is hidden, so switching tabs right after typing does not lose the last keystrokes.

Non-goals: transmitting incremental changes instead of full text, real multi-user collaboration, changing the 250 ms debounce.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `markdown-editor`: New requirement that typing is never lost or reordered by document synchronization, and that external changes keep the cursor in place.

## Impact

- `src/editors/markdownEditorProvider.ts`: Track per-panel applied sequence and text; suppress echo; send `ackSeq` with updates.
- `src/webviews/markdown/MarkdownEditorApp.tsx`: Use a sync state for sending (with `seq`) and for applying host updates (minimal change, rebase, stale filtering); flush on blur/hide.
- New pure module `src/webviews/markdown/lib/documentSync.ts` with the sync logic, plus unit tests.
- No new dependencies.
