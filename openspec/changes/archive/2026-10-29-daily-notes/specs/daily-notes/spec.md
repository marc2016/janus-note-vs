# Spec Delta

## Purpose

Gives every day a dedicated, dated note in the notes collection that can be opened with one command and is created from a template on first use.

## ADDED Requirements

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
