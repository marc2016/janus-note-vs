# Proposal

## Why

Notes written in the Janus Markdown Editor stay unsaved until the user presses `Cmd+S`/`Ctrl+S` or the save button, so other views (calendar, sidebar, task list, links) only see the change later, and closing VS Code asks about unsaved notes. VS Code's own `files.autoSave` does not fit the editor well: it saves on its own timer, possibly before the editor has sent its last edits, and it applies to every file in the workspace. The diagram editor (`*.chart.json`) never saves on its own at all, while the task list editor already saves every change immediately.

## What Changes

- **Auto-save in the Markdown editor:** new setting `janus.autoSave` with the values `off`, `afterDelay` and `onFocusChange`, **default `afterDelay`**. With `afterDelay` the note is saved after the user has stopped typing for `janus.autoSaveDelay` milliseconds (default `1000`) and additionally when focus leaves the editor or the tab is hidden or closed. With `onFocusChange` the note is saved only when focus leaves the editor or the tab is hidden or closed. Auto-save uses the same path as the save button, so all pending edits are applied before saving.
- The save button, `Cmd+S`/`Ctrl+S` and the unsaved marker stay as they are. A failed auto-save shows the same error message as a failed manual save.
- **Behavior change for existing users:** because the default is `afterDelay`, notes are saved without a manual save after updating. `off` restores the previous behavior.
- `janus.autoSave` is independent of VS Code's `files.autoSave`; Janus does not change VS Code settings.
- **Diagram editor saves immediately:** every change made in the `*.chart.json` editor is written to disk right away, like in the task list editor. No setting.
- **Settings panel:** the auto-save mode and the delay can be changed in the Janus settings panel.
- The `companion-editors` spec is corrected: the task list editor saves changes immediately instead of leaving the document unsaved.

Not part of this change: auto-save for files opened in VS Code's own text editor, and skipping the linked task synchronization for auto-saves.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirement for auto-save of notes, and the save requirement mentions Janus auto-save.
- `companion-editors`: the task list editor and the diagram editor save every change immediately.
- `settings-panel`: new controls for `janus.autoSave` and `janus.autoSaveDelay`.

## Impact

- `package.json`: new settings `janus.autoSave` (enum, default `afterDelay`, scope `resource`) and `janus.autoSaveDelay` (number, default `1000`, minimum `250`, scope `resource`).
- `src/editors/markdownEditorProvider.ts`: send the auto-save settings to the webview on `init` and when they change.
- `src/webviews/markdown/MarkdownEditorApp.tsx` plus a new small module for the auto-save timing logic, built on the existing `requestSave()`, flush-on-blur and flush-on-hide code.
- `src/editors/chartEditorProvider.ts`: save after applying a chart edit.
- `src/editors/settingsViewProvider.ts` and `src/webviews/settings/SettingsApp.tsx`: new controls.
- Saves happen more often, so the linked task sync (`linkedTaskSync.ts`) and save listeners run more often; they already write only when something changes. No new dependencies.
