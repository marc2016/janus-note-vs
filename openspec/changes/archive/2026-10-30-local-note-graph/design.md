# Design

## Context

- `NoteGraphViewProvider` owns one panel, builds the full graph with `buildNoteGraph` and posts it as `graphData`. The webview filters it with `filterGraph` and keeps the filter in `getState()`.
- Node ids are note URIs (`uri.toString()`), and ghost ids start with `ghost:`.
- `getActiveNoteUri()` in `extension.ts` reads the active tab (`TabInputText`, `TabInputCustom`) and maps Janus webviews to pseudo URIs (`janus-graph:///all` …).
- `extension.ts` already listens to `tabGroups.onDidChangeTabs` for sidebar selection syncing.

## Goals / Non-Goals

**Goals:**
- Local mode without a second data path: same graph data, filtered client-side.
- The global mode behaves exactly as before.

**Non-Goals:**
- A force layout tuned specially for small graphs. The existing simulation copes with few nodes.

## Decisions

### 1. Centre tracking in the provider, neighbourhood in the webview

```
editor focus change --> provider: is it a note under the roots?
                          | yes                       | no (graph, webview, other file)
                          v                           v
                 lastNoteUri = uri               keep lastNoteUri
                 post {type:'focusNote', uri}
                          |
                          v
webview: centre = uri --> localSubgraph(data, centre, depth) --> filterGraph(...)
```

The provider keeps `lastNoteUri`, updated from `tabGroups.onDidChangeTabs` and `window.onDidChangeActiveTextEditor` through `getActiveNoteUri()` (moved to a small shared module so the provider can import it without depending on `extension.ts`). Only URIs whose path is a Markdown note under one of the roots count (`isUnderNotesRoots` plus `isMarkdownNote`). It is sent with the initial `graphData` and on every change, even while the webview is in global mode, so switching modes needs no round trip. Tracking starts when the panel is created. Before that, the command passes the active note explicitly.

*Alternative considered:* computing the neighbourhood in the provider and sending a smaller graph. That needs a rebuild per focus change and per depth change, and duplicates the filter state on both sides.

### 2. `localSubgraph` as a pure function before `filterGraph`

`localSubgraph(data, centreId, depth)` does a breadth-first search over the edges, treated as undirected, up to `depth`, and returns the reached nodes and the edges among them. The webview applies it first, then `filterGraph` with `showOrphans` forced to `true` and with the centre exempt from the search and ghost filters (a `keepIds` option on `filterGraph`). The centre id that is not in the graph data (for example a note just created and not yet rebuilt) yields the hint instead of an empty canvas, until the next rebuild delivers it.

### 3. State and messages

`GraphFilterOptions` gets `mode: 'all' | 'local'` and `depth: 1 | 2 | 3`, persisted like the other options. New messages:
- provider → webview: `focusNote { uri }`, `setMode { mode: 'local' }` (from the command)
- webview → provider: none new. Clicking a node already sends `openNote`, and opening the note produces a focus change, which re-centres.

### 4. Centre emphasis

`NoteGraphCanvas` gets a `centreId` prop. The centre node is drawn with a thicker ring in `--vscode-focusBorder`, its label is always visible, and it gets a slightly larger minimum radius. When the centre changes, the canvas keeps positions of nodes that stay and gently re-centres the view on the new centre (`zoom.translateTo` with a short transition) instead of resetting the zoom.

### 5. Command and menu

`janus.openLocalNoteGraph` calls `NoteGraphViewProvider.openLocal(activeNoteUri)`. That runs the same notes-root check as `open()`, creates the panel in `ViewColumn.Beside` (or reveals the existing one where it is), sets `lastNoteUri`, and posts `setMode` plus `focusNote`. Menu: `editor/title` with group `1_janus@20` (overflow) and the same `when` clause as the PDF export entry.

## Risks / Trade-offs

- [Opening the panel beside the editor makes the editor's group the "other" one, and focusing the panel fires tab changes] → The provider ignores tab changes whose active tab is the graph panel or any webview, so the centre is kept.
- [Depth 3 in a densely linked collection can be almost the whole graph] → Acceptable, as the limit is 3. The count in the toolbar shows how many notes are visible.
- [Re-centring while the user is dragging or zoomed in] → Only translate the view, never change the zoom level, and skip the transition if the user is currently dragging.
