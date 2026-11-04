# Proposal

## Why

The calendar shows a daily note only as one entry titled with the note's heading (`Donnerstag, 29.10.2026`), in the same blue as appointments. What was actually written that day, the individual journal entries and their times (added by `daily-note-heading-time`), is not visible in the calendar.

## What Changes

- Every journal entry of a daily note appears as its own entry in the calendar on the note's date. A journal entry is a `#` or `##` heading of the daily note, except the note's title heading and except headings that also appear in the `tagesnotiz` template (for example `## Notizen`, `## Für morgen`); headings inside fenced code are ignored.
- A heading time `(HH:mm)` becomes the entry's time and is removed from its title.
- Journal entries have their own color (violet) and a notebook icon in the Calendar Month View, distinct from appointments (blue) and tasks (green). Clicking one opens the daily note at the heading's line.
- In each day cell, journal entries come after appointments and tasks, in the order they appear in the note, so appointments and due tasks keep the visible slots.
- Entries that were already sorted (their block has a `-> [[…]]` line) show a small check mark.
- The Day Details panel lists the journal entries of the selected day in their own group `Journal`, with time, title and sorted mark.
- When a daily note has at least one journal entry, the single whole-note entry for it is no longer shown; without journal entries it stays as today.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `calendar-view`: *Daily Notes in the Calendar* changes (whole-note entry only without journal entries) and a new requirement *Journal Entries in the Calendar* is added.

## Impact

- `src/services/calendarService.ts`: new entry kind `journal` (with `sorted`), extraction of journal entries, loading the `tagesnotiz` template headings once per load, sort order per day.
- `src/webviews/calendar/CalendarMonthApp.tsx` and `CalendarDayDetailsApp.tsx`: chip style and icon, new `Journal` group.
- `src/editors/calendarViewProvider.ts` and `calendarDayDetailsViewProvider.ts`: open journal entries at their line via `janus.openNoteAtLine` (flag `revealLine` in the `openNote` message).
- Tests: `tests/calendarService.test.ts`, `tests/calendarViewProvider.test.ts`, `tests/calendarDayDetailsViewProvider.test.ts`.
- `sample/`: guide text for the calendar.
- Assumptions taken from exploration (not explicitly confirmed): journal entries go after appointments and tasks in a day cell, and sorted entries get a check mark.
