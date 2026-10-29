# Tasks

## 1. Shared helpers

- [x] 1.1 Add pure `locateMermaidBlock(text, { code, line })` (equal code nearest to `line`, else the block at `line`) and `extractMermaidCode(answer)` to `src/services/markdownScan.ts`; verify with unit tests for equal code, two identical diagrams, edited code at the same line, a removed diagram, and answers with a `mermaid` block, an untyped block and no block

## 2. Editor

- [x] 2.1 Add the `KI` button to the Mermaid widget (posts `editDiagramWithAi` with the block found via `posAtDOM`) and `validate(code)` to the renderer; handle `editDiagramWithAi` in `MarkdownEditorProvider` by running `janus.editDiagramWithAi` with `{ noteUri, code, line }`; verify with a provider test for the command arguments and a test that the button's message carries the block position
- [x] 2.2 Handle `replaceMermaidCode` in the webview (range check against `baseCode`, validation, one undoable change, reply `mermaidCodeReplaced`) and add `MarkdownEditorProvider.replaceMermaidCode(uri, baseCode, newCode)` (re-locate, open if needed, round trip with timeout); verify with tests for `ok`, `changed`, `invalid` and a missing block, and that the document is unchanged in the failure cases
- [x] 2.3 Expose the `MarkdownEditorProvider` instance to `extension.ts` (new static `create`, `register` kept) and register `janus.editDiagramWithAi`; verify that existing editor tests pass and the command sets the chat context and focuses `janus.chatView`

## 3. Chat

- [x] 3.1 In `ChatViewProvider`, add the diagram context (`setDiagramContext`, `clearDiagramContext`, `diagramContext` message), route non-slash messages to a diagram handler while it is set (re-locate, prompt, `extractMermaidCode`, proposals with `proposalId`), and handle `applyDiagram` and `copyDiagramCode`; verify with tests in `tests/chatViewProvider.test.ts` for "Requesting a change", "Refining over several messages", "Reporting the result", "Answer without code", "Diagram removed from the note" and "Removing the context"
- [x] 3.2 In `JanusChatApp.tsx`, show the context chip with a remove button above the input and forward `proposalId` with action clicks; verify with a render test of the chip and that `npm run compile` succeeds

## 4. Wrap-up

- [x] 4.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 4.2 Manually check: click `KI` on the workflow diagram in `project-plan.md`, ask for a new step, apply, refine with a second request, undo with `Cmd+Z`, edit the block by hand and try to apply an older proposal, ask for something nonsensical and check that invalid code is not applied
