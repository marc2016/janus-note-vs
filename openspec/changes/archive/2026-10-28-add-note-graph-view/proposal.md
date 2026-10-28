# Proposal

## Why

Janus already parses and resolves links between notes (outgoing links and backlinks in the editor footer), but only ever shows them for one note at a time. There is no way to see how the whole notes collection hangs together: which notes are hubs, which clusters form around a project, and which notes are not connected to anything. An Obsidian-style graph over all notes makes that structure visible and gives a new way to navigate.

## What Changes

- **Note graph panel**: A new webview panel in the editor area shows every Markdown note under `notesRoot` and `janus.includeFolders` as a node and every resolved note-to-note link as an edge, laid out with a d3 force simulation.
- **Obsidian-like reading aids**: Node size grows with the number of links, node color follows the note's top-level folder, labels appear when zoomed in, and hovering a node highlights it with its direct neighbours while the rest fades.
- **Navigation**: Clicking a node opens the note in the Janus Markdown Editor. Zoom, pan, and dragging nodes are supported.
- **Filters**: A search field narrows the graph to matching notes. Toggles show or hide orphan notes (no links) and unresolved link targets ("ghost" nodes, off by default).
- **Live updates**: The open graph refreshes when notes are created, changed, deleted, or when the notes root or included folders change.
- **Entry points**: Command `Janus: Notiz-Netzwerk öffnen` (`janus.openNoteGraph`), a button in the Janus notes sidebar title bar, and a button in the folder overview when it shows the notes root.

Non-goals (possible follow-ups): local graph for the active note, force tuning controls, folder nodes, tag nodes, canvas rendering for very large collections, persisting node positions.

## Capabilities

### New Capabilities
- `note-graph`: Whole-collection graph of notes and their links, with its panel, interactions, filters, live updates, and entry points.

### Modified Capabilities
- `folder-overview`: The overview of the notes root offers an action to open the note graph.

## Impact

- `src/services/noteGraphService.ts` (new): Builds nodes and edges from all notes in one pass, reusing `findMarkdownNotesInRoots`, `extractDocumentLinks`, and `resolveOutgoingLink` from `noteLinkService.ts`.
- `src/editors/noteGraphViewProvider.ts` (new): Panel lifecycle, messaging, refresh on file and configuration changes.
- `src/webviews/noteGraph/` (new): React app with the d3 graph and toolbar; new esbuild entry `noteGraph` in `esbuild.js`.
- `src/webviews/chart/d3/D3NetworkGraph.tsx`: Used as reference only; the chart companion graph stays unchanged.
- `src/extension.ts`, `package.json`: Command, sidebar title menu entry.
- `src/editors/folderOverviewViewProvider.ts`, `src/webviews/folderOverview/FolderOverviewApp.tsx`: Root-only "Netzwerk" button.
- No new dependencies (`d3` is already a dependency).
- Tests: graph building (dedupe, bidirectional, ghosts, non-note targets, include folders), provider messaging.
