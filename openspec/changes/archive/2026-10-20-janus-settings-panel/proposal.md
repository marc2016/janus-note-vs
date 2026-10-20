# Proposal

## Why

The AI model selector dropdown (`[KI: <Model> ▾]`) currently resides inside every Markdown note's bottom footer bar (`NotesLinksFooter`), taking up horizontal space alongside note-specific actions even though AI provider, model, API keys, and workspace settings are configured globally or per workspace. Furthermore, standard VS Code settings (`⌘,`) cannot render encrypted `SecretStorage` API keys or dynamically discovered Copilot and Ollama models, making a dedicated **Janus Settings Panel** (opened via a gear icon in the Janus sidebar header) a much cleaner and more capable home for all Janus configuration.

## What Changes

- Introduce a dedicated **Janus Settings Panel** (`SettingsViewProvider`, `janus.openSettings` command) opened from a `$(gear)` icon in the Notes sidebar header (`view/title`) or via the Command Palette (`Janus: Einstellungen öffnen`).
- Provide a unified React settings UI (`src/webviews/settings/`) covering:
  - **AI Provider & Model Selection**: Dropdowns for provider (`vscode-lm`, `ollama`, `openai`, `anthropic`, `gemini`, `custom`) and model (with live discovery of VS Code Language Models and local Ollama models, plus custom model ID input).
  - **Encrypted API Key Management**: Input fields and clear actions for OpenAI, Anthropic, Gemini, and Custom endpoint API keys backed by VS Code `SecretStorage` (`context.secrets`), showing key presence status without exposing raw keys in settings files.
  - **Endpoint Base URLs**: Editable inputs for `janus.ai.ollamaBaseUrl` and `janus.ai.customBaseUrl`.
  - **AI Behavior Preferences**: Toggle for `janus.ai.inboxSortConfirm` (preview confirmation before sorting `inbox.md`).
  - **Workspace Notes Root**: Display of the active `janus.notesRoot` path with quick actions to change or reset the notes folder.
- Remove the AI model selector button (`onSelectAiModel`) from the Markdown editor footer bar (`NotesLinksFooter.tsx`), leaving the footer focused strictly on note-level actions (`Aufgaben generieren`, `Inbox einsortieren`, `Ordner-Aufgaben`, `+ Diagramm`, `Verknüpfen`).
- Route error recovery actions (`KI-Modell konfigurieren` in toast notifications) directly to the new Janus Settings Panel (`janus.openSettings`).

## Capabilities

### New Capabilities
- `settings-panel`: Interactive Janus Settings Webview Panel (`janus.openSettings`) for configuring AI providers, dynamically discovered models, encrypted `SecretStorage` API keys, endpoint URLs, AI behavior toggles, and workspace notes root settings.

### Modified Capabilities
- `markdown-editor`: Remove the AI model selector badge from the Markdown editor footer bar (`NotesLinksFooter`) so the footer only contains note-specific actions and links.
- `notes-sidebar`: Add a settings gear button (`janus.openSettings`) to the Notes TreeView header bar (`view/title`).

## Impact

- **UI & Webviews**: New `src/editors/settingsViewProvider.ts` and `src/webviews/settings/` entry point (`settings.js` in `esbuild.js`); simplified `src/webviews/markdown/components/NotesLinksFooter.tsx` and `src/webviews/markdown/MarkdownEditorApp.tsx`.
- **Services & Commands**: `src/services/aiModelService.ts`, `src/editors/markdownEditorProvider.ts`, `src/extension.ts`, and `package.json` (`janus.openSettings` command and `view/title` menu entry).
- **Tests**: New unit tests in `tests/settingsViewProvider.test.ts` and updated tests in `tests/aiTaskGeneration.test.ts`.

