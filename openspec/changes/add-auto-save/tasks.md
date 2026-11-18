# Tasks

## 1. Settings

- [ ] 1.1 Add `janus.autoSave` (enum `off` / `afterDelay` / `onFocusChange`, default `afterDelay`, German `enumDescriptions`, scope `resource`) and `janus.autoSaveDelay` (number, default `1000`, minimum `250`, scope `resource`) to `package.json` (design.md decision 7); verify with `npm run compile` and that both settings appear in VS Code's settings UI under Janus Note

## 2. Auto-save in the Markdown editor

- [ ] 2.1 Add `src/webviews/markdown/lib/autoSave.ts` with `createAutoSaveScheduler` (`configure`, `onLocalEdit`, `onFocusLost`, `dispose`, injected timers, delay clamped to 250) per design.md decision 2; add `tests/autoSave.test.ts` with fake timers covering: save after the delay, timer restart on further edits, no save while typing continuously, immediate save on focus loss in `afterDelay` and `onFocusChange`, no timer save in `onFocusChange`, nothing in `off`, reconfiguring at runtime, delay clamping; verify with `npx vitest run tests/autoSave.test.ts`
- [ ] 2.2 Host: read both settings with the document URI as scope in `markdownEditorProvider.ts`, add them to `init`, post `autoSaveConfig` from `onDidChangeConfiguration` when they change, fall back to `afterDelay` for unknown values (design.md decision 4); extend the host tests (e.g. `tests/editorSave.test.ts` or `tests/markdownEditor.test.ts`) for the `init` payload and the config change message; verify with `npx vitest run`
- [ ] 2.3 Webview: create the scheduler in `MarkdownEditorApp.tsx`, call `onLocalEdit` from the update listener, `onFocusLost` from blur, hidden and `pagehide` (keep the plain flush in `off` mode), skip saving when neither `hostDirty` nor pending edits (refs), configure from `init` and `autoSaveConfig`, no save on unmount (design.md decision 3); verify with `npm run build` and `npx vitest run`
- [ ] 2.4 Mention Janus auto-save in the README (editor section): the modes, the default `afterDelay`, `off` for the old behavior, and that it is independent of VS Code's `files.autoSave`; verify the README section reads correctly

## 3. Diagram editor

- [ ] 3.1 Call `document.save()` after `applyEdit` in `updateChart` in `chartEditorProvider.ts`, inside the existing `try` (design.md decision 5); add a test (new `tests/chartEditorProvider.test.ts` with the vscode mock, modeled on `tests/tasksEditorProvider.test.ts`) that an `updateChart` message applies the edit and saves, and that a failing save shows the error message; verify with `npx vitest run tests/chartEditorProvider.test.ts`

## 4. Settings panel

- [ ] 4.1 Add `autoSave` and `autoSaveDelay` to `JanusSettingsState` and the state builder in `settingsViewProvider.ts`, handle their update messages with the existing configuration target logic and clamp the delay to 250 (design.md decision 6); extend `tests/settingsViewProvider.test.ts` for reading the defaults, storing a mode, storing a delay and clamping `100` to `250`; verify with `npx vitest run tests/settingsViewProvider.test.ts`
- [ ] 4.2 Add section `4. Editor` to `SettingsApp.tsx` with the mode select (`Aus` / `Nach Verzögerung` / `Bei Fokuswechsel`) and the delay input (disabled unless `afterDelay`, committed on blur or Enter), with a short hint naming `janus.autoSave`; verify with `npm run build`

## 5. Verification

- [ ] 5.1 Run `npm test` and `npm run build`; all tests pass
- [ ] 5.2 Manual check in the sample workspace: with the default, type in a note and pause, the unsaved marker disappears after about a second and the file on disk is updated; type and switch tabs immediately, the text is on disk; with `onFocusChange` the note stays unsaved while typing and is saved on tab switch; with `off` nothing saves automatically; changing the mode and delay in the settings panel takes effect in an already open note; a linked task line (`/aufgabe`) is synced to `tasks.json` after the pause; editing a diagram in a `*.chart.json` leaves no unsaved marker
