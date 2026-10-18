# Design

## Context

See `proposal.md` for motivation. Currently:
- The Markdown editor renders `NotesLinksFooter` (`src/webviews/markdown/components/NotesLinksFooter.tsx`) showing folder-level task status (`<folder>/tasks.json`), note diagram status (`<note>.chart.json`), outgoing links, and incoming backlinks.
- Tasks are organized strictly per folder (`<folder>/tasks.json` via `FolderTasksService`), while `MutateTasksTool` and `ReadNoteTool` still reference legacy per-note `<note>.tasks.json` paths.
- Users work across heterogeneous VS Code environments: standard VS Code with GitHub Copilot (`vscode.lm`), VS Code with local Ollama models, or VS Code forks (such as Antigravity/Cursor) and direct cloud API keys (OpenAI, Anthropic, Google Gemini, or custom OpenAI-compatible endpoints).

## Goals / Non-Goals

**Goals:**
- Provide a unified `AiModelService` that abstracts model discovery, selection, credential management (`SecretStorage`), and text/JSON completion across `vscode-lm`, `ollama`, `openai`, `anthropic`, `gemini`, and `custom` (OpenAI-compatible).
- Provide an `AiTaskGeneratorService` that reads a Markdown note and the containing folder's `tasks.json`, prompts the active AI model for structured JSON tasks (`title`, `priority`), deduplicates against existing folder tasks, and writes the new tasks to `<folder>/tasks.json`.
- Expose an intuitive **`Aufgaben generieren`** button and **`KI: <Model>`** selector badge directly in `NotesLinksFooter`.

**Non-Goals:**
- Full conversational chat UI inside the footer bar (chat remains in VS Code's Chat panel via `@janus`).
- Modifying the Markdown note text itself during task extraction (extraction only appends structured tasks to `<folder>/tasks.json`).

## Decisions

### 1. Unified Multi-Provider `AiModelService`
- **Decision**: Implement `src/services/aiModelService.ts` supporting four provider families:
  1. `vscode-lm`: Queries `vscode.lm.selectChatModels({})` (no hardcoded `vendor: 'copilot'` restriction, so any registered VS Code LM provider works).
  2. `ollama`: Queries `GET <ollamaBaseUrl>/api/tags` (default `http://localhost:11434`) with a short timeout (1.5s) to list locally installed models, and calls `POST <ollamaBaseUrl>/api/chat` (`format: 'json'`, `stream: false`) for generation.
  3. `openai` / `custom`: Calls OpenAI-compatible `POST <baseUrl>/chat/completions` using `Bearer <apiKey>` stored in `context.secrets`.
  4. `anthropic`: Calls `POST https://api.anthropic.com/v1/messages` with `x-api-key` from `context.secrets`.
  5. `gemini`: Calls `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` with key from `context.secrets`.
- **Rationale**: Covers every way a user might run AI in VS Code or Antigravity without locking them into GitHub Copilot or requiring external npm SDK dependencies (uses Node/VS Code built-in `fetch`).

### 2. Configuration & Secret Storage
- **Decision**:
  - Store non-sensitive preferences in VS Code configuration (`janus.ai.provider`, `janus.ai.modelId`, `janus.ai.ollamaBaseUrl`, `janus.ai.customBaseUrl`).
  - Store sensitive API keys in `ExtensionContext.secrets` under keys `janus.ai.apiKey.<provider>`.
  - Provide command `janus.selectAiModel` (triggered from the footer badge or Command Palette) that opens a multi-section QuickPick listing:
    - Discovered `vscode.lm` models
    - Discovered local `Ollama` models
    - Direct Cloud Provider presets (`OpenAI`, `Anthropic`, `Gemini`, `Custom OpenAI-Compatible`)
    - Action item: `$(key) KI-Provider / API-Key konfigurieren...`
- **Rationale**: Prevents accidental commits of API keys in `.vscode/settings.json` while keeping model switching a 1-click operation from the note footer.

### 3. Duplicate-Aware Structured JSON Task Extraction
- **Decision**: `AiTaskGeneratorService.generateTasksForNote(noteUri, documentText)` reads `<folder>/tasks.json` via `FolderTasksService`, passes existing task titles in the system prompt, and instructs the model to return a JSON object `{"tasks": [{"title": string, "priority": "low" | "medium" | "high"}]}` containing only actionable items not already covered by existing tasks. Additionally, normalize titles (case-insensitive trim) before appending to guarantee no exact duplicates are added.
- **Rationale**: Allows clicking `Aufgaben generieren` multiple times as a note evolves without flooding `<folder>/tasks.json` with duplicate entries.

### 4. Webview-to-Extension Protocol for Footer AI Controls
- **Decision**:
  - Extend `NoteLinksData` (sent via `updateLinks`) with `aiModel?: { provider: string; modelId: string; label: string }`.
  - Add webview-to-extension messages:
    - `{ type: 'generateAiTasks' }` → runs task extraction and posts `{ type: 'aiTasksGenerating', isGenerating: boolean }` back to the webview so the button shows a spinner and disables during execution.
    - `{ type: 'selectAiModel' }` → invokes `janus.selectAiModel` and refreshes `updateLinks` with the newly selected model label.

## Risks / Trade-offs

- **[Risk] Model returns Markdown code fences (` ```json ... ``` `) around JSON** → **Mitigation**: Strip optional Markdown code fences and extract the JSON object boundary (`{...}` or `[...]`) before parsing and validating with Zod.
- **[Risk] Local Ollama server is offline when opening QuickPick** → **Mitigation**: Use an `AbortSignal.timeout(1500)` when probing `localhost:11434/api/tags` so the QuickPick never hangs if Ollama is not running.

