# Proposal

## Why

The native VS Code `@janus` chat participant requires a VS Code Chat host (such as GitHub Copilot Chat) to be active and cannot be used standalone inside the Janus sidebar when running solely with local Ollama, Gemini, OpenAI, Anthropic, or Custom AI endpoints. Adding a dedicated, built-in **Janus KI & Suche** WebviewView directly inside the Janus Activity Bar sidebar enables provider-independent AI search, Q&A, task management, summarization, and inbox assistance right below the notes tree—reusing `JanusSearchService` and `AiModelService`.

## What Changes

- **Janus Sidebar Chat & Search WebviewView (`janus.chatView`)**:
  - Register a WebviewView (`janus.chatView`, `"type": "webview"`) in the `janus-notes` Activity Bar container alongside `janus.notesView` in `package.json`, plus a `janus.focusChatView` command to focus the chat view from anywhere.
  - Display the active AI model badge in the chat header with a 1-click button to open Janus Settings (`janus.openSettings`) and a button to clear chat history.
- **Shared AI Chat & Search Execution via `AiModelService` and `JanusSearchService`**:
  - Support both free-form questions (with automatic workspace note/task retrieval) and slash commands (`/search`, `/tasks`, `/summarize`, `/inbox`, `/help`) directly in the Janus Chat Webview.
  - Render clickable quick-command chips (`/search`, `/tasks`, `/summarize`, `/inbox`, `/help`) above the chat input so users can trigger AI workflows with one click.
- **Interactive Source Note Cards & Action Buttons**:
  - Render matched notes as compact source cards showing the note title, relative path badge, and snippet, opening the note directly in the Janus Rich Markdown Editor (`janus.markdownEditor`) when clicked.
  - Render contextual action buttons on AI responses (e.g. *Alle Aufgaben öffnen*, *Ordner-Aufgaben öffnen*, *Aufgaben aus Notiz generieren*, *Inbox einsortieren*).

## Capabilities

### New Capabilities
- `janus-chat-view`: Built-in Sidebar WebviewView for provider-independent AI chat, workspace search, slash commands (`/search`, `/tasks`, `/summarize`, `/inbox`, `/help`), and interactive note/task cards.

### Modified Capabilities
- `notes-sidebar`: Extend the Janus Activity Bar View Container (`janus-notes`) to host both the Notes TreeView (`janus.notesView`) and the Janus AI & Search WebviewView (`janus.chatView`).

## Impact

- **`package.json`**: Adds `janus.chatView` (`"type": "webview"`) under `contributes.views.janus-notes` and `janus.focusChatView` under `contributes.commands`.
- **`esbuild.js`**: Adds `chat: 'src/webviews/chat/index.tsx'` to the webview entry points.
- **`src/editors/chatViewProvider.ts` (new)**: Implements `vscode.WebviewViewProvider` for `janus.chatView`, handling chat messages, slash commands (`/search`, `/tasks`, `/summarize`, `/inbox`, `/help`), `AiModelService` completion calls, `JanusSearchService` retrieval, and editor navigation commands.
- **`src/webviews/chat/JanusChatApp.tsx` & `src/webviews/chat/index.tsx` (new)**: React UI for the sidebar chat with model badge, quick-command pills, message bubbles, clickable source note cards, action buttons, and loading state.
- **`src/extension.ts`**: Registers `ChatViewProvider` with `vscode.window.registerWebviewViewProvider` and `janus.focusChatView`.
- **`tests/chatViewProvider.test.ts` (new)**: Unit tests for `ChatViewProvider` message handling, slash commands, search cards, and `AiModelService` integration.

