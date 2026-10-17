# Tasks

## 1. Link & Backlink Engine

- [ ] 1.1 Implement link extraction utilities (`extractDocumentLinks` for `[[...]]` and `[...](...)`) in `src/services/noteLinkService.ts` and verify with unit tests
- [ ] 1.2 Implement workspace backlink finder (`findBacklinks`) and companion task summary resolver in `src/services/noteLinkService.ts` and verify with unit tests

## 2. Editor Webview Messaging & Navigation

- [ ] 2.1 Update `MarkdownEditorProvider.ts` to query links and companion summaries and send `updateLinks` messages to the webview, and verify with compile check
- [ ] 2.2 Implement webview message handlers for `openLink` (opening note/tasks/chart) and `addLink` (QuickPick note selector) in `MarkdownEditorProvider.ts`, and verify with unit tests

## 3. Webview UI: Notes Links Footer Component

- [ ] 3.1 Create `NotesLinksFooter.tsx` with responsive companion pills (tasks board with task counter, diagram view), outgoing link pills, backlink pills, and `+ Verknüpfen` action in `src/webviews/markdown/components/NotesLinksFooter.tsx`
- [ ] 3.2 Integrate `NotesLinksFooter` into `MarkdownEditorApp.tsx` layout beneath the editor container, connecting state and event handlers, and verify with compile check

## 4. Verification and Polish

- [ ] 4.1 Create comprehensive test suite in `tests/noteLinkService.test.ts` covering wiki-links, markdown links, backlink discovery, and companion task metrics
- [ ] 4.2 Run full test suite with `npm test` and build production bundle with `npm run build` to verify clean build and test coverage
