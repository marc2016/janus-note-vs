# Spec Delta

## Purpose

Lets users start new notes from reusable Markdown templates stored in the notes collection, with placeholders for title, date, time and weekday filled in automatically.

## ADDED Requirements

### Requirement: Template Storage
Every Markdown file (`*.md`) directly inside `<notesRoot>/.templates/` SHALL be a note template, named after its file name without extension. Templates SHALL be listed sorted by name. Because the folder name starts with a dot, templates SHALL NOT appear as notes in the Notes TreeView, the note graph, search, the calendar, link autocomplete, or the tag index.

#### Scenario: Listing templates
- **WHEN** `<notesRoot>/.templates/` contains `meeting.md`, `projekt.md` and `bild.png`
- **THEN** the templates are `meeting` and `projekt`

#### Scenario: Templates stay out of the collection
- **WHEN** `<notesRoot>/.templates/meeting.md` exists
- **THEN** it is not shown in the Notes TreeView and not returned by note search

### Requirement: Placeholder Replacement
When a note is created from a template, the system SHALL copy the template's text and replace every occurrence of these placeholders, using the local date and time at creation: `{{title}}` with the note's title (the entered name without `.md`), `{{date}}` with `YYYY-MM-DD`, `{{date:DD.MM.YYYY}}` with `DD.MM.YYYY`, `{{time}}` with `HH:mm`, and `{{weekday}}` with the German weekday name. Placeholder names SHALL be matched case-insensitively and may contain spaces inside the braces. Unknown placeholders SHALL be kept unchanged. Everything else, including frontmatter, SHALL be copied unchanged.

#### Scenario: Filling placeholders
- **WHEN** a template contains `---`, `date: {{date}}`, `---`, `# {{title}}` and `Erstellt am {{weekday}}, {{date:DD.MM.YYYY}} um {{ time }}`, and the note `Sprint 12` is created on Thursday 2026-10-29 at 07:12
- **THEN** the note contains `date: 2026-10-29`, `# Sprint 12` and `Erstellt am Donnerstag, 29.10.2026 um 07:12`

#### Scenario: Unknown placeholders
- **WHEN** a template contains `{{teilnehmer}}`
- **THEN** the created note contains `{{teilnehmer}}`

### Requirement: Editing Templates
The system SHALL provide the command `janus.editTemplates` (title `Janus: Vorlagen bearbeiten`), available in the command palette and the Notes view title bar overflow menu. It SHALL show a list of all templates and an entry `Neue Vorlage…`. Selecting a template SHALL open it in the Janus Markdown Editor. Selecting `Neue Vorlage…` SHALL ask for a name, create `<notesRoot>/.templates/` if it does not exist, create `<name>.md` there with example content that uses `{{title}}` and `{{date}}`, and open it in the Janus Markdown Editor. An existing template SHALL NOT be overwritten.

#### Scenario: Opening a template
- **WHEN** the user runs `janus.editTemplates` and selects `meeting`
- **THEN** `<notesRoot>/.templates/meeting.md` opens in the Janus Markdown Editor

#### Scenario: Creating the first template
- **WHEN** no `.templates` folder exists, the user runs `janus.editTemplates`, selects `Neue Vorlage…` and enters `meeting`
- **THEN** `<notesRoot>/.templates/meeting.md` is created with example content containing `{{title}}` and `{{date}}` and opened in the Janus Markdown Editor

#### Scenario: Name already taken
- **WHEN** the user selects `Neue Vorlage…` and enters `meeting`, and `meeting.md` already exists in `.templates`
- **THEN** the user is told that the template exists, and the existing file is not changed
