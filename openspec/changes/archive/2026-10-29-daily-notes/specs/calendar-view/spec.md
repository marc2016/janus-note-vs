# Spec Delta

## ADDED Requirements

### Requirement: Daily Notes in the Calendar
The calendar SHALL show every daily note (as defined in `daily-notes`) as a note entry on its date, titled with its first `#` heading or, without one, `Tagesnotiz`, even if the note's content contains no date. When the note's frontmatter `date` is the same date, the calendar SHALL show only one entry for it. A heading of the daily note that contains the note's own date SHALL NOT produce an additional entry. Other dates mentioned inside a daily note, including the note's own date outside headings, SHALL still produce their own entries as today.

#### Scenario: Daily note without a date in its content
- **WHEN** `journal/2026-10-29.md` contains only `# Donnerstag` and some text
- **THEN** the calendar shows an entry `Donnerstag` on 2026-10-29 that opens the note

#### Scenario: No duplicate with frontmatter date
- **WHEN** `journal/2026-10-29.md` has frontmatter `date: 2026-10-29`
- **THEN** the calendar shows one entry for this note on 2026-10-29

#### Scenario: Own date in the heading
- **WHEN** `journal/2026-10-29.md` has frontmatter `date: 2026-10-29` and the heading `# Donnerstag, 29.10.2026`
- **THEN** the calendar shows one entry for this note on 2026-10-29

#### Scenario: Appointment inside a daily note
- **WHEN** `journal/2026-10-29.md` contains `Review am 05.11.2026`
- **THEN** the calendar shows the daily note on 2026-10-29 and the review entry on 2026-11-05

### Requirement: Daily Note Action in Day Details
The Day Details panel SHALL show a button `Tagesnotiz öffnen` when the selected day has a daily note and `Tagesnotiz anlegen` when it does not. Clicking it SHALL open the daily note of the selected day in the Janus Markdown Editor, creating it first with the content defined in `daily-notes` if it does not exist. This SHALL work for any selected day, including past and future days.

#### Scenario: Creating a daily note for another day
- **WHEN** the user selects 2026-11-02 in the calendar, which has no daily note, and clicks `Tagesnotiz anlegen`
- **THEN** `journal/2026-11-02.md` is created for that date and opened, and the button then reads `Tagesnotiz öffnen`

#### Scenario: Opening an existing daily note
- **WHEN** the user selects 2026-10-29, which has a daily note, and clicks `Tagesnotiz öffnen`
- **THEN** `journal/2026-10-29.md` opens unchanged
