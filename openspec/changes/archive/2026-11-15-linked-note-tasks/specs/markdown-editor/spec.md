# Spec Delta

## ADDED Requirements

### Requirement: Slash Commands for Linked Tasks
The slash command menu of the Janus Markdown Editor SHALL offer `/aufgabe` and `/task`, both described as creating a task for the task list. Selecting one SHALL turn the line containing the cursor into a linked task line (as defined in `folder-tasks`) with a new task ID that does not occur in the document, and SHALL keep the line's indentation and blockquote prefix:

- a line with plain text becomes `- [ ] <text> ^<id>`,
- a list item `- <text>` becomes `- [ ] <text> ^<id>`,
- a task list item `- [ ] <text>` or `- [x] <text>` gets ` ^<id>` appended,
- an empty line becomes `- [ ] ` followed by ` ^<id>`, with the cursor placed directly before the ID.

On a line that is already a linked task line the command SHALL only remove the typed command text. Otherwise the cursor SHALL be placed at the end of the title. `/tasks` SHALL keep inserting a plain task list item without an ID.

#### Scenario: Turning text into a linked task
- **WHEN** the line reads `Angebot schicken /aufgabe` and the user selects `/aufgabe`
- **THEN** the line reads `- [ ] Angebot schicken ^t-xxxxxx` with a new ID and the cursor after `schicken`

#### Scenario: Linking an existing checkbox
- **WHEN** the line reads `  - [ ] Folien bauen /task` and the user selects `/task`
- **THEN** the line reads `  - [ ] Folien bauen ^t-xxxxxx`

#### Scenario: Empty line
- **WHEN** the line contains only `/aufgabe` and the user selects it
- **THEN** the line reads `- [ ]  ^t-xxxxxx` and typed text appears between the checkbox and the ID

#### Scenario: Plain checkbox command is unchanged
- **WHEN** the user selects `/tasks`
- **THEN** `- [ ] ` is inserted without an ID

### Requirement: Display of Linked Task Lines
In the Janus Markdown Editor, the ID of a linked task line (` ^t-xxxxxx`) SHALL be hidden in the syntax visibility modes `auto` and `hidden`, also on the line with the cursor, and shown in `visible` mode. On every linked task line the editor SHALL show a small symbol at the end of the line with a tooltip starting with `In der Aufgabenliste`. Clicking the symbol SHALL open the task list of the note's folder in its task list editor, without moving the cursor, and SHALL briefly highlight the task there, scrolled into view (expanding the `Erledigt` section and clearing the search if needed); if the note has unsaved changes, the system SHALL save it first so that the task exists in that list. If that folder still has no task list afterwards (for example because the line has no title yet), the system SHALL show a hint instead. Hiding the ID SHALL NOT change the document. While the ID is hidden, an empty cursor SHALL NOT be placed behind the ID: moving to the end of the line, clicking behind it or moving there with the keyboard SHALL place the cursor directly after the title, and `Arrow Right` from there SHALL move to the next line. `Enter` and `Shift+Enter` with the cursor directly after the title SHALL behave as at the end of the line and keep the ID on its line.

#### Scenario: Linked line in auto mode
- **WHEN** syntax visibility is `auto` and the document contains `- [ ] Angebot schicken ^t-7f3a9k`, with or without the cursor on that line
- **THEN** the line shows the checkbox, `Angebot schicken` and the symbol, but not `^t-7f3a9k`

#### Scenario: Visible mode
- **WHEN** syntax visibility is `visible`
- **THEN** `^t-7f3a9k` is shown

#### Scenario: Cursor stays in front of the hidden ID
- **WHEN** the user presses `End` on the linked line and types `!`
- **THEN** the line reads `- [ ] Angebot schicken! ^t-7f3a9k`

#### Scenario: Enter at the end of a linked line
- **WHEN** the cursor is directly after `schicken` and the user presses `Enter`
- **THEN** the linked line keeps its ID and a new item `- [ ] ` starts on the next line

#### Scenario: Clicking the symbol opens the task list
- **WHEN** `projects/plan.md` contains a linked task line and the user clicks its symbol
- **THEN** `projects/tasks.json` opens in the task list editor and the task is briefly highlighted and scrolled into view
