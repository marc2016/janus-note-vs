# Tasks

## 1. SettingsViewProvider & Extension Wiring

- [x] 1.1 Create `src/editors/settingsViewProvider.ts` (`SettingsViewProvider` with `viewType = 'janus.settingsView'`) implementing singleton panel creation/reveal, `getSettingsState()`, and webview message handling (`ready`, `refreshModels`, `updateAiConfig`, `saveApiKey`, `clearApiKey`, `setNotesRoot`, `resetNotesRoot`), verifying via unit tests in `tests/settingsViewProvider.test.ts`.
- [x] 1.2 Add `janus.openSettings` command (`Janus: Einstellungen öffnen`, icon `$(gear)`) and `view/title` menu entry in `package.json`, and wire `SettingsViewProvider` in `src/extension.ts` (including routing `janus.selectAiModel` and error notification actions in `src/editors/markdownEditorProvider.ts` to `janus.openSettings`), verifying with `npm run compile`.

## 2. Settings Webview React App & Footer Cleanup

- [x] 2.1 Create `src/webviews/settings/index.tsx` and `src/webviews/settings/SettingsApp.tsx` with sections for AI Provider & Model selection (including discovered VS Code LM and Ollama models + custom model ID input), `SecretStorage` API key input/clear controls with saved status indicators, Ollama/Custom endpoint URLs, `janus.ai.inboxSortConfirm` checkbox, and `janus.notesRoot` controls, and register the `settings` entry point in `esbuild.js`, verifying with `npm run build`.
- [x] 2.2 Remove the AI model selector button (`onSelectAiModel`) from `src/webviews/markdown/components/NotesLinksFooter.tsx` and `src/webviews/markdown/MarkdownEditorApp.tsx` so the Markdown footer only displays note-specific actions and links, verifying with `npm run build`.

## 3. Verification & Test Suite

- [x] 3.1 Add unit tests in `tests/settingsViewProvider.test.ts` covering singleton open/reveal, provider/model updates, `SecretStorage` API key save/clear without leaking raw secrets, inbox sort confirm toggle, and notes root command forwarding, and verify `npm test` and `npm run build` pass with zero errors.


