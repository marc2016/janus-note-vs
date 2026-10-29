# Proposal

## Why

Many quick notes during a day belong to no project yet: what happened in a call, a decision, a thought for tomorrow. Today they end up in `inbox.md` (meant for sorting) or in ad-hoc files without a date. A daily note per day gives these notes a fixed, dated home, and Janus already has the pieces to make it useful: the calendar shows dated notes, templates (from `note-templates`) give each day the same structure, and inbox sorting or task generation can later pull from it.

## What Changes

- New command `janus.openDailyNote` (`Janus: Tagesnotiz öffnen`) opens today's daily note `<notesRoot>/journal/YYYY-MM-DD.md` in the Janus Markdown Editor, creating the folder and the note if needed. It is available in the command palette and as a button in the Notes view title bar.
- A new daily note gets its content from the template `tagesnotiz` in `<notesRoot>/.templates/` if it exists, with placeholders filled for that day. Otherwise it gets a default: frontmatter `date: YYYY-MM-DD` and the heading `# <Wochentag>, DD.MM.YYYY`.
- The calendar's Day Details panel shows `Tagesnotiz öffnen` for a day that has a daily note and `Tagesnotiz anlegen` for one that does not, for any selected day, not only today.
- The calendar shows every daily note on its day, even if its content has no date, and does not show it twice when its frontmatter also has that date.
- An existing daily note is never overwritten.

Non-goals (possible follow-ups): a configurable folder or file name pattern, weekly or monthly notes, navigating to the previous or next daily note from the editor, a keyboard shortcut, and moving unfinished tasks from yesterday's note.

## Capabilities

### New Capabilities

- `daily-notes`: location, creation, and opening of daily notes.

### Modified Capabilities

- `calendar-view`: daily notes appear on their day, and the Day Details panel can open or create the daily note of the selected day.

## Impact

- New `src/services/dailyNoteService.ts` (path for a date, default content, open-or-create).
- Depends on `note-templates` (`applyTemplate`, template lookup). Implement after it.
- `src/services/calendarService.ts` (daily note entries, de-duplication).
- `src/editors/calendarDayDetailsViewProvider.ts` and `src/webviews/calendar/CalendarDayDetailsApp.tsx` (button and message).
- `src/extension.ts` and `package.json` (command and `view/title` button).
- No new dependencies or settings.
