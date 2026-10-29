# Design

## Context

- `note-templates` provides `listTemplates(notesRoot)` and the pure `applyTemplate(text, { title, now })`. This change depends on it.
- `extractNoteEventsFromMarkdown(content, noteUri, notesRootUri)` turns a frontmatter `date:` into a note entry with id `ev-fm-<relPath>-<date>`, titled with the first heading or the file name. `loadAllCalendarEntries` calls it per note.
- The Day Details panel (`CalendarDayDetailsApp.tsx`) receives `events` and `selectedDate` and already formats German weekday names. Its provider handles `openNote` messages with a note path.

## Goals / Non-Goals

**Goals:**
- One function decides the path and the content of a daily note, shared by the command and the Day Details button.

**Non-Goals:**
- Making the `journal` folder or file name configurable (decided: fixed `journal/YYYY-MM-DD.md`).

## Decisions

### 1. `dailyNoteService.ts`

```ts
dailyNotePath(notesRoot, date: Date): Uri                 // <root>/journal/YYYY-MM-DD.md, local date
dailyNoteContent(notesRoot, date: Date, now: Date): Promise<string>
openOrCreateDailyNote(notesRoot, date: Date): Promise<Uri>  // create if missing, then vscode.openWith
isDailyNotePath(relPath): string | undefined               // 'journal/2026-10-29.md' -> '2026-10-29'
```

`dailyNoteContent` looks for a template named `tagesnotiz` (case-insensitive) via `listTemplates`. If it finds one, it calls `applyTemplate` with `title = YYYY-MM-DD` and a "now" built from the **note's date** combined with the current time, so `{{date}}` and `{{weekday}}` describe the day the note is for, and `{{time}}` the moment it was created. Otherwise it produces the default frontmatter and heading.

`openOrCreateDailyNote` checks existence with `fs.stat`. If the note is missing, it creates `journal/` with `createDirectory` (a no-op if it exists) and writes the content. It never writes to an existing file. Afterwards it refreshes the Notes tree.

*Alternative considered:* letting `applyTemplate` take a separate "for date". Building the combined `now` in the daily note service keeps the template API as small as it is.

### 2. Calendar entry for daily notes

In `extractNoteEventsFromMarkdown`, after the frontmatter step: if `isDailyNotePath(noteRelPath)` returns a date and no entry with that date was produced from the frontmatter, push a note entry `ev-daily-<relPath>` for that date, titled with the first heading or `Tagesnotiz`, at line 1. Text-date extraction continues unchanged, so appointments inside the daily note still show up on their own days. One exception: in a daily note, a text entry on the note's own date that comes from a heading line is dropped, because the default heading `# Donnerstag, 29.10.2026` (and templates like it) would otherwise add a second entry for the same day. Same-day appointments in normal lines stay.

### 3. Day Details button

The provider sends `dailyNote: { date, exists }` with every update for the selected date (one `fs.stat`). The webview renders a small button below the date heading: `Tagesnotiz öffnen` / `Tagesnotiz anlegen`. A click posts `{ type: 'openDailyNote', date }`. The provider parses `YYYY-MM-DD` into a local `Date`, calls `openOrCreateDailyNote`, then refreshes, which flips the button text. The calendar's file watcher refreshes the month view on its own.

### 4. Command and title bar button

`janus.openDailyNote` uses `companionManager.getNotesRootUri()` and the same "set up notes folder first" check as other root-dependent commands, then `openOrCreateDailyNote(root, new Date())`. In `package.json`, the command gets the icon `$(notebook)` and a `view/title` entry for `janus.notesView` in the `navigation` group, after `createNote`, so it sits next to the existing buttons.

## Risks / Trade-offs

- [Daily notes created just after midnight belong to the new day] → Intended. The local date decides.
- [Users rename `journal` or move daily notes elsewhere] → They then stop being daily notes (no calendar entry from the file name, and the command creates a new one in `journal/`). This follows from the fixed location the user chose.
- [Template named `tagesnotiz` is also offered in `createNote`] → Fine: it's a normal template and can be used manually too.
