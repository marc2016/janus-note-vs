# Proposal

## Why

Currently, Markdown notes in Janus Note are standalone documents. While companion files (`*.tasks.json`, `*.chart.json`) exist, they are only visible in the sidebar tree or CodeLens. Users cannot easily discover related notes, navigate connections between documents, or see attached companions directly inside the editor. Furthermore, when tasks are generated or referenced across notes, there is no direct visual bridge between a note and its companions or linked documents.

Adding bi-directional note linking (`[[wiki-links]]`, Markdown links, Frontmatter links) and an interactive links footer bar at the bottom of the Janus Markdown Editor enables a rich, connected knowledge base (Zettelkasten) where companions and references are accessible in one click.

## What Changes

- **Note Linking & Backlinks Engine**:
  - Automatically parses wiki-style links (`[[Note Name]]` or `[[path/to/note.md]]`) and standard Markdown links (`[Label](path/to/note.md)`).
  - Automatically indexes outgoing links from the current note.
  - Automatically indexes incoming backlinks (other notes in the notes workspace that link to the current note).
  - Associates direct companion files (`*.tasks.json`, `*.chart.json`) with task summaries (e.g. open task count).
- **Interactive Links Footer Bar in Markdown Editor**:
  - Adds a bottom panel below the CodeMirror editor displaying:
    - **Companion Badges**: Attached task boards (`*.tasks.json`) and diagrams (`*.chart.json`) with live status.
    - **Outgoing Link Badges**: All notes and files linked from the current document.
    - **Backlink Badges**: Notes referencing this document.
    - **Add Link Action (`[+ Verknüpfen]`)**: A button that opens a VS Code QuickPick of all notes and files in the workspace to insert or link.
  - Clicking any badge instantly opens the target in the appropriate Janus editor (`janus.markdownEditor`, `janus.tasksEditor`, or `janus.chartEditor`).
- **Webview & Host Communication**:
  - Extends editor webview messaging to transmit link and companion updates between the VS Code extension host and the React webview.
  - Supports navigation events from the webview to open target documents and trigger link creation.

## Capabilities

### New Capabilities
- `note-linking`: Link extraction (wiki-links and markdown links), companion association, and bi-directional backlink discovery across the notes workspace.

### Modified Capabilities
- `markdown-editor`: Adds a persistent interactive links footer bar to the bottom of the Live Preview editor displaying companion files, outgoing links, and backlinks with 1-click navigation and link addition.

## Impact

- `src/webviews/markdown/`: Adds `NotesLinksFooter` component and styles; updates `MarkdownEditorApp.tsx` layout.
- `src/editors/markdownEditorProvider.ts`: Adds link analysis, companion status queries, and message handling for `openLink` and `addLink`.
- `src/services/` or `src/companion/`: Adds note linking and backlink resolution utilities.
- `package.json`: No breaking changes to existing manifests; integrates seamlessly with existing commands.
