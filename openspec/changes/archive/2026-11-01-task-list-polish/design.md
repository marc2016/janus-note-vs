# Design

## Context

Both task views (the `tasks.json` custom editor and the global task list) render the same React app, `src/webviews/tasks/TaskListApp.tsx`, and load `dist/webviews/globals.css`. Its `body` rule (`height: 100vh; overflow: hidden`) applies to every webview, so each app must provide its own scroll container. Settings and Export-Compendium already do this; the task list only uses `min-h-screen` (see proposal.md, Why).

The message protocol to the extension (`updateTasks`, `createTask`, `toggleTask`, `updateTask`, `deleteTask`, `openNote`) and the `tasks.json` format stay as they are. The whole change lives inside the webview.

## Goals / Non-Goals

**Goals:**
- Keep the sort logic in a pure, unit-tested module, as `taskDates.ts` already is.
- Reuse the existing UI primitives (`Button`, `Input`, `Select`, `Checkbox`, `MdiIcon`) and the popover pattern from `TaskDateControls`.

**Non-Goals:**
- Manual reordering (drag & drop) or persisting a sort order into `tasks.json`.
- Changing `globals.css` for all webviews. The fix stays local to the task list.
- Changing the calendar month view. It uses the same `min-h-screen` pattern and gets a separate check.

## Decisions

### Layout: fixed toolbar plus one scroll region
The root becomes `h-screen flex flex-col`. A non-scrolling top area holds the header, quick-add and search, and below it sits `flex-1 min-h-0 overflow-y-auto` for the list. This is the pattern already used in `ExportCompendiumApp`.
- *Alternative:* `position: sticky` toolbar inside a scrolling root. It is equivalent, but would differ from the other webviews.
- In global mode the folder headings are `sticky top-0` inside the scroll region, so the current folder stays visible while scrolling.

### Sorting: pure helper `taskSort.ts`
New module `src/webviews/tasks/taskSort.ts`:
- `type TaskSortMode = 'date' | 'priority' | 'file'`
- `sortTasks(tasks, mode, today = todayIso())` returns a new array and never mutates its input.
- The date key is `min(dueDate, scheduledDate)` over valid ISO dates (via `isIsoDate`). A task is overdue if `getTaskDateState` reports `dueOverdue || scheduledOverdue`. Overdue tasks form the first bucket, already sorted by their date key.
- Tie-breakers: priority rank (`high`=0, `medium`/missing=1, `low`=2), then `createdAt` (missing values last), then the original index. The original index makes the sort stable and deterministic.
- `splitByCompletion(tasks)` returns `{ open, done }` in the given order, so both sections use the same sorted list.

The app applies, in this order: search filter, then sort, then split. In global mode this runs per folder group.

### View state via `vscode.setState`
The app stores `{ sortMode, collapsed: Record<string, boolean> }` with `getVsCodeApi().getState()/setState()`.
- Keys: `done:<folderUri>` and `group:<folderUri>` in global mode, `done:folder` in folder mode.
- The default for `done:*` is collapsed, so a missing key means collapsed. Folder groups default to expanded.
- *Alternative:* a VS Code setting. It is overkill for pure view state and would need the extension side.
- The webview state survives hide/show (`retainContextWhenHidden` is not required) and reloads within the session. Both views share the same app code but have separate webview state.
- Search override: if the query is non-empty and a done section has matches, it renders expanded without writing to the state.

### Priority indicator
- Each row gets a narrow `button` (about 4px wide, full row height) at the left edge, coloured red, amber or slate. The colours match the existing badge variants `high`, `medium` and `low`.
- It has `title` and `aria-label` „Priorität: Hoch/Mittel/Niedrig“, and clicking or pressing Enter/Space calls the existing `NEXT_PRIORITY` cycle.
- The hit area is widened with padding or a pseudo-element, so it stays clickable without looking heavy.
- The priority badge is removed from the row.

### Quick-add options menu
- The quick-add bar keeps only the title `Input`, plus an icon button (e.g. `mdiTune`) that opens a small popover. It uses the same outside-click/Escape handling as `TaskDateControls`.
- The popover contains a priority `Select`, a note `Input` and, in global mode, a folder `Select`.
- Non-default choices show as small chips next to the input (e.g. folder name, „Hoch“, note name), so the target folder in global mode is visible without opening the menu.
- Priority and folder persist between adds, and the note is cleared after each add.

### Row and header styling
- Rows lose the card border look. The list uses subtle dividers, and the global mode replaces the `Card` per folder with a heading row (chevron, folder name, open count).
- The note chip and the date chips stay, but are visually muted until hover or overdue. The delete button stays hover-only.
- Note, scheduled date and due date sit in fixed-width columns, so their values line up across rows even when a row has no value.
  - The note column is `w-32` with truncation.
  - Each date column is a fixed slot, and an empty slot offers „+ Geplant“ / „+ Fällig“ on hover. This replaces the „+ Datum“ menu.
  - Only the chips are dimmed, not the slots, so the date popover is not trapped in a stacking context.
- The header shows the title, an „n offen“ counter and the sort `Select`.

## Risks / Trade-offs

- [Removing the filter pills drops „only open“ and „only done“ views] → The done section is collapsed by default, which gives the „only open“ view. Expanding it shows everything.
- [Webview state is per webview instance and is lost when the editor is closed] → This is acceptable for view preferences. The default („Datum“, done collapsed) is a sensible start.
- [A sticky folder heading plus a narrow priority bar could collide with the date popover's z-index] → Give popovers a higher z-index than sticky headings, and check this manually in the sample workspace.
- [The date sort moves a task immediately after its date is edited] → This is intended. The row stays keyed by id, so the open date popover closes on re-render. That is acceptable, since the change is already committed.
