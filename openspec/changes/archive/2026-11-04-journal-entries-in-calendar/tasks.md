# Tasks

## 1. Calendar service

- [x] 1.1 Add the entry kind `journal` and `sorted?: boolean` to `CalendarEntry`; extend `extractNoteEventsFromMarkdown` with the optional `{ dailyTemplateHeadings }` and emit journal entries for daily notes (`#`/`##` outside frontmatter and fenced code, without the title and template headings, trailing `(HH:mm)` as time, `sorted` via `findSortedLinks`); drop the whole-note and frontmatter-date entry when journal entries exist. Verify with the unit tests in 1.3
- [x] 1.2 In `CalendarService.loadAllCalendarEntries`, load the `tagesnotiz` template headings once (placeholders `{{…}}` match any text, missing template → none) and pass them on; sort journal entries after notes and tasks of the same day, by line. Verify with the unit tests in 1.3
- [x] 1.3 Extend `tests/calendarService.test.ts`: the spec scenarios "Entries of a daily note", "Deeper headings and code are not entries", "Sorted entry", "Order in a day cell", "Daily note with journal entries", and that the existing daily note scenarios without entries still pass. Verify with `npx vitest run tests/calendarService.test.ts`

## 2. Webviews

- [x] 2.1 Month View (`CalendarMonthApp.tsx`): violet chip with `mdiNotebookOutline` (or the time), check mark for sorted entries, tooltip `Journal: …`, click opens the note at the heading line; verify with `npm run build`
- [x] 2.2 Day Details (`CalendarDayDetailsApp.tsx`): group `Journal (n)` after the task groups with time, title, `Einsortiert` badge and open button; empty-day text includes journal entries; verify with `npm run build`
- [x] 2.3 Run `npm test` and `npm run build`; all tests pass

## 3. Sample and manual check

- [x] 3.1 Update the daily note section of `sample/project-plan.md` to describe journal entries in the calendar (`journal/2026-10-29` and `2026-10-28` show them); verify `npm test` still passes
- [x] 3.2 Manual check: open the calendar, check the violet journal chips on 2026-10-28/29 (time, check mark on the sorted entry, appointments and tasks first), click a chip and a Day Details entry, add a new `##` entry to today's daily note and see it appear after saving
