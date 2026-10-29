# Tasks

## 1. Daily note service

- [x] 1.1 Create `src/services/dailyNoteService.ts` with `dailyNotePath`, `isDailyNotePath` and `dailyNoteContent` (template `tagesnotiz` via `listTemplates`/`applyTemplate` with the note's date plus the current time, or the default frontmatter and heading); verify with unit tests for the location scenario and both scenarios of "Daily Note Content"
- [x] 1.2 Add `openOrCreateDailyNote(notesRoot, date)` (create `journal/` and the note only if missing, then open in the Janus Markdown Editor); verify with tests for first-call and already-exists (no write to an existing file)

## 2. Command

- [x] 2.1 Register `janus.openDailyNote` in `src/extension.ts` with the notes-root check and contribute it in `package.json` (icon `$(notebook)`, `view/title` navigation entry after `createNote`); verify with tests for the no-notes-root scenario and that the command opens today's note

## 3. Calendar

- [x] 3.1 Add the daily note entry to `extractNoteEventsFromMarkdown` (title from first heading or `Tagesnotiz`, no duplicate with a frontmatter date of the same day); verify with tests in `tests/calendarService.test.ts` for all three scenarios of "Daily Notes in the Calendar"
- [x] 3.2 Send `dailyNote: { date, exists }` from `CalendarDayDetailsViewProvider`, handle `openDailyNote`, and render the `Tagesnotiz öffnen` / `Tagesnotiz anlegen` button in `CalendarDayDetailsApp.tsx`; verify with tests in `tests/calendarDayDetailsViewProvider.test.ts` for both scenarios of "Daily Note Action in Day Details"

## 4. Wrap-up

- [x] 4.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 4.2 Manually create today's daily note from the title bar button, create one for another day from the calendar, add a `tagesnotiz` template and check a new daily note uses it
