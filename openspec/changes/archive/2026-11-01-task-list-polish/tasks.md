# Tasks

## 1. Sort helper

- [x] 1.1 Add `src/webviews/tasks/taskSort.ts` with `TaskSortMode`, `sortTasks(tasks, mode, today)` (date/priority/file rules and tie-breakers from design.md, non-mutating, stable) and `splitByCompletion`
- [x] 1.2 Add `tests/taskSort.test.ts` covering the spec scenarios „Sorting by date“, „Sorting by priority“ and „Sorting by file order“, plus missing priority, missing/invalid dates, `createdAt` ties and input not mutated; verify with `npm test`

## 2. Layout and scrolling

- [x] 2.1 Restructure `TaskListApp` into `h-screen flex flex-col` with a fixed top area (header, quick-add, search) and a `flex-1 min-h-0 overflow-y-auto` list region; verify a long `tasks.json` scrolls to the last task in both folder and global mode
- [x] 2.2 Header: title, „n offen“ counter and sort `Select` („Datum“, „Priorität“, „Dateireihenfolge“, default „Datum“); remove the filter pills and the combined badge

## 3. Sections and view state

- [x] 3.1 Render open tasks, then a collapsible „Erledigt (n)“ section (collapsed by default, hidden when n = 0), using search filter → `sortTasks` → `splitByCompletion`; in global mode do this per folder group
- [x] 3.2 Global mode: replace the folder `Card`s with sticky, collapsible heading rows (chevron, folder name, open count)
- [x] 3.3 Persist `{ sortMode, collapsed }` with `getState/setState` (keys `done:folder`, `done:<uri>`, `group:<uri>`); restore on load; while a search is active, show done sections with matches expanded without writing state

## 4. Rows and quick-add

- [x] 4.1 Replace the priority badge with a left-edge priority `button` (red/amber/slate, `title`/`aria-label` „Priorität: …“, click/Enter/Space cycles via `NEXT_PRIORITY`); mute note and date chips until hover unless overdue
- [x] 4.2 Reduce quick-add to the title `Input` plus an options popover (priority, note, folder in global mode) with outside-click/Escape closing like `TaskDateControls`; show non-default choices and the global target folder as chips next to the input; keep priority/folder after adding, clear note
- [x] 4.3 Make sure date and options popovers render above sticky folder headings (z-index)

## 5. Samples

- [x] 5.1 Make sure a sample `tasks.json` has enough tasks (mix of open/done, priorities, due/scheduled incl. overdue) to show scrolling and sorting, and add a short task list entry to `sample/project-plan.md` (sort dropdown, „Erledigt“ section, priority bar)

## 6. Wrap-up

- [x] 6.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 6.2 Manually check in the sample workspace: scrolling with fixed toolbar (folder + global), all three sort modes, completing/reopening moves tasks between sections, sort and collapse state survive switching tabs, search expands matching done sections, priority bar cycling, quick-add with options and target folder, date popover not hidden by sticky headings
