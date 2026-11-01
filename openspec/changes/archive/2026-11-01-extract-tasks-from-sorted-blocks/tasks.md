# Tasks

## 1. Task extraction for several blocks

- [x] 1.1 Add a block-aware parser (shared item schema plus `block`, unknown block numbers dropped, dates normalized like `parseAiExtractedTasks`) to `aiTaskGeneratorService.ts`
- [x] 1.2 Add `extractTasksFromBlocks(blocks, token)`: group by target folder, one prompt with numbered blocks, targets, existing tasks per folder and today's date, append non-duplicate tasks per folder linked to the target note, return `{ tasksUri, existedBefore, added }[]`
- [x] 1.3 Tests in `tests/aiTaskGeneration.test.ts`: tasks land in each block's target folder, duplicates against the folder and within the run are skipped, unknown block numbers are dropped, one request for several blocks

## 2. Sorting

- [x] 2.1 Add the optional `AiTaskGeneratorService` constructor argument, the `janus.ai.inboxSortExtractTasks` reader, and `createdTasks` / `taskExtractionFailed` on `SortInboxResult`
- [x] 2.2 Add the preview row "Aufgaben aus einsortierten Abschnitten erzeugen" before the direct-mode row, preselected from the setting and kept across target edits; its state decides for this run only
- [x] 2.3 After writing, call the extraction with the written blocks and their targets (setting in direct mode, row state in preview), catch failures into `taskExtractionFailed`, and add the created tasks to the undo record
- [x] 2.4 Tests in `tests/aiInboxSorting.test.ts`: enabled in direct mode, disabled sends no second request, preview row enables for one run without changing the setting, deselected/changed blocks are not sent, failure keeps the sort and reports it, daily note blocks

## 3. Undo and messages

- [x] 3.1 Extend `InboxSortUndoRecord` with `tasks` and `UndoReport` with `keptTasks`; remove unchanged created tasks, keep changed ones, delete a created `tasks.json` that is empty again
- [x] 3.2 Show the created task count or the failure in `showInboxSortResult`, and the kept-task hint in the undo message
- [x] 3.3 Tests in `tests/inboxSortUndo.test.ts` for the three undo scenarios and in `tests/aiInboxSorting.test.ts` for the message texts

## 4. Setting

- [x] 4.1 Contribute `janus.ai.inboxSortExtractTasks` in `package.json`; read and update it in `settingsViewProvider.ts`; add the checkbox to section 2 of `SettingsApp.tsx`
- [x] 4.2 Test in `tests/settingsViewProvider.test.ts` that the state contains the setting and `updateAiConfig` writes it

## 5. Samples

- [x] 5.1 Mention task extraction while sorting in the inbox section of `sample/project-plan.md`

## 6. Wrap-up

- [x] 6.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 6.2 Manually: enable the option in the preview, sort `sample/inbox.md`, check the new tasks in the target folders' task views; sort once in direct mode with the setting on; undo once and check that the tasks are gone; toggle the setting in the Settings Panel
