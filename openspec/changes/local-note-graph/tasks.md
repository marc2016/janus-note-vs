# Tasks

## 1. Neighbourhood logic

- [ ] 1.1 Add `localSubgraph(data, centreId, depth)` (undirected breadth-first search, edges among reached nodes) to `src/webviews/noteGraph/graphFilter.ts`; verify with unit tests in `tests/noteGraphFilter.test.ts` for the direct-neighbours, two-steps and centre-without-links scenarios
- [ ] 1.2 Add `mode`, `depth` and a `keepIds` option to the filter so the centre is exempt from search and ghost filtering and orphans are ignored in local mode; verify with tests for the search-keeps-centre, ghost-neighbours and switching-back scenarios

## 2. Centre tracking

- [ ] 2.1 Move `getActiveNoteUri` from `extension.ts` into a shared module and import it from both places; verify existing sidebar-sync tests still pass
- [ ] 2.2 In `NoteGraphViewProvider`, track `lastNoteUri` from tab and active-editor changes (notes under the roots only), post `focusNote` with the initial data and on changes; verify with tests in `tests/noteGraphViewProvider.test.ts` for following-the-editor, focusing-the-graph-panel and file-outside-the-collection

## 3. Webview UI

- [ ] 3.1 Add the mode switch (`Ganzes Netzwerk` / `Aktuelle Notiz`) and the `Tiefe` selector to `NoteGraphApp.tsx`, persisted in the webview state, and handle `focusNote` and `setMode`; verify with `npm run build` and by switching modes and hiding and showing the panel
- [ ] 3.2 Show `Öffne eine Notiz, um ihre Umgebung zu sehen.` when local mode has no centre (or the centre is not in the data yet); verify with a test of the hint condition
- [ ] 3.3 Add the `centreId` prop to `NoteGraphCanvas.tsx` (focus ring, permanent label, larger minimum radius, translate-only re-centring that keeps node positions); verify manually that switching notes re-centres smoothly without resetting zoom

## 4. Command

- [ ] 4.1 Add `NoteGraphViewProvider.openLocal(uri)` (notes-root check, open beside or reveal, post `setMode` and `focusNote`), register `janus.openLocalNoteGraph` in `extension.ts`, and contribute it in `package.json` with the `editor/title` overflow entry; verify with tests for both scenarios of "Open Local Graph Command" and that the command appears in the palette and the editor `...` menu

## 5. Wrap-up

- [ ] 5.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [ ] 5.2 Manually open the local graph from a note, switch notes, click through neighbours, change the depth, and check that `Ganzes Netzwerk` mode behaves as before
