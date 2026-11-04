# daily-notes Specification

## Purpose

Gives every day a dedicated, dated note in the notes collection that can be opened with one command and is created from a template on first use.

## Requirements

### Requirement: Daily Note Location
The daily note of a date SHALL be the file `<notesRoot>/journal/YYYY-MM-DD.md`, using the local date. The `journal` folder is a regular, visible folder of the notes collection.

#### Scenario: Path of today's daily note
- **WHEN** today is 2026-10-29 and the notes root is `notes`
- **THEN** today's daily note is `notes/journal/2026-10-29.md`

### Requirement: Open or Create Today's Daily Note
The system SHALL provide the command `janus.openDailyNote` (title `Janus: Tagesnotiz öffnen`), available in the command palette and as a button in the Notes view title bar. It SHALL open today's daily note in the Janus Markdown Editor. If the note does not exist, the system SHALL first create the `journal` folder if needed and the note with the content defined in "Daily Note Content". An existing daily note SHALL be opened unchanged. Without a configured notes root, the system SHALL show the same message as other commands that need a notes root and create nothing.

#### Scenario: First call of the day
- **WHEN** today is 2026-10-29 and `journal/2026-10-29.md` does not exist
- **THEN** the system creates it and opens it in the Janus Markdown Editor

#### Scenario: Daily note already exists
- **WHEN** `journal/2026-10-29.md` exists with the user's text and the user runs `janus.openDailyNote` on 2026-10-29
- **THEN** the note opens with its text unchanged

#### Scenario: No notes root
- **WHEN** no notes root is configured and the user runs `janus.openDailyNote`
- **THEN** the user is asked to set up a notes folder first and no file is created

### Requirement: Daily Note Content
A new daily note SHALL get the content of the template `tagesnotiz` (as defined in `note-templates`) with its placeholders filled in for the note's date: `{{title}}` as `YYYY-MM-DD`, `{{date}}`, `{{date:DD.MM.YYYY}}` and `{{weekday}}` for that date, and `{{time}}` for the current time. If no such template exists, the note SHALL contain the frontmatter `date: YYYY-MM-DD` followed by the heading `# <Wochentag>, DD.MM.YYYY`.

#### Scenario: Default content
- **WHEN** no template `tagesnotiz` exists and the daily note for 2026-10-29 is created
- **THEN** it contains `---`, `date: 2026-10-29`, `---` and `# Donnerstag, 29.10.2026`

#### Scenario: Content from the template
- **WHEN** `.templates/tagesnotiz.md` contains `# {{weekday}}, {{date:DD.MM.YYYY}}` and `## Notizen`, and the daily note for 2026-10-30 is created on 2026-10-29
- **THEN** it contains `# Freitag, 30.10.2026` and `## Notizen`

### Requirement: Creation Time in Daily Note Headings
In a daily note opened in the Janus Markdown Editor, when the user turns a line into a heading of level 1 or 2 by typing (for example `# ` or `## ` at the start of a line) and later presses `Enter` with the cursor at the end of that heading line, the editor SHALL append a space and the local time at which the line became a heading, formatted as `(HH:mm)`, to the end of the heading text, and then insert the line break as usual. The insertion and the line break SHALL form one undo step. The time SHALL be plain text of the heading: the editor SHALL NOT style it differently, SHALL NOT insert it a second time for the same heading, and SHALL NOT restore it after the user edits or deletes it. The editor SHALL NOT add a time to headings of level 3 or deeper, to a heading that already ends with `(HH:mm)` or `(YYYY-MM-DD HH:mm)`, to a heading without text, to headings that existed when the note was opened (for example the title `# Mittwoch, 04.11.2026` or `## Notizen` from the template) or were added by other means than typing in the editor, or to headings in notes that are not daily notes.

#### Scenario: Writing a new entry
- **WHEN** the user opens today's daily note, types `## Call mit Anna` at 14:32 in an empty line and presses `Enter` at 14:35 with the cursor at the end of the line
- **THEN** the line reads `## Call mit Anna (14:32)` and the cursor is at the start of the next line

#### Scenario: Level 1 and deeper headings
- **WHEN** the user types `# Abend` at 19:00 and presses `Enter` at its end, and then types `### Detail` and presses `Enter` at its end
- **THEN** the lines read `# Abend (19:00)` and `### Detail`

#### Scenario: Undo
- **WHEN** the time was just inserted by pressing `Enter` and the user presses `Cmd+Z`
- **THEN** the line reads `## Call mit Anna` again and the line break is removed

#### Scenario: Template heading
- **WHEN** the daily note was created from the template with `## Notizen` and the user places the cursor at the end of `## Notizen` and presses `Enter`
- **THEN** the heading stays `## Notizen` without a time

#### Scenario: Enter in the middle of a heading
- **WHEN** the user types `## Call mit Anna` and presses `Enter` with the cursor between `Call` and `mit`
- **THEN** no time is inserted and the line is split as usual

#### Scenario: Heading time removed by the user
- **WHEN** a heading reads `## Call mit Anna (14:32)` and the user deletes `(14:32)` and later presses `Enter` at the end of the heading
- **THEN** no time is inserted again

#### Scenario: Not a daily note
- **WHEN** the user types `## Idee` in `inbox.md` or a project note and presses `Enter` at the end of the line
- **THEN** no time is inserted
