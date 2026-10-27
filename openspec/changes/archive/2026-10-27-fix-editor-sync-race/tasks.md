# Tasks

## 1. Sync Core

- [x] 1.1 Create `src/webviews/markdown/lib/documentSync.ts` with `minimalChange` and `DocumentSync` (`reset`, `recordLocal`, `takeOutgoing`, `applyRemote`). Verify with unit tests in `tests/documentSync.test.ts`: minimal diff cases (insert, delete, replace, identical, unicode), stale update ignored, own content unchanged, external change applied as a minimal change, external change rebased onto unsent local edits, and selection mapped to the same text position.

## 2. Host Side

- [x] 2.1 Add a per-panel `WebviewSyncTracker` to `MarkdownEditorProvider`: record `seq` and expected echo text in the `updateContent` handler, suppress the echo in `onDidChangeTextDocument`, and include `ackSeq` in `update` messages. Verify with unit tests: an echo of the webview's own edit is not posted, a later identical genuine change is posted, and `ackSeq` reflects the last applied `seq`.

## 3. Webview Side

- [x] 3.1 Wire `DocumentSync` into `MarkdownEditorApp.tsx`: send `updateContent` with `seq`, dispatch host updates as minimal remote transactions (`Transaction.remote`, `addToHistory: false`), record only local transactions, and replace `isUpdatingFromHostRef`. Verify with `npm run compile` and a test that runs the update-listener logic on an `EditorState`: a typing-during-echo sequence ends with all typed characters present.
- [x] 3.2 Flush pending edits immediately on editor blur and when the webview becomes hidden. Verify with `npm run compile` and a manual check (type, then switch tabs immediately; the text is saved).

## 4. Verification

- [x] 4.1 Run `npm run compile && npm run build && npm test` and confirm zero type errors and all tests pass.
- [x] 4.2 Manually check in the Extension Development Host:
  - fast typing with short pauses loses no characters and the cursor does not jump;
  - Cmd+Z in a side-by-side text editor of the same file updates the Janus editor without moving the cursor elsewhere;
  - link insertion and the AI inbox actions still update the editor.
