# Proposal

## Why

`ai-edit-mermaid-diagrams` lets the AI change an existing diagram from the chat. Starting a new one still means typing `/chart`, getting a fixed `A-->B` example, and then clicking `KI`. Often the diagram should show what the note around it already says ("make this flow a diagram"), but the AI only sees the diagram code, not the note.

## What Changes

- New slash command `/ki-diagramm` ("Diagramm mit KI erstellen") in the Janus Markdown Editor. It inserts a placeholder Mermaid block at the cursor (a valid diagram with one node `Neues Diagramm`) and opens the Janus chat with this block as context, exactly like the `KI` button. The block marks where the diagram goes.
- For the placeholder, the chip reads `Neues Diagramm · <note>, Zeile <n>`, and the AI is asked to create a fitting diagram instead of changing the placeholder.
- For new and existing diagrams, the AI also receives the section of the note around the diagram: from the nearest heading above it to the next heading of the same or a higher level, without the diagram itself, limited to a fixed length.
- `Übernehmen` replaces the placeholder through the existing path (checks, `Cmd+Z`). If nothing is applied, the placeholder stays and can be removed with `Cmd+Z` or by hand.
- `/chart` stays unchanged.

Non-goals: removing an unused placeholder automatically, sending the whole note or linked notes to the AI, choosing a diagram type in the slash menu.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirement for the `/ki-diagramm` slash command.
- `janus-chat-view`: "Diagram Change Requests in the Chat" now includes the note section as context and handles new (placeholder) diagrams.

## Impact

- `src/services/markdownScan.ts`: placeholder constant and pure `sectionAround(text, from, to)`.
- `src/webviews/markdown/extensions/slashCommands.ts` and `MarkdownEditorApp.tsx`: the new command and its callback to the host.
- `src/editors/chatViewProvider.ts`: chip label, prompt for new diagrams, section in the prompt.
- No new settings or dependencies.
