# Proposal

## Why

Mermaid diagrams are now rendered in the editor (`render-mermaid-in-editor`), but changing one still means editing Mermaid syntax by hand. Describing the change in words ("add a calendar step after the notes, top to bottom") is faster, and the Janus chat already talks to the configured AI model. Today the chat cannot see which diagram is meant: it only looks at `activeTextEditor`, which the Janus editor never is.

## What Changes

- Each rendered Mermaid block gets a `KI` button next to the `Code`/`Diagramm` toggle. It opens the Janus chat and attaches the diagram as context, shown as a chip (`Diagramm · <note>, Zeile <n>`) above the input, with a button to remove it.
- While the chip is shown, every chat message (except slash commands) is a change request for that diagram. The chat sends the diagram's current code from the note and the request to the AI model, which answers with one short sentence and the complete new Mermaid code.
- The answer shows the new code and two buttons: `Übernehmen` and `Code kopieren`. The chip stays, so the user can refine the diagram over several messages.
- `Übernehmen` replaces the code of that block in the note through the Janus editor, so it can be undone with `Cmd+Z`, and the diagram re-renders. It opens the note first if needed.
- Nothing is overwritten when the proposal is not valid Mermaid, or when the block changed or disappeared since the proposal was made. The chat explains why instead.
- An answer without Mermaid code is shown as a normal answer without buttons.

Non-goals (possible follow-ups): a rendered preview of the proposal in the editor before applying, editing the diagram companions (`*.chart.json`, which have their own tool), creating new diagrams from the chat, and keeping diagram chat history across sessions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: `KI` button on Mermaid diagrams, and replacing a diagram's code on request from the chat with validation.
- `janus-chat-view`: diagram context chip, diagram change requests with `Übernehmen`/`Code kopieren`, and safe applying.

## Impact

- `src/webviews/markdown/extensions/mermaidBlocks.ts`: `KI` button, `validate` on the renderer, applying a replacement.
- `src/editors/markdownEditorProvider.ts`: handles `editDiagramWithAi` from the webview, offers `replaceMermaidCode(uri, …)` that round-trips through the webview and reports the result.
- `src/editors/chatViewProvider.ts` and `src/webviews/chat/JanusChatApp.tsx`: diagram context, prompt, proposals, the two new actions, the chip.
- `src/extension.ts`: command `janus.editDiagramWithAi`, and access to the `MarkdownEditorProvider` instance (today created inside `register`).
- No new settings or dependencies.
