# Design

## Context

See `proposal.md` for background and motivation. The original Janus Note system was architected around a Tauri desktop wrapper with Rust-based file sandboxing, React 19 UI, and LangGraph agent pipelines. In VS Code, the editor environment, document model, filesystem permissions, and AI models (via `vscode.lm`) are already managed by the host application. This design outlines how the Janus Note architecture maps onto native VS Code extension APIs.

## Goals / Non-Goals

**Goals:**
- Provide a clean, native VS Code extension architecture in TypeScript.
- Implement a **Companion Manager** for pairing `*.md` files with `*.tasks.json` and `*.chart.json`, complete with file watching and CodeLens decorators.
- Implement **Custom Text Editors** for companion files to deliver visual, interactive Task Boards (Kanban) and Diagram viewers.
- Implement **Language Model Tools** (`vscode.lm.registerTool`) and a `@janus` Chat Participant (`vscode.chat.createChatParticipant`) for AI-assisted note and companion operations.
- Enforce strict data schema validation (using Zod) on companion files before any disk mutation.

**Non-Goals:**
- Re-implementing a custom Markdown editor, tab shell, or file tree (VS Code's native components are used).
- Managing third-party LLM API keys (OpenAI, Anthropic) directly; the extension leverages models exposed via VS Code's Language Model API (`vscode.lm`).

## Decisions

### 1. Build and Packaging Pipeline: esbuild
- **Decision**: Use `esbuild` for compiling both the extension host entrypoint (`src/extension.ts`) and webview client bundles (`src/webviews/`).
- **Rationale**: `esbuild` produces minimal, fast-loading bundles with negligible startup latency.
- **Alternatives considered**: Webpack (slower build times, verbose configuration) or Vite (great for SPAs, but requires extra configuration for VS Code extension multi-entrypoints).

### 2. Custom Editor Provider Architecture
- **Decision**: Implement `vscode.CustomTextEditorProvider` for `*.tasks.json` and `*.chart.json`.
- **Rationale**: This gives automatic integration with VS Code's editor tabs, dirty state tracking, auto-save settings, and native Undo/Redo (`vscode.TextDocumentWillSaveEvent` / `WorkspaceEdit`).
- **Data Flow**:
  1. Host reads `vscode.TextDocument` and parses JSON via Zod schema.
  2. Webview receives initial state via `webview.postMessage({ type: 'init', data })`.
  3. User interactions in webview send `update` messages.
  4. Host applies changes to `vscode.TextDocument` using `vscode.WorkspaceEdit`, updating the document without breaking the undo stack.

### 3. Native Language Model Tools & Chat Participant
- **Decision**: Implement tool logic directly with `vscode.lm.registerTool` and `@janus` via `vscode.chat.createChatParticipant`.
- **Rationale**: VS Code 1.90+ provides native tool calling, streaming responses, and participant hooks. This removes the need for large LangChain/LangGraph dependencies in the extension bundle while delivering a 100% native Copilot Chat experience.
- **Tools**:
  - `janus_read_note_and_companions`: Returns active markdown note and companion JSONs.
  - `janus_mutate_tasks`: Validates changes via Zod, modifies `*.tasks.json` via WorkspaceEdit.
  - `janus_mutate_chart`: Validates chart structure, updates `*.chart.json`.
  - `janus_propose_note_diff`: Creates in-memory virtual document to display side-by-side diff via `vscode.diff`.

### 4. Companion Discovery and CodeLens
- **Decision**: Implement `vscode.CodeLensProvider` targeting Markdown documents (`documentSelector: [{ language: 'markdown' }]`).
- **Rationale**: Provides unobtrusive, zero-friction discovery right above `# Header` in Markdown notes without cluttering the workbench or requiring user commands.

## Architecture Sketch

```
+─────────────────────────────────────────────────────────────+
|                     VS Code Extension Host                  |
|                                                             |
|  [ extension.ts ]                                           |
|       ├── CompanionManager (Pairing, Watchers, CodeLens)    |
|       ├── TasksEditorProvider (CustomTextEditorProvider)    |
|       ├── ChartEditorProvider (CustomTextEditorProvider)    |
|       └── AgentService                                      |
|             ├── @janus (vscode.chat.createChatParticipant)  |
|             └── LanguageModelTools (vscode.lm.registerTool) |
|                                                             |
+───────────────────────────────┬─────────────────────────────+
                                │ postMessage (RPC)
                                ▼
+─────────────────────────────────────────────────────────────+
|                     Webview Sandbox (UI)                    |
|                                                             |
|  [ TaskBoardWebview ]               [ DiagramWebview ]      |
|  - Kanban Columns & Drag/Drop       - Mermaid SVG Render    |
|  - Checkboxes & In-place Edits      - Pan / Zoom Controls   |
+─────────────────────────────────────────────────────────────+
```

## Risks / Trade-offs

- **[Dependency on VS Code Language Models]** → Requires a Language Model provider (such as GitHub Copilot or equivalent extension) enabled in VS Code.
  - *Mitigation*: The extension gracefully degrades: visual editors and companion file management work 100% offline without any AI provider; if `@janus` or tools are invoked without a model, a helpful notification guides the user.
- **[Concurrent external and webview edits]** → Modifying `*.tasks.json` in another editor while the webview is open could cause race conditions.
  - *Mitigation*: Host listens to `vscode.workspace.onDidChangeTextDocument` and pushes updated state into the webview with debouncing.
