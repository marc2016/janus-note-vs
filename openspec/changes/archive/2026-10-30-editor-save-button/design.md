# Design

## Context

- The webview batches edits (`DocumentSync`, debounce ~300 ms) and sends `updateContent`; `flushPendingEdits` sends them immediately (used on blur). The host applies them with a `WorkspaceEdit`, which makes the TextDocument dirty.
- `onDidReceiveMessage` calls the async `handleWebviewMessage` for every message without waiting for the previous one, so a `save` arriving right after `updateContent` could run before that edit is applied.
- VS Code receives key presses from the webview (see `fix-double-undo`): `Cmd+S` saves the TextDocument, possibly before the webview flushed.
- The toolbar (`MarkdownToolbar.tsx`) starts with Undo/Redo.

## Goals / Non-Goals

**Goals:**
- A save always contains what the editor shows.

**Non-Goals:**
- Changing the batching interval.

## Decisions

### 1. Dirty state from the host plus pending edits

The host posts `{ type: 'dirtyState', dirty: document.isDirty }` after `init`, on every `onDidChangeTextDocument` for the note, and on `onDidSaveTextDocument` (dirty `false`). The webview keeps `hostDirty` and derives `hasPending` from `DocumentSync` (updated on every local transaction and after each flush). The button shows `hostDirty || hasPending`.

### 2. Ordered handling on the host

Messages from one panel are processed through a promise chain per panel (`queue = queue.then(() => handle(message))`), so `save` runs only after every earlier `updateContent` was applied. `save` calls `document.save()` and replies with the resulting `dirtyState`.

*Alternative considered:* sending the content with the save request. That would bypass the existing sync bookkeeping (`seq`, echo suppression).

### 3. Save action and `Cmd+S`

`requestSave()` in the webview: `flushPendingEdits()`, then post `{ type: 'save' }`. The toolbar button calls it. A high-precedence keydown handler (same pattern as `singleUndoHistory`) maps `Mod-s` to `requestSave()`, prevents the default and stops propagation, so VS Code does not save the stale document in parallel.

### 4. Button

`mdiContentSave`, first in the toolbar followed by a separator. Enabled + accent color (`--vscode-button-background`) when dirty, disabled + muted when clean. Title: `Speichern (⌘S)` on macOS, `Speichern (Strg+S)` elsewhere.

## Risks / Trade-offs

- [Queueing all panel messages could delay long-running ones (e.g. AI sorting)] → The queue only orders message *start*; long handlers that do not need ordering (AI requests) are started without awaiting them inside the chain, as they already post their own progress. In practice only `updateContent`, `save` and edits need the order.
- [Auto-save enabled] → The button is mostly disabled; that matches the actual state.
