# settings-panel Specification

## Purpose

Provides a dedicated, interactive Janus Settings Webview Panel (`janus.openSettings`) for configuring AI providers, dynamically discovered language models, encrypted API keys in VS Code SecretStorage, endpoint base URLs, AI inbox sorting preferences, and workspace notes root settings.

## Requirements

### Requirement: Dedicated Janus Settings Webview Panel
The system SHALL provide a singleton Webview Panel (`janus.settingsView`) opened via the `janus.openSettings` command or the gear button in the Notes sidebar header, displaying all Janus Note and AI settings in a structured interface.

#### Scenario: Opening the Settings Panel from the sidebar or command palette
- **WHEN** the user clicks the gear icon (`$(gear)`) in the Notes sidebar header or executes `janus.openSettings`
- **THEN** the system opens or reveals the `Janus Einstellungen` Webview Panel populated with the current AI provider, model, API key status, endpoint URLs, AI behavior toggles, and workspace notes root configuration

#### Scenario: Revealing an already open Settings Panel
- **WHEN** the Settings Panel is already open and the user invokes `janus.openSettings` again
- **THEN** the existing Settings Panel tab is revealed and refreshed instead of opening a duplicate tab

### Requirement: AI Provider, Model Selection, and Dynamic Model Discovery in Settings Panel
The system SHALL allow users to select the active AI provider (`vscode-lm`, `ollama`, `openai`, `anthropic`, `gemini`, `custom`) and model inside the Settings Panel, dynamically listing available VS Code Language Models (`vscode.lm`) and local Ollama models alongside a custom model ID input.

#### Scenario: Selecting an AI provider and model in the Settings Panel
- **WHEN** the user selects an AI provider and chooses or enters a model ID in the Settings Panel
- **THEN** the system persists `janus.ai.provider` and `janus.ai.modelId` in configuration and updates the active model state

#### Scenario: Refreshing dynamically discovered models
- **WHEN** the user switches to `vscode-lm` or `ollama` (or clicks refresh models) in the Settings Panel
- **THEN** the system queries available models from `vscode.lm` or the configured Ollama server URL and populates the model selection list

### Requirement: Secure API Key and Endpoint Configuration in Settings Panel
The system SHALL allow users to save and clear provider API keys (`openai`, `anthropic`, `gemini`, `custom`) directly in the Settings Panel using VS Code `SecretStorage` (`context.secrets`), displaying whether a key is currently stored without exposing the raw secret in plaintext settings files, and allow editing `janus.ai.ollamaBaseUrl` and `janus.ai.customBaseUrl`.

#### Scenario: Saving an API key in the Settings Panel
- **WHEN** the user enters an API key for `openai`, `anthropic`, `gemini`, or `custom` and clicks Save
- **THEN** the system stores the key in `SecretStorage` under `janus.ai.apiKey.<provider>` and updates the Settings Panel status badge to indicate that a key is configured

#### Scenario: Clearing a stored API key in the Settings Panel
- **WHEN** the user clicks Clear/Delete for a stored provider API key in the Settings Panel
- **THEN** the system removes `janus.ai.apiKey.<provider>` from `SecretStorage` and updates the status indicator accordingly

### Requirement: AI Behavior and Workspace Notes Root Controls in Settings Panel
The system SHALL allow users to toggle `janus.ai.inboxSortConfirm` (preview before inbox sorting) and view, change, or reset the workspace `janus.notesRoot` folder directly from the Settings Panel.

#### Scenario: Toggling inbox sort confirmation in the Settings Panel
- **WHEN** the user toggles the inbox sort preview checkbox in the Settings Panel
- **THEN** the system updates `janus.ai.inboxSortConfirm` in workspace/global configuration immediately

#### Scenario: Triggering notes root change or reset from the Settings Panel
- **WHEN** the user clicks the button to change or reset the notes folder in the Settings Panel
- **THEN** the system executes `janus.setNotesRoot` or `janus.resetNotesRoot` and refreshes the displayed notes root path in the Settings Panel
