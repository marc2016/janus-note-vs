# Spec Delta

## ADDED Requirements

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
