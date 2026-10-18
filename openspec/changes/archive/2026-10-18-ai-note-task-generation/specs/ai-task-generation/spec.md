# Spec Delta

## Purpose

Provides multi-provider AI model discovery, selection, credential management, and automated extraction of actionable tasks from Markdown notes into folder-level `tasks.json` files without duplicating existing folder tasks.

## ADDED Requirements

### Requirement: Multi-Provider AI Model Discovery and Selection
The system SHALL support discovering, selecting, and persisting an active AI model across multiple provider backends: VS Code Language Models (`vscode.lm` including GitHub Copilot and VS Code Chat models), local Ollama models (`http://localhost:11434`), and direct cloud/OpenAI-compatible providers (OpenAI, Anthropic, Google Gemini, Custom URL).

#### Scenario: Discovering VS Code Language Models and local Ollama models
- **WHEN** user opens the AI model selector
- **THEN** system lists available models from `vscode.lm.selectChatModels`, locally installed Ollama models (if reachable), configured cloud provider models, and an option to configure API keys or endpoints

#### Scenario: Persisting selected AI model
- **WHEN** user selects a model in the AI model selector
- **THEN** system persists the selected provider and model identifier in workspace/user configuration and updates the active model badge in open note editors

### Requirement: Secure API Key Storage for Direct Providers
The system SHALL store API keys for direct cloud providers (OpenAI, Anthropic, Google Gemini, Custom OpenAI-compatible) in VS Code `SecretStorage` (`context.secrets`) rather than plaintext workspace settings.

#### Scenario: Saving an API key for a direct provider
- **WHEN** user selects the option to configure an API key for OpenAI, Anthropic, Gemini, or a custom endpoint
- **THEN** system prompts for the secret via a masked input box and stores it in `context.secrets`

### Requirement: Context-Aware Task Extraction from Note to Folder Tasks
The system SHALL extract actionable tasks (`title`, `priority: 'low' | 'medium' | 'high'`, `status: 'todo'`) from the active Markdown note using the currently configured AI model and append only new, non-duplicate tasks to the containing folder's `tasks.json`.

#### Scenario: Generating tasks from a Markdown note into folder tasks.json
- **WHEN** user triggers task generation on a Markdown note whose folder already has 2 existing tasks in `tasks.json`
- **THEN** system sends the note content and existing folder task titles to the active AI model, validates the returned tasks against `TaskItemSchema`, appends only the newly identified tasks to `<folder>/tasks.json`, and refreshes the editor footer and sidebar task counts

#### Scenario: Handling missing or unconfigured AI model gracefully
- **WHEN** user triggers task generation but no AI model is available or configured
- **THEN** system prompts the user to select an available model or configure an AI provider before running extraction

