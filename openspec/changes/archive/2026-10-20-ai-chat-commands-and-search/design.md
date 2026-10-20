# Design

## Context

See `proposal.md` for motivation. Currently:
- `JanusChatParticipant` (`src/agent/chatParticipant.ts`) only inspects `vscode.window.activeTextEditor?.document` and sends a single request to `request.model` without handling `vscode.LanguageModelToolCallPart` responses or slash commands.
- `findMarkdownNotesInRoot` (`src/services/noteLinkService.ts`) and `FolderTasksService` (`src/services/folderTasksService.ts`) already provide recursive discovery of Markdown notes and `tasks.json` files inside `notesRoot`.
- `AiModelService` (`src/services/aiModelService.ts`) supports completion requests across VS Code LM, Ollama, OpenAI, Anthropic, Gemini, and Custom providers.

Because a second change will introduce a standalone Janus Sidebar Chat Webview, the search and context-building logic must live in a dedicated service (`JanusSearchService`) decoupled from VS Code's `ChatResponseStream`.

## Goals / Non-Goals

**Goals:**
- Provide a fast, zero-dependency local search and context service (`JanusSearchService`) over all notes and tasks in `notesRoot`.
- Support `/help`, `/search`, `/tasks`, `/summarize`, and `/inbox` slash commands in `@janus`.
- Implement a multi-turn tool-invocation loop in `JanusChatParticipant` and register `janus_search_notes` as a `vscode.LanguageModelTool`.
- Render interactive `response.button(...)` actions in `@janus` responses so users can open matched notes directly in the Janus WYSIWYG Markdown Editor (`janus.markdownEditor`) rather than VS Code's plain text editor.

**Non-Goals:**
- Building the standalone React Webview Chat panel in the Janus Sidebar (planned as the follow-up Change 2 on top of `JanusSearchService`).
- External vector database or embedding index setup; local keyword/token scoring with heading/title boosts is instantaneous for personal/project note repositories and requires no embedding API key.

## Decisions

### 1. Local Relevance-Ranked Search (`JanusSearchService`)
- **Decision**: Implement `JanusSearchService` in `src/services/janusSearchService.ts` using tokenized keyword + phrase matching with weighted scoring:
  - Exact/partial match in note title / filename: highest weight (`+10` / `+5`)
  - Match in relative folder path (e.g., `projects/App-Launch`): medium-high weight (`+4`)
  - Match in Markdown headings (`#`, `##`, `###`): high weight (`+6`)
  - Match in body paragraphs: base weight (`+2` per term occurrence, capped)
  - German/English stopword stripping (e.g., `"wo"`, `"steht"`, `"etwas"`, `"was"`, `"wie"`, `"zu"`, `"in"`, `"meinen"`, `"the"`, `"what"`) so natural-language questions like `"Wo steht etwas zum Q3 Budget?"` extract meaningful search tokens (`["q3", "budget"]`).
- **Snippet Extraction**: For each matching note, extract the most relevant paragraph/section around the first matched heading or term (up to ~400 chars) so the LLM prompt stays compact and grounded.
- **Alternatives Considered**: Passing all full note contents to the LLM on every query. Rejected because workspaces with dozens of notes quickly exceed context limits and increase latency.

### 2. Dual Execution Path in `JanusChatParticipant`
- **Decision**:
  - When `request.command` is one of `search`, `tasks`, `summarize`, or `inbox`, `JanusChatParticipant` pre-fetches the targeted context via `JanusSearchService` / `FolderTasksService` / `AiInboxSorterService`, sends a focused prompt to `request.model` (or falls back to `AiModelService.completePrompt` if `request.model` is unavailable), streams the response, and appends `response.button(...)` links for one-click navigation in Janus editors.
  - When `request.command` is undefined (free-form `@janus` chat), `JanusChatParticipant` runs a tool-calling loop (up to 4 iterations): it inspects `chatResponse.stream` for `vscode.LanguageModelToolCallPart`, invokes the corresponding registered tool (`janus_search_notes`, `janus_read_note_and_companions`, `janus_mutate_tasks`, `janus_mutate_chart`), appends `LanguageModelToolResultPart` messages, and continues streaming the model's answer.

### 3. Opening Notes in Janus WYSIWYG Editor from Chat
- **Decision**: Standard `response.reference(uri)` in VS Code Chat opens `.md` files in the default VS Code text editor. In addition to references, `@janus` will emit `response.button({ command: 'janus.openMarkdownEditor', title: '...', arguments: [uri] })` for top matched notes so clicking opens the note directly in `janus.markdownEditor`.

## Risks / Trade-offs

- **[Risk] Natural-language search queries contain conversational filler words** → **Mitigation**: Tokenize queries by stripping common German and English question/stop words and punctuation, and fall back to returning a workspace overview (note titles + folders + open tasks) when no token matches, allowing the LLM to still see all existing notes.
- **[Risk] Large number of notes in `notesRoot` during search** → **Mitigation**: Reuse `findMarkdownNotesInRoot` (which already ignores `node_modules`, `.git`, `dist`, `openspec`, etc. and bounds directory depth) and cap returned note snippets to `maxResults` (default 8).

