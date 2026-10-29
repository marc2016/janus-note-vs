# Design

## Context

- `mermaidBlocks.ts` renders Mermaid blocks with a `Code`/`Diagramm` button per block. The renderer (`createMermaidRenderer`) loads `mermaid.min.js` lazily and already calls `mermaid.parse` before rendering.
- `findFencedBlocks(text)` in `markdownScan.ts` is pure and usable on the host.
- `ChatViewProvider.processUserMessage` routes slash commands to handlers and everything else to `handleFreeFormChat`. It uses `activeTextEditor`, which is undefined while the Janus editor is focused. Assistant messages can carry `actions` (`{ label, actionType, uri? }`). The webview posts `{ type: action.actionType, uri }` on click, and `handleMessage` switches on the type.
- `MarkdownEditorProvider` keeps open panels in `_activePanels` (`getOpenWebviewPanel(uri)`), but `extension.ts` never sees the instance: it is created inside the static `register`.
- Edits must enter the document through the editor webview (`fix-editor-sync-race`); that path also gives `Cmd+Z`.

## Goals / Non-Goals

**Goals:**
- The proposal is applied only to the code it was made for.
- The AI model always sees the diagram as it is in the note now.

**Non-Goals:**
- Streaming answers; the chat keeps using `completePrompt`.

## Decisions

### 1. From the `KI` button to the chat

The widget's `KI` button posts `{ type: 'editDiagramWithAi', blockFrom }` (resolved at click time via `posAtDOM`, like the toggle). The provider takes the block from `findFencedBlocks(document.getText())` and runs `janus.editDiagramWithAi` with `{ noteUri, code, line }` (`line` is the 1-based line of the opening fence). The command calls `chatViewProvider.setDiagramContext(...)` and focuses the chat (`janus.chatView.focus`).

`MarkdownEditorProvider.register` additionally returns the provider instance (as `{ provider, disposable }` via a small new static `create`, keeping `register` for existing callers), so `extension.ts` can pass it to the chat as the applier.

### 2. Diagram context and the current code

`ChatViewProvider` stores `diagramContext = { noteUri, code, line }` and sends `{ type: 'diagramContext', context: { label, line } | null }` to the webview, which shows the chip and posts `clearDiagramContext` from its close button.

Before each request the provider re-locates the diagram in the current document text (`vscode.workspace.openTextDocument(noteUri)`, which reflects the editor through the sync), using a pure `locateMermaidBlock(text, { code, line })`:
1. a Mermaid block whose code equals the stored code (nearest to `line` if several),
2. otherwise the Mermaid block that starts at the stored line, if any.

If nothing is found, the chat says `Das Diagramm wurde in der Notiz nicht mehr gefunden.` without calling the model. Otherwise the found code becomes the current code (and is written back into the context with its line).

*Alternative considered:* asking the editor webview for the code each time. The document already holds the synced text, and reading it avoids a round trip and works when the note is closed.

### 3. Prompt and answer parsing

System prompt (German): change the given Mermaid diagram as requested; answer with one short sentence, then exactly one fenced `mermaid` block with the complete new diagram; keep everything that the request does not mention. The user prompt contains the current code in a fenced block and the request.

`extractMermaidCode(answer)` takes the first fenced block with info `mermaid` (or, failing that, the first fenced block without info). With code, the provider stores a proposal `{ id, noteUri, baseCode, newCode }` in a small map (latest 20) and attaches actions `{ label: 'Übernehmen', actionType: 'applyDiagram', proposalId }` and `{ label: 'Code kopieren', actionType: 'copyDiagramCode', proposalId }`. `ChatAction` gets an optional `proposalId`, and the webview forwards it in its click message.

### 4. Applying

`applyDiagram` → `editorProvider.replaceMermaidCode(noteUri, baseCode, newCode)`:
1. Re-locate the block by `baseCode` in the current document text. If not found → `changed`.
2. Open the note in the Janus editor if no panel is open (`vscode.openWith`, then wait for the panel's `ready`).
3. Post `{ type: 'replaceMermaidCode', requestId, codeFrom, codeTo, baseCode, newCode }` to the panel and await `{ type: 'mermaidCodeReplaced', requestId, result: 'ok' | 'changed' | 'missing' | 'invalid' }` (timeout 10 s → `missing`).
4. The webview checks that `doc.sliceString(codeFrom, codeTo) === baseCode` (else `changed`), validates with the renderer's new `validate(code)` (`mermaid.parse`, else `invalid`), and dispatches one change, which goes through the normal sync and history.

The chat adds `Diagramm übernommen.`, `Das Diagramm wurde inzwischen geändert – bitte neu anfragen.`, `Der Vorschlag ist kein gültiges Mermaid-Diagramm.` or `Das Diagramm wurde nicht gefunden.`. On `ok` the context's code becomes `newCode`.

`copyDiagramCode` writes `newCode` with `vscode.env.clipboard.writeText` and shows a short status message.

## Risks / Trade-offs

- [The model returns a partial diagram despite the prompt] → The user sees the code before applying and can undo with `Cmd+Z`.
- [Two identical diagrams in a note] → Located by equal code nearest to the stored line; applying checks the exact range in the editor again.
- [Waiting for a freshly opened editor] → `ready` handshake with a timeout; on timeout nothing is changed and the chat reports it.
- [Chat history holds proposals of closed sessions] → Proposals live only in memory; buttons of old messages report `changed`/`missing` when no proposal is found.
