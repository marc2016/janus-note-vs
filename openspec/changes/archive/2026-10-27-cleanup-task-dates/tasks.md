# Tasks

## 1. Remove Task Board leftovers

- [x] 1.1 Delete `src/webviews/tasks/TaskBoardApp.tsx` and verify `grep -rn TaskBoardApp src tests` finds nothing and `npm run compile` and `npm run build` succeed
- [x] 1.2 Rename the `openTaskBoard` message to `openFolderTasks` in `FolderOverviewApp.tsx` (handler name included) and `folderOverviewViewProvider.ts`, update the test in `tests/folderOverviewViewProvider.test.ts`, and verify it passes with `npx vitest run tests/folderOverviewViewProvider.test.ts`
- [x] 1.3 Change the labels "Aufgaben-Board" → "Aufgaben", "Zum Aufgaben-Board" → "Zu den Aufgaben", and the tooltip "…öffnet das Board" → "…öffnet die Aufgaben", and verify `grep -rn "Board" src/webviews/folderOverview` finds no user-facing text

## 2. Shared date chips

- [x] 2.1 Extract `src/webviews/tasks/TaskDateChips.tsx` from `TaskDateControls.tsx` (field order, icons, overdue/after-due styling, titles) with an optional `onChipClick`. In read-only mode chips have no `role="button"`, no tab stop, and no "klicken zum Ändern". Verify with `npm run compile` and by checking that the task list still opens the date picker when a chip is clicked
- [x] 2.2 Make `TaskDateControls` render `TaskDateChips` with `onChipClick={startEditing}` and verify `npx vitest run tests/taskDates.test.ts` and `npm run compile` still pass

## 3. Folder overview task preview

- [x] 3.1 Type `recentTasks` from `TaskItem` (`id`, `title`, `priority`, `dueDate`, `scheduledDate`, `completed`), build it through one mapper used by folder and multi mode, remove the `as any` casts, and extend `tests/folderOverviewViewProvider.test.ts` to assert that `scheduledDate` and `dueDate` reach the posted data
- [x] 3.2 Render read-only `TaskDateChips` in each preview row of `FolderOverviewApp.tsx` (title truncates, chips do not shrink) and verify in the running extension that a task with both dates shows `Geplant` and `Fällig` chips and an overdue task is marked red
- [x] 3.3 Replace the priority ternary with a lookup for `high` / `medium` / `low` and verify in the running extension that `medium` tasks get their own badge style

## 4. AI task generation

- [x] 4.1 Rename `normalizeDueDate` → `normalizeTaskDate`, make `dueDate` and `scheduledDate` `.nullish()` in `ExtractedTaskSchema`, normalize both in `parseAiExtractedTasks`, and add tests in `tests/aiTaskGeneration.test.ts` for: both dates extracted, `null` dates accepted, an unparseable `scheduledDate` dropped while the task is kept
- [x] 4.2 Update the system prompt to describe `dueDate` (deadline) and `scheduledDate` (planned work day), prefix the user prompt with `Heutiges Datum: YYYY-MM-DD` (local date), and pass `scheduledDate` into `TaskItemSchema.parse`. Add a test that asserts the prompt sent to the mocked `AiModelService` contains today's date and that a returned `scheduledDate` ends up in the written `tasks.json`

## 5. Agent tool schema

- [x] 5.1 Add `priority` (enum `low`/`medium`/`high`), `dueDate`, `scheduledDate` (string, "YYYY-MM-DD"), and `note` to the `janus_mutate_tasks` `tasks.items.properties` in `package.json`, update the `tasks` description, and verify `package.json` parses (`node -e "require('./package.json')"`)

## 6. Final check

- [x] 6.1 Run `npm test`, `npm run compile`, and `npm run build`, and verify all pass with no new warnings
