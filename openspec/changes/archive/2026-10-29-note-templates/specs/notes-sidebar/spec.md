# Spec Delta

## MODIFIED Requirements

### Requirement: Create Note Action
The system SHALL allow users to create new Markdown notes within the notes collection via the `janus.createNote` command, accessible from the Notes view title bar and item context menus. When at least one note template exists (as defined in `note-templates`), the system SHALL, after the name prompt, let the user choose between `Leere Notiz` (listed first) and each template. Cancelling this choice SHALL create no note.

#### Scenario: Creating a new note in selected folder or root
- **WHEN** user executes `janus.createNote` and enters a note name, and no template exists or the user chooses `Leere Notiz`
- **THEN** system creates the Markdown file (appending `.md` if omitted), initializes it with a title heading, reveals it in the Notes view, and opens it directly in the Janus Markdown Editor

#### Scenario: Creating a note from a template
- **WHEN** templates exist, the user enters `Sprint 12` and chooses the template `meeting`
- **THEN** system creates `Sprint 12.md` with the content of `meeting` with its placeholders filled in, reveals it in the Notes view, and opens it in the Janus Markdown Editor

#### Scenario: Cancelling the template choice
- **WHEN** templates exist and the user closes the template choice without selecting an entry
- **THEN** no note is created
