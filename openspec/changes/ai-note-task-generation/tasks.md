# Tasks

## 1. Multi-Provider AI Model Service & Configuration

- [x] 1.1 Add AI configuration properties (`janus.ai.provider`, `janus.ai.modelId`, `janus.ai.ollamaBaseUrl`, `janus.ai.customBaseUrl`) and commands (`janus.selectAiModel`, `janus.generateTasksFromNote`) to `package.json` and verify valid JSON manifest
- [x] 1.2 Implement `AiModelService` in `src/services/aiModelService.ts` supporting `vscode-lm` (`vscode.lm.selectChatModels`), local `ollama`, `openai`, `anthropic`, `gemini`, and `custom` OpenAI-compatible endpoints with `SecretStorage` API key management and QuickPick model selector, and verify with unit tests

## 2. Duplicate-Aware AI Task Extraction Service & Agent Tools

- [x] 2.1 Implement `AiTaskGeneratorService` in `src/services/aiTaskGeneratorService.ts` to extract structured tasks from a Markdown note while deduplicating against existing tasks in `<folder>/tasks.json`, and verify with unit tests
- [x] 2.2 Update `ReadNoteTool` (`src/agent/tools/readNoteTool.ts`) and `MutateTasksTool` (`src/agent/tools/mutateTasksTool.ts`) to resolve and mutate the containing folder's `tasks.json`, and verify `tests/agentTools.test.ts` passes

## 3. Editor Footer UI & Webview Integration

- [x] 3.1 Extend `NoteLinksData` and `MarkdownEditorProvider` (`src/editors/markdownEditorProvider.ts` & `src/extension.ts`) to include active AI model info and handle `generateAiTasks` and `selectAiModel` webview messages, verifying with `npm run compile`
- [x] 3.2 Update `NotesLinksFooter.tsx` and `MarkdownEditorApp.tsx` to render the interactive `KI: <Model>` selector badge and the `Aufgaben generieren` button with loading state, and verify with `npm run compile`

## 4. Verification & Build

- [x] 4.1 Create unit test suite `tests/aiTaskGeneration.test.ts` covering multi-provider model resolution, JSON extraction/deduplication, and webview message handling
- [x] 4.2 Run `npm run compile && npm run build && npm test` to verify clean compilation, production bundle build, and 100% passing test suite

