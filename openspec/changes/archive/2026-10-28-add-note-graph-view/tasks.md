# Tasks

## 1. Graph data

- [x] 1.1 Create `src/services/noteGraphService.ts` with the `GraphNode` / `GraphEdge` / `NoteGraphData` types and `buildNoteGraph(roots, primaryRoot)` (one read per note, `extractDocumentLinks` + `resolveOutgoingLink` with a per-build resolution cache, group from first path segment or root folder name, degree as distinct note neighbours) and verify with `npm run compile`
- [x] 1.2 Add `tests/noteGraphService.test.ts` covering: duplicate links collapse into one edge, mutual links become one `bidirectional` edge, self-links ignored, links to `app.ts:42` and `https://` ignored, missing targets become one shared ghost node, notes from an included folder link to the notes root, group and degree values. Verify with `npx vitest run tests/noteGraphService.test.ts`

## 2. Panel provider and command

- [x] 2.1 Create `src/editors/noteGraphViewProvider.ts` (view type `janus.noteGraph`, title `Notiz-Netzwerk`, singleton create/reveal, HTML/CSP like the folder overview, `ready` → post `graphData`, `openNote` → open in `MarkdownEditorProvider.viewType`, info message and no panel when the notes root is not initialized) and verify with `npm run compile`
- [x] 2.2 Add the panel-scoped `**/*.md` watcher and the `janus.notesRoot` / `janus.includeFolders` configuration listener with a 500 ms debounce, ignore events outside the notes roots, discard stale builds via a generation counter, dispose everything on panel close, and verify with tests in `tests/noteGraphViewProvider.test.ts` (open/reveal creates one panel, `openNote` calls `vscode.openWith`, uninitialized root shows a message, a burst of watcher events triggers one rebuild, no rebuild after dispose)
- [x] 2.3 Register `janus.openNoteGraph` in `package.json` (title `Janus: Notiz-Netzwerk öffnen`, icon `$(type-hierarchy)`, pinned `Netzwerk` sidebar entry below `Kalender` with sidebar selection sync) and in `src/extension.ts`, and verify `node -e "require('./package.json')"` and `npm run compile` pass

## 3. Webview

- [x] 3.1 Add the `noteGraph` entry to `esbuild.js` and create `src/webviews/noteGraph/index.tsx` and `NoteGraphApp.tsx` (receives `graphData`, posts `ready`), and verify `npm run build` emits `dist/webviews/noteGraph.js`
- [x] 3.2 Implement `NoteGraphCanvas.tsx`: persistent `forceSimulation` in a ref, keyed `join` updates that keep positions of existing nodes and place new ones near a neighbour, `d3.zoom` with transform kept across updates, degree-based radius, folder color scale for light and dark, arrow markers (both ends for bidirectional edges), dashed ghost nodes. Verify in the running extension with the `sample` notes: nodes and edges appear, zoom/pan/drag work, colors are readable in a light and a dark theme
- [x] 3.3 Add hover highlighting (node, neighbours, connecting edges full opacity, rest faded), labels fading in with zoom and always shown for the hovered node and its neighbours, arrows only on the hovered node's edges, and click on a note node posting `openNote` (no message for ghosts). Verify in the running extension that hovering `project-plan` highlights only its neighbours and clicking a node opens the note in the Janus editor
- [x] 3.4 Add the toolbar in `NoteGraphApp`: search field (title or relative path, case-insensitive), `Verwaiste Notizen anzeigen` (on) and `Fehlende Notizen anzeigen` (off) toggles, visible note/link counts, empty-state hint, filter state saved with `vscodeApi.setState`. Put the filtering in a pure function and test it in `tests/noteGraphFilter.test.ts` (search, orphans evaluated against visible edges, ghosts hidden by default)
- [x] 3.5 Verify live updates in the running extension: with the panel open, add a link to a sample note and save; the edge appears within a few seconds without the zoom or filters resetting. Delete a note; its node disappears

## 4. Root overview button

- [x] 4.1 Add the optional `getNotesRootUri` constructor parameter to `FolderOverviewViewProvider`, set `isNotesRoot` in folder-mode data, handle the `openNoteGraph` message, and pass the callback from `extension.ts`. Extend `tests/folderOverviewViewProvider.test.ts`: `isNotesRoot` is true only for the root folder, and `openNoteGraph` executes `janus.openNoteGraph`
- [x] 4.2 Show a `Netzwerk` button in the `FolderOverviewApp.tsx` header only when `isNotesRoot` is true, and verify in the running extension that it appears on the root overview, not on a subfolder or a multi-selection, and opens the graph

## 5. Final check

- [x] 5.1 Run `npm test`, `npm run compile`, and `npm run build`, and verify all pass with no new warnings
