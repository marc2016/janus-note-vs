# Design

## Context

- The editor already has the diagram chat path: `editDiagramWithAi` → `janus.editDiagramWithAi` → `ChatViewProvider.setDiagramContext` + `openChatForDiagram` (focus, `focusInput`), proposals with `Übernehmen`/`Code kopieren`, and `MarkdownEditorProvider.replaceMermaidCode` as a webview round trip (`replaceMermaidCode` / `mermaidCodeReplaced`, ready handshake, timeout).
- `/ki-diagramm` inserts `MERMAID_PLACEHOLDER` in the webview and posts `editDiagramWithAi` with the block start. The host polls briefly until the block is in the document.
- `findFencedBlocks` and `findCodeRanges` are pure; the chat prompt for diagrams uses `sectionAround`.
- CodeMirror's `showTooltip` facet renders popups anchored at a document position.

## Goals / Non-Goals

**Goals:**
- Reuse the diagram and apply paths instead of building parallel ones.

**Non-Goals:**
- Showing the popup for read-only views or in other webviews.

## Decisions

### 1. The popup

`selectionActions.ts` holds a `StateField<Tooltip | null>` provided to `showTooltip`. A tooltip is shown when the main selection is non-empty, at least 20 characters long (trimmed), not overlapping a fenced block (`findFencedBlocks`) or a table line (`|`-prefixed), and the selection is "settled". Settling is tracked with a `StateEffect`: a `mousedown` handler marks the selection as dragging, `mouseup` dispatches `settled`; keyboard selection (`select` user events) schedules `settled` after 300 ms of no further selection changes. Any document change or `Escape` hides it. The tooltip sits above the selection head (below if no room), with two buttons.

Buttons call `options.onSummarize({ text, fromLine, toLine })` and `options.onDiagram({ text, fromLine, toLine })` (1-based lines of the selection). `onDiagram` first inserts the placeholder block after `toLine` in the webview (same text as `/ki-diagramm`) and passes its start.

### 2. Messages and commands

- `summarizeSelection { text, fromLine, toLine }` → provider → `janus.summarizeSelection` with `{ noteUri, text, fromLine, toLine }` → `ChatViewProvider.startSelectionSummary(...)` + focus.
- `diagramFromSelection { blockFrom, text }` → provider (same block polling as `editDiagramWithAi`) → `janus.editDiagramWithAi` with `{ noteUri, code, line, sourceText: text }`.

### 3. Chat: one context slot, two kinds

`ChatViewProvider` keeps a single `chatContext` that is either the existing diagram context (now with optional `sourceText`) or a selection context `{ kind: 'selection', noteUri, text, fromLine, toLine, lastSummary? }`. Setting one replaces the other, so there is only ever one chip. The chip label is `Auswahl · <file>, Zeilen <a>–<b>` for selections.

- `startSelectionSummary` sets the context and runs the summary request at once (posting the user-visible message `Zusammenfassen` so the history reads naturally).
- Prompt: summarize the given text in German, short, keep facts and names, no introduction; follow-ups include the previous summary and the request.
- Answers get `{ label: 'Darunter einfügen', actionType: 'insertSummary', proposalId }` and `{ label: 'Kopieren', actionType: 'copySummary', proposalId }`, stored like diagram proposals (same map, a `kind` field).
- Diagram requests use `sourceText` instead of `sectionAround` when it is set. When a diagram context arrives with `sourceText` (from the popup), `openChatForDiagram` immediately sends the request `Diagramm aus der Auswahl erstellen`, so the first proposal appears without input.

### 4. Inserting the summary

`MarkdownEditorProvider.insertAfterText(uri, anchorText, insert, line)` mirrors `replaceMermaidCode`: open the note if needed, post `insertAfterText { requestId, anchorText, insert, line }`, await `textInserted { requestId, result: 'ok' | 'changed' | 'missing' }`. The webview finds `anchorText` in its document (the occurrence whose start line is nearest to `line`), and inserts `\n\n> [!NOTE]\n> **Zusammenfassung:** <first line>\n> <further lines>` after the end of the last line of that occurrence, in one transaction. If the text is not found → `changed`.

Formatting the callout is a pure helper `formatSummaryCallout(summary)` (each line prefixed with `> `, blank lines as `>`).

## Risks / Trade-offs

- [Popup overlaps text or feels intrusive] → Minimum length, settle delay, hidden while typing, `Esc`.
- [Same sentence occurs twice] → The occurrence nearest to the original line is used.
- [Summary of a very long selection] → Selections are capped at 8000 characters for the prompt; the chat says when the text was shortened.
