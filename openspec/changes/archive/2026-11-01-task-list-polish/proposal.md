# Proposal

## Why

The task list (folder `tasks.json` editor and the global workspace list) cannot be scrolled: the shared webview stylesheet clips the body at `100vh` with `overflow: hidden`, and the task list has no scroll container of its own, so tasks below the fold are unreachable. The list also looks crowded: up to six controls per row, a text priority pill on every row, duplicated counters, a heavy quick-add bar, open and completed tasks mixed in file order, and one card per folder in global mode.

## What Changes

- **Scrolling**: the header, quick-add bar and search stay fixed at the top and only the task list scrolls.
- **Open and done sections**: open tasks are shown first. Completed tasks move into a collapsible section „Erledigt (n)“ at the bottom. In global mode each folder group has its own done section.
- **Selectable sort order** via a dropdown, which affects display only (`tasks.json` order is never changed):
  - **Datum**: overdue tasks first, then by the earliest of due/scheduled date, then tasks without date; ties are broken by priority, then creation date.
  - **Priorität**: high → medium → low; ties are broken by date as above.
  - **Dateireihenfolge**: the order in `tasks.json` (today's behaviour).
- **Remembered view state**: the sort choice and the collapsed state of the done sections are kept per webview (VS Code webview state) and survive hiding/reloading the view.
- **Calmer styling**:
  - Priority is shown as a coloured bar on the left of each row instead of a text pill. Clicking the bar cycles the priority as before, and a tooltip names the priority.
  - The quick-add bar is reduced to the title field. Priority, note and (in global mode) the target folder move into a compact options menu next to it.
  - The filter pills („Alle / Nur Offene / Erledigt“) are removed. Search and an open-task counter remain. **BREAKING** (UI only): the „Nur Offene“ and „Erledigt“ filters go away, and the done section takes their place.
  - In global mode folders are plain section headings (still collapsible) instead of cards.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `folder-tasks`: new requirements for the task list layout (scrolling with fixed toolbar, open and done sections, selectable sort order, remembered view state, priority indicator). The filter-pill behaviour is not specified today, so no existing requirement is removed; the date-chip requirement is unchanged.

## Impact

- `src/webviews/tasks/TaskListApp.tsx`: layout, sections, sort dropdown, quick-add options menu, priority bar, global-mode headings, webview state.
- New pure helper `src/webviews/tasks/taskSort.ts` (sort comparators) with tests in a new `tests/taskSort.test.ts`.
- `src/webviews/tasks/TaskDateControls.tsx` / `TaskDateChips.tsx`: styling only, if needed to fit the calmer row.
- No changes to the extension-side providers, the message protocol or the `tasks.json` format.
- Sample guide `sample/project-plan.md`: short entry for the task list.
