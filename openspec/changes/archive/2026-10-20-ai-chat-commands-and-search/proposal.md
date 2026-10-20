# Proposal

## Why

Currently, the `@janus` chat participant in VS Code only sees the single active editor document, does not execute tool calls returned by the language model, and offers no slash commands or workspace-wide search across notes and tasks. Adding a reusable search and context service (`JanusSearchService`) together with `@janus` slash commands (`/search`, `/tasks`, `/summarize`, `/inbox`) and a `janus_search_notes` tool unlocks workspace-wide Q&A, note discovery, task management, and summarization in Copilot Chat while laying the shared backend foundation for a future standalone Janus Chat view.

## What Changes

- **New Workspace Note & Task Search Service (`JanusSearchService`)**:
  - Indexes and searches all Markdown notes (`meetings/`, `projects/`, `knowledge/`, `inbox.md`) and folder task files (`tasks.json`) in the configured `notesRoot`.
  - Ranks results by title, folder path, heading matches, and body/task content snippets so the AI receives the most relevant context without overflowing token limits.
- **`@janus` Chat Participant Slash Commands**:
  - Register `/help`, `/search`, `/tasks`, `/summarize`, and `/inbox` under `contributes.chatParticipants` in `package.json`.
  - `/help`: Displays a formatted overview of all available `@janus` slash commands, example prompts, and quick-action buttons.
  - `/search`: Searches notes and tasks across the workspace, answers the user's question using matched context, and renders clickable action buttons that open matching notes directly in the Janus Rich Markdown Editor (`janus.markdownEditor`).
  - `/tasks`: Queries open/completed tasks across folders or triggers AI task extraction for the active/specified note.
  - `/summarize`: Summarizes the active note, a specified note, or all notes within a folder (e.g., `projects/App-Launch`).
  - `/inbox`: Summarizes current `inbox.md` entries and offers one-click or direct AI inbox sorting via `AiInboxSorterService`.
- **Language Model Tool `janus_search_notes` & Tool-Call Loop**:
  - Register `janus_search_notes` via `vscode.lm.registerTool` and `package.json` (`contributes.languageModelTools`) so free-form `@janus` prompts (and Copilot edits/agent mode) can search Janus notes and tasks automatically.
  - Upgrade `JanusChatParticipant` to execute `vscode.LanguageModelToolCallPart` tool invocations in a loop and feed tool results back to the model.

## Capabilities

### New Capabilities
- `ai-note-search`: Workspace-wide search and context retrieval across Markdown notes and folder `tasks.json` companions with relevance scoring and snippet extraction.

### Modified Capabilities
- `agent-tools`: Extend `@janus` chat participant with `/search`, `/tasks`, `/summarize`, and `/inbox` slash commands, multi-turn `LanguageModelToolCallPart` execution, clickable Janus Editor open buttons, and the `janus_search_notes` Language Model Tool.

## Impact

- **`package.json`**: Adds `commands` (`/search`, `/tasks`, `/summarize`, `/inbox`) to `contributes.chatParticipants` (`janus`) and adds `janus_search_notes` to `contributes.languageModelTools`.
- **`src/services/janusSearchService.ts` (new)**: Reusable search & context aggregation service for notes and tasks (designed to be shared with the upcoming standalone Janus Chat UI).
- **`src/agent/tools/searchNotesTool.ts` (new)**: Implements `vscode.LanguageModelTool` for `janus_search_notes`.
- **`src/agent/chatParticipant.ts`**: Adds slash command handlers (`/search`, `/tasks`, `/summarize`, `/inbox`), tool-calling loop support, fallback to `AiModelService` when appropriate, and interactive response buttons (`janus.openMarkdownEditor`, `janus.openFolderTasks`, `janus.sortInbox`, `janus.generateTasksFromNote`).
- **`src/extension.ts`**: Instantiates `JanusSearchService`, registers `SearchNotesTool`, and wires services into `JanusChatParticipant`.
- **`tests/`**: Unit tests for `JanusSearchService`, `SearchNotesTool`, and `JanusChatParticipant` slash commands and tool-call loop.

