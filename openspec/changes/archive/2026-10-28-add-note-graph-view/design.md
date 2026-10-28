# Design

## Context

See proposal.md for motivation and specs/note-graph for the required behavior. Relevant current state:

- `src/services/noteLinkService.ts` already has the building blocks: `findMarkdownNotesInRoots(roots)` lists all notes, `extractDocumentLinks(text)` parses wiki and Markdown links (external protocols are filtered via `EXTERNAL_PROTOCOL_RE`), and `resolveOutgoingLink(link, source, primaryRoot, workspaceNotes)` resolves a link the same way the editor footer does (relative, root-relative, workspace-relative, then basename match), returning `exists: false` for unresolved targets. `ensureNoteExtension` only appends `.md` when the target has no extension, so `app.ts` stays `app.ts`.
- `findBacklinks` reads every note once *per target note*. Calling it for every note would be O(n²) file reads, so the graph must not be built from it.
- `CompanionManager.getAllNotesRoots()` returns `notesRoot` plus `includeFolders`; `getNotesRootUri()` returns the primary root. `checkNotesRootStatus` tells whether the root is initialized.
- Panels follow one pattern (e.g. `FolderOverviewViewProvider`): a singleton `WebviewPanel` with `retainContextWhenHidden: true`, a React bundle from `dist/webviews/<name>.js` plus `globals.css`, nonce-based CSP, and `postMessage` in both directions. Webviews detect dark mode via `document.body.classList.contains('vscode-dark')`.
- `src/webviews/chart/d3/D3NetworkGraph.tsx` is a d3 force graph for chart companions. It removes and redraws the whole SVG on every prop change and has no click or neighbour highlighting.
- `FolderOverviewViewProvider` does not know the notes root today (its constructor takes context, AI summary service, tasks service, and a mutate callback).

## Goals / Non-Goals

**Goals:**
- Build the graph with exactly one read per note and link resolution consistent with the editor footer.
- Updates that do not reset the user's view (zoom, pan, filters, node positions).

**Non-Goals:**
- Changing `D3NetworkGraph` or the chart companion graph.
- Incremental graph updates per changed file. A full rebuild is simple and fast enough at the expected size (see Risks).

## Decisions

### 1. `NoteGraphService` builds the graph in one pass
New `src/services/noteGraphService.ts` with `buildNoteGraph(roots: Uri[], primaryRoot: Uri | undefined): Promise<NoteGraphData>`:

1. `notes = findMarkdownNotesInRoots(roots)`; create one node per note.
2. For each note: read it once, `extractDocumentLinks`, resolve each link with `resolveOutgoingLink(link, note, primaryRoot, notes)`.
3. Classify each resolved link:
   - `exists` and target is a Markdown note in the node set → note edge (skip self-links).
   - `exists` but not a Markdown note (e.g. `app.ts`) → ignored.
   - not `exists` and the target has a non-`.md` extension → ignored.
   - otherwise → ghost edge to `ghost:<lowercased target without extension>`, so several notes linking to the same missing note share one ghost node.
4. Deduplicate edges by unordered pair; if both directions occur, mark `bidirectional: true`.
5. Compute `degree` per node as the number of distinct linked notes. Ghost edges do not count, so node sizes stay stable when ghosts are toggled or the graph is filtered.

Data shape sent to the webview:
```ts
interface GraphNode { id: string; title: string; relativePath: string; group: string; degree: number; ghost?: boolean }
interface GraphEdge { source: string; target: string; bidirectional: boolean }
interface NoteGraphData { nodes: GraphNode[]; edges: GraphEdge[] }
```
`id` is the note URI string. `group` is the first path segment relative to the root that contains the note, or the root's folder name for notes directly in a root, so included folders get their own color.

*Alternative*: an in-memory resolver over a path/basename map, skipping `resolveOutgoingLink`'s file-system checks. Rejected for now: it would duplicate the resolution rules and could disagree with the footer. Resolution results are cached per `(source directory, target)` inside one build to avoid repeated stats.

### 2. `NoteGraphViewProvider` owns panel and refresh
New `src/editors/noteGraphViewProvider.ts`, view type `janus.noteGraph`, title `Notiz-Netzwerk`, `retainContextWhenHidden: true`, same HTML/CSP template as the other panels.

- `open()`: if the notes root is not initialized (`checkNotesRootStatus`), show an info message and return. Otherwise create or reveal the panel, then post `graphData`.
- Messages from webview: `ready` (send data), `openNote { uri }` → `vscode.openWith(uri, MarkdownEditorProvider.viewType)`. Ghost nodes never send `openNote`.
- While the panel exists, a dedicated `FileSystemWatcher('**/*.md')` and an `onDidChangeConfiguration` listener (`janus.notesRoot`, `janus.includeFolders`) schedule a rebuild, debounced to 500 ms. Events outside the notes roots are ignored. Both are disposed in `onDidDispose`, so a closed panel costs nothing. Renames arrive as delete + create and are covered.
- A build that finishes after a newer one started is discarded (generation counter), so a slow build cannot overwrite fresher data.

