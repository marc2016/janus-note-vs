# Spec Delta

## MODIFIED Requirements

### Requirement: Daily Notes in the Calendar
The calendar SHALL show every daily note (as defined in `daily-notes`) that has no journal entries (as defined in "Journal Entries in the Calendar") as a note entry on its date, titled with its first `#` heading or, without one, `Tagesnotiz`, even if the note's content contains no date. When the note's frontmatter `date` is the same date, the calendar SHALL show only one entry for it. A daily note with at least one journal entry SHALL be represented by its journal entries instead, without this whole-note entry and without an entry for its frontmatter `date`. A heading of the daily note that contains the note's own date SHALL NOT produce an additional entry. Other dates mentioned inside a daily note, including the note's own date outside headings, SHALL still produce their own entries as today.

#### Scenario: Daily note without a date in its content
- **WHEN** `journal/2026-10-29.md` contains only `# Donnerstag` and some text
- **THEN** the calendar shows an entry `Donnerstag` on 2026-10-29 that opens the note

#### Scenario: No duplicate with frontmatter date
- **WHEN** `journal/2026-10-29.md` has frontmatter `date: 2026-10-29` and no journal entries
- **THEN** the calendar shows one entry for this note on 2026-10-29

#### Scenario: Own date in the heading
- **WHEN** `journal/2026-10-29.md` has frontmatter `date: 2026-10-29`, the heading `# Donnerstag, 29.10.2026` and no journal entries
- **THEN** the calendar shows one entry for this note on 2026-10-29

#### Scenario: Appointment inside a daily note
- **WHEN** `journal/2026-10-29.md` contains `Review am 05.11.2026`
- **THEN** the calendar shows the daily note on 2026-10-29 and the review entry on 2026-11-05

#### Scenario: Daily note with journal entries
- **WHEN** `journal/2026-10-29.md` has frontmatter `date: 2026-10-29`, the title `# Donnerstag, 29.10.2026` and the headings `## Call mit Anna (09:40)` and `## Idee`
- **THEN** the calendar shows the two journal entries on 2026-10-29 and no entry titled `Donnerstag, 29.10.2026`

## ADDED Requirements

### Requirement: Journal Entries in the Calendar
The calendar SHALL show every journal entry of a daily note as its own entry on the daily note's date. A journal entry SHALL be a heading of level 1 or 2 (`#` or `##`) in the daily note outside fenced code, except the note's first `#` heading (its title) and except headings whose text matches a `#` or `##` heading of the template `tagesnotiz` (as defined in `note-templates`) other than the template's own first `#` heading, where template placeholders match any text. Without such a template, only the title is excluded. When the heading text ends with a time `(HH:mm)`, the entry SHALL have that time and its title SHALL be the heading text without it; otherwise the entry has no time. A journal entry SHALL be marked as sorted when its block contains a line `-> [[…]]` (as defined in `ai-inbox-sorting`).

The Calendar Month View SHALL render journal entries in a color and with an icon that differ from both note appointments and tasks, show the time before the title when present, and show a check mark for sorted entries. Within a day cell, journal entries SHALL be listed after all note appointments and tasks of that day, in the order they appear in the daily note. Clicking a journal entry SHALL open the daily note in the Janus Markdown Editor at the heading's line. The Day Details panel SHALL list the journal entries of the selected day in a separate group `Journal`, in the order of the note, each with its time (if any), title, sorted mark and a button to open the note at the heading's line.

#### Scenario: Entries of a daily note
- **WHEN** `journal/2026-10-29.md` contains the title `# Donnerstag, 29.10.2026`, `## Call mit Anna: Crash-Reporting (09:40)`, `## Idee: Dunkelmodus` and the template headings `## Notizen` and `## Für morgen`, and `.templates/tagesnotiz.md` contains `# {{weekday}}, {{date:DD.MM.YYYY}}`, `## Notizen` and `## Für morgen`
- **THEN** the calendar shows exactly two journal entries on 2026-10-29: `Call mit Anna: Crash-Reporting` at 09:40 and `Idee: Dunkelmodus` without time

#### Scenario: Deeper headings and code are not entries
- **WHEN** a daily note contains `### Detail` and, inside a fenced code block, `## Beispiel`
- **THEN** neither produces a journal entry

#### Scenario: Sorted entry
- **WHEN** the block `## Call mit Anna (09:40)` is followed by the line `-> [[projects/App-Launch/architektur]]`
- **THEN** its journal entry is marked as sorted and the Month View shows a check mark on its chip

#### Scenario: Order in a day cell
- **WHEN** 2026-10-29 has the journal entries `Gelesen` and `Call mit Anna (09:40)` in this order in the note, the appointment `10:00 Review` and a task due that day
- **THEN** the day cell lists the task and the appointment first, followed by `Gelesen` and `09:40 Call mit Anna`

#### Scenario: Opening an entry
- **WHEN** the user clicks the journal entry `Idee: Dunkelmodus` in the Month View or its button in the Day Details panel
- **THEN** the daily note opens in the Janus Markdown Editor at the line of `## Idee: Dunkelmodus`

#### Scenario: Day Details group
- **WHEN** the user selects 2026-10-29, which has two journal entries and one appointment
- **THEN** the Day Details panel shows the appointment under `Termine aus Notizen` and both journal entries under `Journal`
