# Tasks

## 1. Recording a run

- [x] 1.1 Define `InboxSortUndoRecord` and add `undo?: InboxSortUndoRecord` to `SortInboxResult`
- [x] 1.2 In `runSort`, collect the record while writing: appended notes (text before first / after last write, exact sections incl. separator, grouped per note), created notes with their text, folders created for them (walk up before `createDirectory`, deepest first), and the source note's text before/after, written block texts and inserted link lines; set `undo` only when something was written
- [x] 1.3 Extract the "write file and update open document" step from `runSort` into a helper reusable by undo

## 2. Undo

- [x] 2.1 Add `src/services/inboxSortUndo.ts` with `rememberSortRun`, `hasSortRunToUndo`, `undoLastSortRun` (clears the slot before writing) and `UndoReport`
- [x] 2.2 Implement the per-file undo rules from design.md (appended, created + empty folders, inbox restore or re-append, daily link removal), reading open documents' text where present
- [x] 2.3 Tests in a new `tests/inboxSortUndo.test.ts` for the spec scenarios: exact restore of inbox/appended/created, daily note links, created folder removal, undo only once, cancelled run keeps the previous record, note edited above the section, created note edited, inbox edited (blocks re-appended), appended section edited (note kept, reported)

## 3. Entry points

- [x] 3.1 In `showInboxSortResult`, remember `result.undo` and add a „Rückgängig" button next to „Notiz öffnen"; on click run the undo and show the report
- [x] 3.2 Register `janus.undoInboxSort` in `extension.ts` (report or "Keine Sortierung zum Rückgängigmachen vorhanden.", refresh the notes tree) and contribute it in `package.json` with title „Janus: Letzte Inbox-Sortierung rückgängig machen"
- [x] 3.3 Tests for the button and the command (result message offers „Rückgängig", command without record reports nothing to undo)

## 4. Samples

- [x] 4.1 Mention „Rückgängig" in the inbox section of `sample/project-plan.md`

## 5. Wrap-up

- [x] 5.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 5.2 Manually sort `sample/inbox.md` (with and without preview), undo via the button and via the command, and check inbox, appended and created notes; edit a target before undoing once; undo a daily note sort
