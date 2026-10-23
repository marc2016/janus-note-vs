# janus-chat-view Specification

## Purpose
Provides a dedicated, provider-independent AI Chat and Workspace Search WebviewView (`janus.chatView`) inside the Janus Activity Bar sidebar, allowing users to search notes, ask questions, manage tasks, summarize notes/folders, and sort the inbox using any configured Janus AI model (`AiModelService`).

## Requirements

### Requirement: Provider-Independent Sidebar Chat WebviewView
The system SHALL register a WebviewView (`janus.chatView`) inside the Janus Activity Bar sidebar that processes user messages and slash commands using the active AI provider configured in `AiModelService` (VS Code LM, Ollama, OpenAI, Anthropic, Gemini, or Custom) and displays the currently active model in the view header with a shortcut to open Janus Settings (`janus.openSettings`).

#### Scenario: Sending a question in the Janus Sidebar Chat
- **WHEN** the user types a question into the Janus Sidebar Chat and submits it
- **THEN** the view retrieves relevant workspace context via `JanusSearchService`, calls `AiModelService.completePrompt`, and renders the AI response along with clickable source note cards

#### Scenario: Displaying active AI model and opening settings
- **WHEN** the Janus Sidebar Chat view is rendered or the active AI model changes
- **THEN** the header displays the active model label (e.g. `Ollama: llama3.3` or `Gemini: gemini-2.5-flash`) and clicking the model badge opens the Janus Settings Panel (`janus.openSettings`)

### Requirement: Slash Commands and Quick-Action Chips in Sidebar Chat
The system SHALL support `/search`, `/tasks`, `/summarize`, `/inbox`, and `/help` slash commands in the Janus Sidebar Chat both via text input and via one-click quick-command chips above the input box.

#### Scenario: Executing slash commands in Sidebar Chat
- **WHEN** the user clicks a quick-command chip or submits `/search <query>`, `/tasks`, `/summarize [target]`, `/inbox`, or `/help`
- **THEN** the Sidebar Chat executes the corresponding workflow using `JanusSearchService` and `FolderTasksService` and displays the formatted response and contextual action buttons

### Requirement: Interactive Source Note Cards Opening Janus WYSIWYG Editor
The system SHALL render matched workspace notes below search and Q&A responses as clickable source cards displaying the note title, relative path, and snippet preview, opening the note directly in `janus.markdownEditor` when clicked.

#### Scenario: Clicking a source note card in Sidebar Chat
- **WHEN** a search or Q&A response includes matched notes and the user clicks a source note card
- **THEN** the system opens the selected Markdown note directly in the Janus Rich Markdown Editor (`janus.markdownEditor`)

