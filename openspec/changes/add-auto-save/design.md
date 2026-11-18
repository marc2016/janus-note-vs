# Design

## Context

See proposal.md for the motivation. Observed state:

- **Markdown editor webview (`MarkdownEditorApp.tsx`):** local edits are recorded by a sync tracker and sent with `updateContent` after a 250 ms debounce (`flushPendingEdits`). The flush also runs on CodeMirror `blur`, on `visibilitychange` (hidden), on `pagehide` and on unmount. `requestSave()` flushes and then posts `save`. The host applies messages in order, so the save always includes the flushed edits. The unsaved state shown in the toolbar is `hostDirty || hasPendingEdits`; `hostDirty` comes from `dirtyState` messages.
- **Host (`markdownEditorProvider.ts`):** `save` calls `document.save()`, shows `Notiz konnte nicht gespeichert werden: …` on failure and posts `dirtyState`. Settings reach the webview in the `init` message; `onDidChangeConfiguration` currently only handles `janus.ai`.
- **Tasks editor:** applies the edit and calls `document.save()` right away.
- **Chart editor (`chartEditorProvider.ts`):** `updateChart` applies a full-text `WorkspaceEdit` and does not save.
- **Settings panel:** `settingsViewProvider.ts` builds a `JanusSettingsState` and handles update messages; `SettingsApp.tsx` renders numbered sections (AI provider, AI behavior, workspace).
- **Save listeners:** `linkedTaskSync` runs `syncNote` on every save of a `.md` inside the notes root and writes `tasks.json` only on a real change.

## Goals / Non-Goals

**Goals:**

- Auto-save reuses `requestSave()`, so it can never save a state older than what the editor shows.
- The timing logic is a pure, unit-testable module without DOM or VS Code dependencies.
- The setting is read in the host and pushed to each open editor, so changes apply without reopening.

**Non-Goals:**

- No change to VS Code's `files.autoSave`, and no detection of it.
- No different save path or skipped side effects for automatic saves.

## Decisions

### 1. Auto-save lives in the webview, not the host

The webview knows when the user types, when focus leaves and when edits are pending. A host-side timer on `onDidChangeTextDocument` would see only flushed edits, and would race the 250 ms debounce in the same way VS Code's `files.autoSave` does.

Alternative considered: a host timer that asks the webview to flush and then saves. Rejected: it adds a round trip and duplicates what `requestSave()` already does.

### 2. Pure scheduler module `src/webviews/markdown/lib/autoSave.ts`

`createAutoSaveScheduler({ save, setTimer, clearTimer })` returns:

- `configure({ mode, delay })`
- `onLocalEdit()`: in `afterDelay` mode it (re)starts the delay timer; otherwise does nothing.
- `onFocusLost()`: in `afterDelay` and `onFocusChange` mode it cancels the timer and calls `save` immediately; in `off` mode does nothing.
- `dispose()`

`save` is the app's `requestSave` wrapped with a check that the note has unsaved changes: the host dirty flag, or a local edit since the last save request (`editedSinceSaveRef`). The local flag is needed because after the 250 ms flush there are no pending edits, but the host may not have reported the document as dirty yet; checking only `hostDirty || hasPendingEdits` could skip a save on a quick focus change. A blur on a clean note does not save again. The delay is clamped to at least 250 ms in the module as well, as protection against hand-edited settings. Timers are injected so tests can use fake timers without a DOM.

### 3. Wiring in `MarkdownEditorApp.tsx`

- The existing CodeMirror update listener that starts the 250 ms flush debounce also calls `scheduler.onLocalEdit()`.
- The existing `blur`, `visibilitychange` (hidden) and `pagehide` handlers call `scheduler.onFocusLost()` instead of only flushing. In `off` mode they keep flushing as today. `requestSave` flushes anyway, so the order is unchanged.
- On unmount the app does not save. The webview may already be gone at that point, and VS Code asks about the unsaved document when the tab is closed. The `pagehide` and hidden handlers cover the normal tab switch and close cases before unmount.
- `init` and a new `autoSaveConfig` message carry `{ mode, delay }` and call `scheduler.configure`.

The dirty check uses refs (`hostDirtyRef`, `editedSinceSaveRef`), because the event handlers are registered once.

### 4. Host side: read and push the setting

`markdownEditorProvider.ts` reads `janus.autoSave` and `janus.autoSaveDelay` with the document URI as scope (the settings have `resource` scope) and adds them to `init`. In `onDidChangeConfiguration`, `e.affectsConfiguration('janus.autoSave', document.uri)` or `('janus.autoSaveDelay', document.uri)` posts `autoSaveConfig`. An unknown mode falls back to `afterDelay`. The existing error message for a failed save is unchanged and covers auto-save too.

### 5. Chart editor saves after each edit

After `applyEdit` in `updateChart`, call `document.save()` the same way as the tasks editor, inside the existing `try`, so a failure shows the existing `Failed to update chart` message. No setting: each chart change is a discrete user action, not keystrokes.

### 6. Settings panel

`JanusSettingsState` gets `autoSave` and `autoSaveDelay`. A new section `4. Editor` in `SettingsApp.tsx` has a select (`Aus` / `Nach Verzögerung` / `Bei Fokuswechsel`) and a number input (disabled unless `afterDelay`, committed on blur or Enter, clamped to 250). `settingsViewProvider.ts` stores the values with the same configuration target logic as the existing toggles.

### 7. Settings in `package.json`

```
janus.autoSave       enum off | afterDelay | onFocusChange, default afterDelay, scope resource
janus.autoSaveDelay  number, default 1000, minimum 250, scope resource
```

With `enumDescriptions` in German, matching the panel labels.

## Risks / Trade-offs

- [Behavior change: notes are saved without asking after the update] → Documented in the README and changelog; `off` restores the old behavior.
- [Every save runs the linked task sync and other save listeners] → They write only on a real change; with a 1 s pause the save rate is low. If it becomes a problem, a later change can defer the task sync (option C from the exploration).
- [VS Code `files.autoSave` also enabled] → VS Code may save a slightly older state first; Janus auto-save follows within the delay with the full state. No data loss, at most one extra save.
- [Save on `pagehide` while the webview is being torn down] → The `save` message may not reach the host; the document then stays dirty and VS Code asks on close, as today.
- [Half-typed linked task titles are synced to `tasks.json`] → Corrected by the next save; accepted.
