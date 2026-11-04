# Design

## Context

- `extractNoteEventsFromMarkdown(content, noteUri, notesRootUri)` in `calendarService.ts` is a pure function that returns `CalendarEntry[]` for one note. For daily notes it adds a whole-note entry (`ev-daily-…`) unless an entry on that date already exists (the frontmatter `date` entry), and it drops entries produced by headings that contain the note's own date.
- `CalendarService.loadAllCalendarEntries` scans all notes (skipping folders starting with `.`, so `.templates` is never scanned), adds task entries and sorts by date, then "no time first", then time, then title.
- The Month View renders at most three chips per day (blue for `kind: 'note'`, green for tasks) and calls `handleOpenNote(notePath, line)` on click. The Day Details panel groups entries by kind (`Termine aus Notizen`, `Fällige Aufgaben`, `Geplante Aufgaben`).
- `findSortedLinks(text)` (`sortedLinkScan.ts`) returns every `-> [[…]]` line with the heading line of its block, shared with the sorter and the editor.
- The `tagesnotiz` template is found through `listTemplates(notesRoot)` (`dailyNoteService.ts`).
- The calendar already refreshes on `**/*.md` changes, which includes edits to the template.

## Goals / Non-Goals

**Goals:**
- One calendar entry per journal entry, cheap enough to compute on every refresh.
- No change for appointments and tasks.

**Non-Goals:**
- `###` headings or content blocks without heading as entries.
- Showing journal entries in other views (task overview, graph).
- Making the number of chips per day cell configurable.

## Decisions

**1. New entry kind `journal`.**
`CalendarEntryKind` becomes `'note' | 'task' | 'journal'`, and `CalendarEntry` gets `sorted?: boolean`. A journal entry carries `noteUri`, `notePath`, `line` (1-based heading line), `title`, optional `time`. A separate kind keeps the webviews' styling and grouping a simple switch, and existing `kind === 'note'` filters keep meaning "appointments".
- *Alternative:* `kind: 'note'` with a flag. Rejected: every existing `kind === 'note'` check would need to exclude it.

**2. Extraction inside `extractNoteEventsFromMarkdown`, template headings as an option.**
The function gets an optional fourth parameter `{ dailyTemplateHeadings?: RegExp[] }`. For a daily note it walks the lines (skipping frontmatter and fenced code), takes `^#{1,2}\s+(.+)$` headings, skips the first `#` heading and any heading whose text matches a template pattern, and strips a trailing `(HH:mm)` into `time`. `sorted` is true when `findSortedLinks` reports a link whose `headingLine` is this heading. If at least one journal entry exists, the whole-note entry and the frontmatter-date entry of the note are not emitted; other entries stay as they are.
- `CalendarService` reads the template once per `loadAllCalendarEntries` call: `listTemplates`, pick `tagesnotiz` (case-insensitive), take its `#`/`##` heading texts except its first `#` heading (the title; a placeholder title like `# {{weekday}}` would match every heading) and turn each into a regex where `{{…}}` placeholders become `.+` and everything else is escaped literally, anchored on both ends and trimmed. A missing or unreadable template yields an empty list.
- *Alternative:* fill the template with the note's date and compare literally. Rejected: placeholders like `{{time}}` depend on the creation moment and can never be reproduced.

**3. Sort order per day.**
The comparator ranks by date, then kind group (`note`/`task` before `journal`), then the existing time/title rules for non-journal entries and the line number for journal entries.

**4. Webviews.**
Month View: journal chips use `bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25`, `mdiNotebookOutline` when there is no time (time in front otherwise, like appointments), and a small `mdiCheck` before the title when `sorted`. The tooltip prefixes `Journal: `. Day Details: a new group `Journal (n)` after the task groups with the same card layout as appointments, left border violet, and the sorted mark as a small badge `Einsortiert`. The empty-day message mentions journal entries too.

**5. Opening at the heading line.**
Both calendar hosts (`calendarViewProvider.ts`, `calendarDayDetailsViewProvider.ts`) ignored the `line` the webviews send and always opened the note at the top. For journal entries the webviews now add `revealLine: true`, and the hosts then call the existing command `janus.openNoteAtLine(uri, line)`. Other entries keep `vscode.openWith` unchanged.
- *Alternative:* honor `line` for every entry. Rejected for this change: it would also change how appointments open, which is not part of the request.

## Risks / Trade-offs

- [Busy days push appointments into `+N`] → Mitigated by the order (journal last); the full list stays in Day Details.
- [A user edits a template heading after notes were written] → Older notes' headings no longer match and become entries; acceptable and visible.
- [Template heading with a placeholder like `## {{weekday}}`] → Matches any `##` heading text and would hide every entry; such templates are unusual, and the rule is documented in the spec.
