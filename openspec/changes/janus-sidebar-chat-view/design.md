# Design

## Context

See `proposal.md` for motivation. Change 1 (`ai-chat-commands-and-search`) introduced `JanusSearchService` (`src/services/janusSearchService.ts`) with relevance-ranked workspace note and task search, folder/note summarization context, and inbox context. In Change 2, we add a built-in Sidebar WebviewView (`janus.chatView`) in the Janus Activity Bar container (`janus-notes`) that connects directly to `JanusSearchService`, `FolderTasksService`, and `AiModelService`.

## Goals / Non-Goals

**Goals:**
- Provide a compact, responsive React WebviewView (`janus.chatView`) directly below the Notes TreeView in the Janus Activity Bar sidebar.
- Run 100% independently of GitHub Copilot Chat by routing all completions through `AiModelService.completePrompt` (supporting Ollama, Gemini, OpenAI, Anthropic, Custom, and VS Code LM).
- Support `/search`, `/tasks`, `/summarize`, `/inbox`, `/help`, and free-form Q&A with clickable source note cards (opening `janus.markdownEditor`) and action buttons (`janus.openAllTasks`, `janus.openFolderTasks`, `janus.generateTasksFromNote`, `janus.sortInbox`, `janus.openSettings`).

**Non-Goals:**
- Persistent multi-session chat history files on disk (in-memory conversation history within the retained WebviewView session is sufficient and keeps the notes folder clean).

## Decisions

### 1. `vscode.WebviewViewProvider` in the `janus-notes` Container
- **Decision**: Register `janus.chatView` (`"type": "webview"`, `"name": "KI & Suche"`) under `contributes.views.janus-notes` in `package.json` and implement `ChatViewProvider` (`src/editors/chatViewProvider.ts`) using `vscode.window.registerWebviewViewProvider('janus.chatView', chatViewProvider, { webviewOptions: { retainContextWhenHidden: true } })`.
- **Rationale**: Placing the chat view inside the `janus-notes` sidebar container lets users see their note hierarchy on top and search/chat right below without switching Activity Bar tabs.

### 2. Shared Command & RAG Pipeline in `ChatViewProvider`
- **Decision**: `ChatViewProvider` parses leading slash commands (`/search`, `/tasks`, `/summarize`, `/inbox`, `/help`) from the user's message. If no slash command is given, it defaults to a RAG-augmented chat turn that queries `JanusSearchService.searchWorkspace(text)` and includes the top matching notes and tasks in the prompt sent to `AiModelService.completePrompt(...)`.
- **Structured Assistant Messages**: Each assistant reply posted to the webview includes:
  - `text`: Markdown/formatted text answer
  - `sources`: Array of `{ title, relativePath, uri, snippet }` for interactive source note cards
  - `actions`: Array of `{ label, actionType, uri? }` for 1-click command execution (`openAllTasks`, `openFolderTasks`, `generateTasksFromNote`, `sortInbox`, `openSettings`, `openNote`).

## Risks / Trade-offs

- **[Risk] Narrow width inside the VS Code Sidebar** → **Mitigation**: Design `JanusChatApp.tsx` specifically for narrow sidebar widths (compact header, horizontally scrollable/wrappable quick-command chips, concise source cards with line-clamped snippets).

