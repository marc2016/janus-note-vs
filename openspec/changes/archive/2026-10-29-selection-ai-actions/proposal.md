# Proposal

## Why

The AI features of the editor work on whole notes (`Aufgaben generieren`, `/summarize`), on sections (`/ki-diagramm`) or on diagrams (`KI`). Often only a few sentences matter: a paragraph that should become a diagram, or a long passage that needs a short summary. Today the user has to copy the text into the chat and paste the result back by hand.

## What Changes

- When the user selects at least 20 characters of text in the Janus Markdown Editor (outside code blocks, Mermaid blocks and tables), a small popup appears next to the selection with `Diagramm erstellen` and `Zusammenfassen`. It appears after the mouse is released or the keyboard selection settles, and disappears on typing, `Esc`, or when the selection is cleared.
- **Diagramm erstellen:** inserts the `/ki-diagramm` placeholder block below the selected lines, opens the chat for it and immediately asks the AI for a diagram of the selected text, without the user typing anything. The AI receives the selected text instead of the surrounding section. The rest works as for `/ki-diagramm` (`Übernehmen`, `Code kopieren`, refining).
- **Zusammenfassen:** opens the chat with a context chip `Auswahl · <note>, Zeilen <a>–<b>` and immediately asks the AI for a short German summary of the selected text, without the user typing anything. Follow-up messages ("kürzer", "als Stichpunkte") refine the summary of the same text.
- Each summary answer has `Darunter einfügen` and `Kopieren`. `Darunter einfügen` inserts the summary after the selected lines as a callout (`> [!NOTE]` starting with `**Zusammenfassung:**`), through the editor (undoable with `Cmd+Z`), and only if the selected text is still in the note; otherwise the chat says so.
- The formatting toolbar stays unchanged.

Assumption: the summary is inserted as a `> [!NOTE]` callout, since the editor and GitHub render that type; a dedicated summary type does not exist yet.

Non-goals: more popup actions (translate, rewrite, generate tasks), replacing the selection with the summary, a configurable minimum length, summaries of multiple selections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: selection popup with the two AI actions, and inserting a summary below a selection on request from the chat.
- `janus-chat-view`: selection context with immediate summaries, `Darunter einfügen`/`Kopieren`, and diagrams created from a selection.

## Impact

- New webview extension `src/webviews/markdown/extensions/selectionActions.ts` (tooltip, visibility rules), registered in `MarkdownEditorApp.tsx`; styles in `globals.css`.
- `src/editors/markdownEditorProvider.ts`: messages `summarizeSelection` and `diagramFromSelection`, and `insertAfterText(uri, anchorText, insert, line)` round-tripping through the webview like `replaceMermaidCode`.
- `src/editors/chatViewProvider.ts`, `src/webviews/chat/JanusChatApp.tsx`: selection context, summary prompt, new actions, chip label.
- `src/extension.ts`: commands `janus.summarizeSelection` and the extended `janus.editDiagramWithAi`.
- No new settings or dependencies.
