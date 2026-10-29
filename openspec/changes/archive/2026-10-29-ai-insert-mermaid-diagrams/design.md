# Design

## Context

- Slash commands are completions in `slashCommands.ts`; `apply` can be a function that dispatches changes and calls a callback from `SlashCommandsOptions` (as `/datum` does with `onOpenDatePicker`).
- The editor already posts `{ type: 'editDiagramWithAi', blockFrom }` for the `KI` button. The provider finds the block with `findFencedBlocks` and runs `janus.editDiagramWithAi` with `{ noteUri, code, line }`.
- `ChatViewProvider.handleDiagramRequest` re-locates the block (`locateMermaidBlock`) in the current note text and builds the prompt. `sendDiagramContext` builds the chip label.

## Goals / Non-Goals

**Goals:**
- Reuse the `KI` button path end to end; the slash command only adds inserting the placeholder.

**Non-Goals:**
- Tracking "new" as separate state: whether a diagram is new is derived from its code.

## Decisions

### 1. Placeholder and "new" detection

`MERMAID_PLACEHOLDER = 'graph TD\n    A[Neues Diagramm]'` lives in `markdownScan.ts` (pure, used by webview and host). A diagram is new when its trimmed code equals the placeholder. This survives reloads and switches to "existing" by itself once a proposal was applied.

*Alternative considered:* an `isNew` flag in the diagram context. It would go stale after `Übernehmen` or when the user edits the placeholder by hand.

### 2. Slash command

`/ki-diagramm` gets `apply(view, _, from, to)`: it replaces `from..to` with `` (prefix)```mermaid\n<placeholder>\n```\n ``, where the prefix is `\n` when the command was typed after other text on the line, and places the cursor after the block. Then it calls `options.onAiDiagram(blockFrom)` with the start of the opening fence. `MarkdownEditorApp` wires `onAiDiagram` to the same `editDiagramWithAi` message as the `KI` button. The host reads the block from `document.getText()`; because the insert syncs through `updateContent` asynchronously, the provider retries the lookup briefly (up to ~1 s, polling the document) before giving up.

### 3. Section context

Pure `sectionAround(text, blockFrom, blockTo, maxChars = 4000)`:
- Start: the nearest line above `blockFrom` that is a heading (outside fenced code); its level `n`. Without a heading, the start of the text.
- End: the next heading of level `<= n` after `blockTo` (outside fenced code), else the end of the text.
- The block range itself is removed. Frontmatter is dropped. The result is trimmed and cut to `maxChars` (keeping the start, with `…` appended).

`handleDiagramRequest` adds it to the user prompt as `Abschnitt der Notiz:` (only when non-empty).

### 4. Prompt for new diagrams

When the located code equals the placeholder, the system prompt says to create a fitting Mermaid diagram from the request and the note section (the placeholder is only a marker), with the same answer format. The chip label uses `Neues Diagramm · …` when the context's code is the placeholder; after a successful `Übernehmen`, the context code changes and the label is re-sent as `Diagramm · …`.

## Risks / Trade-offs

- [Unused placeholders stay in notes] → Accepted (visible, undoable); automatic removal could delete a user's edits.
- [Large sections] → Capped at 4000 characters.
- [Host reads the block before the insert has synced] → Short polling of the document, then a quiet no-op (the chip simply does not open).
