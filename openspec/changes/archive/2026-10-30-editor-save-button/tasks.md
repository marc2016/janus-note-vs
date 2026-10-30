# Tasks

## 1. Host

- [x] 1.1 Process webview messages of a panel in order (per-panel promise chain, long AI handlers not awaited inside it), send `dirtyState` after init, on document changes and on save, and handle `save` with `document.save()`; verify with provider tests that `save` after `updateContent` saves the updated text, that `dirtyState` is sent on change and on save, and that a save from outside sends `dirty: false`

## 2. Editor

- [x] 2.1 Track `hostDirty` and pending edits in `MarkdownEditorApp.tsx`, add `requestSave()` (flush, then `save`) and a `Mod-s` keydown handler that stops propagation; verify with tests for the key mapping, that pending edits are flushed before `save` is posted, and the combined dirty state
- [x] 2.2 Add the save button at the start of `MarkdownToolbar.tsx` (icon, enabled/highlighted when dirty, disabled when clean, platform title); verify with render tests for both states

## 3. Wrap-up

- [x] 3.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 3.2 Manually check: type and watch the button, save with the button, type `Ende` and press `Cmd+S` immediately, save via `File → Save All`, check that a clean note has a disabled button