*Alternative*: reuse `CompanionWatcher.onDidChangeCompanion`. Rejected because it also fires for `tasks.json` and chart files and lives for the whole session.

### 3. New webview app with its own d3 graph component
New entry `noteGraph: 'src/webviews/noteGraph/index.tsx'` in `esbuild.js`, with `NoteGraphApp.tsx` (toolbar, filters, counts, empty state) and `NoteGraphCanvas.tsx` (d3).

`NoteGraphCanvas` is written fresh instead of extending `D3NetworkGraph`, because it needs a long-lived simulation that survives data updates:
- Rendering in SVG. One `forceSimulation` stored in a ref, with `forceLink` (id accessor), `forceManyBody`, `forceCenter`, and `forceCollide` sized by node radius.
- Data updates use d3's `join` keyed by `id`. Positions of existing nodes are carried over from a `Map<id, {x, y}>` ref; new nodes start near a linked neighbour if one exists, else near the center. After an update the simulation restarts with a low alpha (~0.3) so the layout settles without jumping.
- Zoom and pan via `d3.zoom` on the SVG, transform kept in a ref so updates do not reset it. Labels fade in between zoom 0.8 and 1.4 and are always shown for the hovered node and its neighbours.
- Hover computes the neighbour set from an adjacency map and sets an opacity class on nodes and edges. Click on a non-ghost node posts `openNote`. Drag pins a node while dragging and releases it on end, as in `D3NetworkGraph`.
- Calm resting state: radius `3 + 2 * sqrt(degree)` (max 16), thin edges at low opacity, no arrows. On hover the node's edges switch to the accent color and get small arrow markers (`markerUnits="userSpaceOnUse"`, 5px) at the target end, at both ends for bidirectional edges. Opacity changes use CSS transitions.
- Smooth motion: higher velocity decay (0.55), slower alpha decay (0.03), `forceX`/`forceY` instead of `forceCenter`, low restart alpha (0.15) on updates, and a one-time animated zoom-to-fit once the first layout has mostly settled.
- Colors: an ordinal scale over `group` with separate light and dark palettes (the same approach as `D3NetworkGraph`), plus `--vscode-*` variables for edges, labels, and background. Ghost nodes are drawn with a dashed outline and no fill.

Filtering happens in `NoteGraphApp`: it derives the visible nodes and edges from the full data plus search text and the two toggles, and passes them to the canvas. Orphans are evaluated against the visible edges, so "hide orphans" also hides notes whose only links point to hidden ghosts. Filter state is stored with `vscodeApi.setState` so it survives the panel being hidden.

### 4. Entry points
- `package.json`: command `janus.openNoteGraph` ("Janus: Notiz-Netzwerk öffnen", icon `$(type-hierarchy)`).
- Sidebar: a pinned `NoteGraphTreeItem` ("Netzwerk", `janus-graph:///all`) below `Kalender` in `NotesTreeDataProvider`, following the calendar pattern: `getTreeItemForUri` resolves the scheme, `getActiveNoteUri` maps the panel's view type to it, and the command calls `scheduleSyncSidebarSelection` so the entry is selected while the panel is active. No title-bar button.
- `extension.ts`: create `NoteGraphViewProvider` with the `CompanionManager`, register the command.
- Folder overview: `FolderOverviewViewProvider` gets an optional `getNotesRootUri: () => vscode.Uri | undefined` constructor parameter. `FolderOverviewData` gains `isNotesRoot` (folder mode only, path comparison). The webview shows a `Netzwerk` button in the header when it is true and posts `openNoteGraph`, which the provider maps to `executeCommand('janus.openNoteGraph')`.

## Risks / Trade-offs

- [SVG gets slow beyond roughly 1,000 nodes] → Assumption: typical collections stay well below that. The canvas component is isolated, so it can switch to `<canvas>` drawing later without touching service, provider, or filters.
- [Full rebuild reads every note on each save] → Debounced, only while the panel is open, and only disk saves trigger it (not typing). Fine for hundreds of notes. If it becomes noticeable, cache file contents by mtime.
- [Basename resolution picks the wrong note when two notes share a name] → Same behavior as the editor footer. Consistency matters more here than fixing it in the graph only.
- [Ghost IDs collide for different missing targets that differ only by folder] → They are merged into one ghost node. Acceptable for a hint feature that is hidden by default.
