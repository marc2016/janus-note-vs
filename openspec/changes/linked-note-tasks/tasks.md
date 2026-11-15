# Tasks

## 1. Linked task lines

- [x] 1.1 Add `src/services/linkedTaskLines.ts` (no `vscode` import) with `parseLinkedTaskLines`, `rewriteLinkedTaskLine`, `removeLinkedTaskId` and `newLinkedTaskId` (design.md decision 1); verify with `npm run compile`
- [x] 1.2 Add `tests/linkedTaskLines.test.ts` covering the "Linked Note Tasks" scenarios (recognition, non-linked lines including fenced code, empty title), rewriting title and done state with indentation and blockquote prefix kept, removing the ID, and unique ID generation; verify with `npx vitest run tests/linkedTaskLines.test.ts`

## 2. Editor

- [x] 2.1 Add `/aufgabe` and `/task` to `getSlashCommands()` with the line transformations of "Slash Commands for Linked Tasks"; keep `/tasks` unchanged; verify with `npm run compile`
- [x] 2.2 Add tests for the slash commands on an `EditorState`/mock view (text line, list item, checkbox, empty line with cursor before the ID, already linked line, `/tasks` unchanged); verify with `npx vitest run`
- [x] 2.3 Add `src/webviews/markdown/extensions/linkedTasks.ts` (ID hidden per syntax visibility mode, symbol with tooltip `In der Aufgabenliste`) and register it in `MarkdownEditorApp.tsx`; add decoration tests for `auto` with and without the cursor on the line, `hidden` and `visible`; verify with `npm run build` and `npx vitest run`
- [x] 2.4 Clicking the symbol of a linked task line opens the task list of the note's folder (saving an unsaved note first, hint when no task list exists) and briefly highlights the task there; add tests for the host handler; verify with `npx vitest run tests/linkedTaskOpen.test.ts`

## 3. Sync service

- [x] 3.1 Add `src/services/linkedTaskSync.ts` with note-to-list sync on `onDidSaveTextDocument` (update, move between folders, create, skip empty titles, write only on change, snapshot updated before writing) per design.md decision 3; verify with `npm run compile`
- [x] 3.2 Add list-to-note sync: snapshot of linked tasks, debounced detection via `onDidChangeTextDocument` for `tasks.json` and a `FileSystemWatcher`, line rewrite for title/done changes, ID removal for deleted tasks, writing to open documents (line edits, save only if not dirty before) or closed files (design.md decisions 4 and 5); verify with `npm run compile`
- [x] 3.3 Add `tests/linkedTaskSync.test.ts` with the vscode mock covering every scenario of "Note to Task List Synchronization", "Task List to Note Synchronization" and "Deleting Linked Tasks", including no write when nothing changed and no loop after a list change; verify with `npx vitest run tests/linkedTaskSync.test.ts`
- [x] 3.4 Register the sync service in `src/extension.ts` (disposed with the extension, notes root from the companion manager); verify with `npm run compile`

## 4. AI extraction

- [x] 4.1 Remove linked task lines from the note text in `AiTaskGeneratorService` before prompting; add a test that the prompt does not contain the linked line; verify with `npx vitest run`

## 5. Verification

- [x] 5.1 Run `npm test` and `npm run build`; all tests pass
- [ ] 5.2 Manual check: `/aufgabe` on text, a checkbox and an empty line, save, task appears in the folder list and the global list; check it in the list and in the calendar while the note is open with another unsaved change; rename in the list; check in the note and save; move the line to a note in another folder; delete the task in the list (ID disappears, line stays); ID hidden in auto mode except on the cursor line, symbol visible; AI extraction does not duplicate a linked line
