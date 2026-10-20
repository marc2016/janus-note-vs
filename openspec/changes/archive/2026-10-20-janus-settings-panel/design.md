# Design

## Context

See `proposal.md` for motivation. Currently:
- `NotesLinksFooter.tsx` renders an AI model selector button (`onSelectAiModel`) next to `Aufgaben generieren` and `Inbox einsortieren`, which triggers `AiModelService.selectModelInteractive()` (a multi-step QuickPick/InputBox chain).
- `AiModelService` (`src/services/aiModelService.ts`) already encapsulates reading/writing `janus.ai.provider`, `janus.ai.modelId`, `janus.ai.ollamaBaseUrl`, `janus.ai.customBaseUrl`, `SecretStorage` API keys (`getApiKey`/`setApiKey`), and discovering models via `discoverVsCodeLmModels()` and `discoverOllamaModels()`.
- `GlobalTasksViewProvider` (`src/editors/globalTasksViewProvider.ts`) establishes the pattern for a singleton Webview Panel in Janus Note backed by an `esbuild.js` browser bundle and Tailwind CSS (`dist/webviews/globals.css`).

## Goals / Non-Goals

**Goals:**
- Provide a dedicated singleton Webview Panel (`SettingsViewProvider`, `viewType = 'janus.settingsView'`) opened via `janus.openSettings` (wired to a `$(gear)` icon in `view/title` of `janus.notesView` and the Command Palette).
- Allow full interactive configuration of AI provider, model (including discovered VS Code LM and Ollama models + custom model ID input), `SecretStorage` API keys (with boolean `hasApiKey` status), endpoint URLs, `janus.ai.inboxSortConfirm`, and `janus.notesRoot`.
- Remove the AI model selector button from `NotesLinksFooter.tsx` so the Markdown editor footer only displays note-specific actions and links.

**Non-Goals:**
- Exposing raw stored API key strings back to the webview DOM (the webview only receives `hasApiKey: boolean` per provider, and sends new keys or clear commands to the extension host).
- Replacing `AiModelService` internal completion logic.

## Decisions

### 1. Singleton `SettingsViewProvider` Webview Panel (`src/editors/settingsViewProvider.ts`)
- **Decision**: Implement `SettingsViewProvider` following the same singleton `vscode.WebviewPanel` pattern as `GlobalTasksViewProvider` (`src/editors/globalTasksViewProvider.ts`), bundled via a new `settings: 'src/webviews/settings/index.tsx'` entry point in `esbuild.js`.
- **Rationale**: A full editor tab provides ample space for provider/model dropdowns, password inputs for API keys, URL inputs, and workspace folder controls without crowding the sidebar tree view or note footer.
- **Alternatives considered**:
  - *Sidebar `WebviewViewProvider` below the Notes tree*: Constrains horizontal width for URLs and API key inputs and consumes permanent vertical space in the sidebar.
  - *Native VS Code Settings UI (`workbench.action.openSettings`)*: Cannot read/write `SecretStorage` API keys or populate dropdowns with runtime-discovered Copilot/Ollama models.

### 2. Message Protocol Between Settings Webview and Extension Host
- **Decision**: Use a structured message protocol between `SettingsApp.tsx` and `SettingsViewProvider`:
  - `ready` / `refreshModels` → Extension sends `settingsState` containing:
    - `provider`, `modelId`, `activeModelLabel`, `ollamaBaseUrl`, `customBaseUrl`, `inboxSortConfirm`
    - `apiKeyStatus: Record<AiProviderType, boolean>` (never sending raw secret strings to the webview)
    - `discoveredModels: { vscodeLm: AiModelInfo[]; ollama: AiModelInfo[] }`
    - `notesRoot: string`
  - `updateAiConfig` (`{ provider?, modelId?, ollamaBaseUrl?, customBaseUrl?, inboxSortConfirm? }`) → Updates `janus.ai.*` configuration and refreshes state.
  - `saveApiKey` (`{ provider, apiKey }`) / `clearApiKey` (`{ provider }`) → Stores or deletes the key in `SecretStorage` via `AiModelService.setApiKey(...)` and sends updated `settingsState`.
  - `setNotesRoot` / `resetNotesRoot` → Invokes `janus.setNotesRoot` / `janus.resetNotesRoot` and refreshes `settingsState`.
- **Rationale**: Keeps all `vscode.workspace.getConfiguration` and `SecretStorage` operations strictly in the extension host while giving the React UI immediate reactive state updates.

### 3. Removing Model Selector from `NotesLinksFooter` and Routing Error Prompts to `janus.openSettings`
- **Decision**: Remove the `onSelectAiModel` button from `NotesLinksFooter.tsx` and update the `'KI-Modell konfigurieren'` error toast action in `MarkdownEditorProvider` (and the `janus.selectAiModel` command) to open the Settings Panel (`janus.openSettings`).
- **Rationale**: Declutters the Markdown note footer while ensuring users have a single, consistent place to configure AI settings.

## Risks / Trade-offs

- **[Risk] Slow Ollama discovery when local server is offline** → `discoverOllamaModels()` already uses a 2500ms timeout and returns `[]` on error; `SettingsViewProvider` can send initial config immediately and update discovered models asynchronously if needed.
- **[Risk] API key security in webview** → Never send raw API keys from `SecretStorage` to the webview; only send `hasApiKey: boolean` and accept write-only `saveApiKey` / `clearApiKey` messages.

