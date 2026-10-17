# Design

## Context

See [proposal.md](file:///Users/marclammers/sources/janus-note-vs/openspec/changes/note-linking-and-footer-bar/proposal.md) for background and motivation. Currently, `MarkdownEditorProvider` serves the WYSIWYG CodeMirror 6 editor inside a Webview Panel. It communicates with the webview using VS Code postMessage events. This design outlines how links are parsed, indexed, and displayed in an interactive footer bar in the editor.

## Goals / Non-Goals

**Goals:**
- Provide a persistent, aesthetic footer bar inside the Janus Markdown Editor webview.
- Display companions (`tasks.json` with open/total counts, `chart.json`) and allow 1-click opening.
- Parse both `[[Wiki-Links]]` and standard Markdown links `[Title](path.md)`.
- Discover incoming backlinks across the active notes root.
- Provide a `+ Verknüpfen` action that presents workspace notes in a QuickPick and inserts the link.

**Non-Goals:**
- Full-text graph visualization (reserved for future graph exploration features).
- External URL link preview fetching.

## Decisions

### 1. Link Parsing and Normalization (`src/services/noteLinkService.ts`)
- Use regex parsing over the raw document text:
  - Wiki-Links: `/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g`
  - Markdown Links: `/\[([^\]]+)\]\(([^)]+)\)/g`
- Filter out web protocols (`http://`, `https://`, `mailto:`).
- Normalize target paths relative to the current note or the notes root (e.g. `[[Meeting]]` resolves to `Meeting.md` in the same directory or notes root).

### 2. Backlink Resolution Engine
- A service `findBacklinks(targetUri, notesRootUri)` reads the markdown files in the notes collection.
- For each note, tests if any link reference matches the target note's base name or relative path.
- Returns an array of `{ title: string, uri: string, relativePath: string }`.

### 3. Companion Summary Integration
- Leverage `companionManager.getCompanionStatus(noteUri)`.
- When `tasks.json` exists, compute task metrics:
  - `total = tasks.length`
  - `completed = tasks.filter(t => t.status === 'done').length`
  - `open = total - completed`
- Provide actionable label: e.g. `"Task Board (3 offen, 5 gesamt)"`.

### 4. Webview Links Footer Component (`src/webviews/markdown/components/NotesLinksFooter.tsx`)
- Placed directly beneath the editor scroll container in `MarkdownEditorApp.tsx`.
- Uses a collapsible or compact layout with modern glassmorphism/pill badge aesthetics:
  - **Companion Pills**: Distinct purple/indigo accent with icons (`$(checklist)`, `$(graph)`).
  - **Outgoing Link Pills**: Blue accent with note icon.
  - **Backlink Pills**: Teal/green accent with inbound arrow icon.
  - **Add Link Button**: Minimalist dashed or subtle button `+ Verknüpfen`.
- PostMessage communication:
  - Host sends `{ type: 'updateLinks', linksData }` on initialization, document change (debounced), and companion change.
  - Webview sends `{ type: 'openLink', targetUri, viewType }` on chip click.
  - Webview sends `{ type: 'addLink' }` on button click.

### 5. Add Link QuickPick Workflow
- Triggered by webview `addLink` message.
- Host scans workspace notes via `companionManager.getNotesRootUri()`.
- Presents a QuickPick with note names and relative paths.
- On selection, appends `[[Selected Note]]` or `[Selected Note](./path)` at cursor position or end of file via standard text document edit, triggering an update.

## Risks / Trade-offs

- **[Risk] Backlink search performance on large workspaces**
  → *Mitigation*: Limit search to `janus.notesRoot` rather than entire project workspace, and debounce backlink calculation so typing remains 60fps responsive.
- **[Risk] Broken link targets**
  → *Mitigation*: Verify if link target exists on disk. If missing, render link chip with muted or warning styling and prompt to create note when clicked.
