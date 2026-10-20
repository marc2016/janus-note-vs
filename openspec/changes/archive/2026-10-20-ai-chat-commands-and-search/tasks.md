# Tasks

## 1. Workspace Search & Context Service (`JanusSearchService`)

- [x] 1.1 Create `src/services/janusSearchService.ts` with query tokenization (German/English stopword stripping), relevance scoring across note titles, folder paths, headings, and body text, snippet extraction, and task search across `FolderTasksService`, and verify with unit tests in `tests/janusSearchService.test.ts`
- [x] 1.2 Add folder/note context aggregation (`getSummarizeContext` and `getInboxContext`) in `src/services/janusSearchService.ts` for `/summarize` and `/inbox` workflows, and verify with unit tests in `tests/janusSearchService.test.ts`

## 2. Language Model Search Tool (`janus_search_notes`)

- [x] 2.1 Create `src/agent/tools/searchNotesTool.ts` implementing `vscode.LanguageModelTool` for `janus_search_notes` backed by `JanusSearchService`, and verify tool invocation and JSON payload in `tests/agentTools.test.ts`
- [x] 2.2 Register `janus_search_notes` in `package.json` (`contributes.languageModelTools`) and in `src/extension.ts` (`vscode.lm.registerTool`), and verify `npm run compile` succeeds

## 3. `@janus` Chat Participant Slash Commands & Tool-Calling Loop

- [x] 3.1 Declare `/help`, `/search`, `/tasks`, `/summarize`, and `/inbox` commands under `contributes.chatParticipants` (`janus`) in `package.json` and verify valid manifest structure
- [x] 3.2 Upgrade `JanusChatParticipant` in `src/agent/chatParticipant.ts` to support `/help`, `/search`, `/tasks`, `/summarize`, and `/inbox` slash commands with `AiModelService` fallback and interactive `response.button(...)` links (`janus.openMarkdownEditor`, `janus.openAllTasks`, `janus.openFolderTasks`, `janus.sortInbox`), and verify with unit tests in `tests/chatParticipant.test.ts`
- [x] 3.3 Implement multi-turn `vscode.LanguageModelToolCallPart` execution loop in `src/agent/chatParticipant.ts` for free-form `@janus` requests and wire `JanusSearchService`, `FolderTasksService`, and `AiModelService` into `JanusChatParticipant` in `src/extension.ts`, verifying with `npm test` and `npm run build`

