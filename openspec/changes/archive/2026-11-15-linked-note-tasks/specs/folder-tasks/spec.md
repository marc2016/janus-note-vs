# Spec Delta

## ADDED Requirements

### Requirement: Linked Note Tasks
A *linked task line* SHALL be a task list item in a Markdown note of the notes collection whose line ends with a space and a task ID of the form `^t-` followed by six lowercase letters or digits (for example `- [ ] Angebot schicken ^t-7f3a9k`), outside fenced code blocks. Its *title* SHALL be the text between the checkbox and the ID, trimmed; its *done state* SHALL be the checkbox state (`[x]` or `[X]` is done). A linked task line SHALL correspond to the task with the same ID (without `^`) in a `tasks.json` of the notes collection. A linked task line with an empty title SHALL be ignored by the synchronization.

#### Scenario: Recognizing a linked task line
- **WHEN** a note contains `  - [x] Angebot schicken ^t-7f3a9k`
- **THEN** it is a linked task line with the ID `t-7f3a9k`, the title `Angebot schicken` and the done state done

#### Scenario: Lines that are not linked
- **WHEN** a note contains `- [ ] Angebot schicken`, `- Angebot ^t-7f3a9k` and, inside a fenced code block, `- [ ] Beispiel ^t-000000`
- **THEN** none of these lines is a linked task line

### Requirement: Note to Task List Synchronization
When a note of the notes collection is saved, the system SHALL process every linked task line of the note: if a task with its ID exists in the `tasks.json` of the note's folder, the system SHALL set the task's title and done state from the line (`completed`, and `status` `done` when done, `todo` when no longer done; an `in_progress` status is kept while the line is not done) and its `note` to the note's file name. If the task exists in the `tasks.json` of another folder, the system SHALL move it with all its fields to the `tasks.json` of the note's folder (creating that file if needed) and update it as above. If no task with the ID exists, the system SHALL create it in the `tasks.json` of the note's folder with the line's title and done state, priority `medium`, the current time as `createdAt` and the note's file name as `note`. Tasks whose linked line no longer exists in any note SHALL remain unchanged. The system SHALL write a `tasks.json` only when a task actually changes.

#### Scenario: New linked line creates a task
- **WHEN** the user saves `projects/plan.md` containing `- [ ] Angebot schicken ^t-7f3a9k` and no task `t-7f3a9k` exists
- **THEN** `projects/tasks.json` contains an open task `t-7f3a9k` titled `Angebot schicken` with priority `medium` and `note` `plan.md`, and it appears in the task list

#### Scenario: Checking the box in the note
- **WHEN** the user checks the box of the linked line of task `t-7f3a9k` and saves the note
- **THEN** the task `t-7f3a9k` is done in the task list

#### Scenario: Editing the title in the note
- **WHEN** the user changes the line to `- [ ] Angebot an Kunde schicken ^t-7f3a9k` and saves
- **THEN** the task is titled `Angebot an Kunde schicken` and keeps its due date, scheduled date and priority

#### Scenario: Line moved to a note in another folder
- **WHEN** the line of task `t-7f3a9k` is cut from `projects/plan.md` and pasted into `meetings/weekly.md`, and both notes are saved
- **THEN** the task is in `meetings/tasks.json` with all its fields and `note` `weekly.md`, and no longer in `projects/tasks.json`

#### Scenario: Line removed from the note
- **WHEN** the user deletes the linked line of task `t-7f3a9k` from the note and saves
- **THEN** the task stays in the task list unchanged

#### Scenario: Empty title
- **WHEN** the user saves a note containing `- [ ]  ^t-7f3a9k`
- **THEN** no task is created for this line

### Requirement: Task List to Note Synchronization
When the title or the done state of a task changes that is linked to a line in the note named by its `note` field in its folder, the system SHALL update that line immediately, wherever the change was made (folder task list, global task list, calendar, or an edit of `tasks.json`). The system SHALL replace only the checkbox state and the title of the line and SHALL keep its indentation, list marker and ID. If the note is open, the system SHALL apply the change to the open document so that unsaved changes in other lines are kept, and SHALL save the document afterwards only if it had no unsaved changes before. If the note is not open, the system SHALL write the file. If the referenced note or the line with the task's ID does not exist, the system SHALL change nothing in any note.

#### Scenario: Completing a task in the task list
- **WHEN** the user completes task `t-7f3a9k` in the global task list and `plan.md` contains `- [ ] Angebot schicken ^t-7f3a9k`
- **THEN** the line in `plan.md` reads `- [x] Angebot schicken ^t-7f3a9k`

#### Scenario: Renaming a task in the task list
- **WHEN** the user renames task `t-7f3a9k` to `Angebot final schicken` in the folder task list
- **THEN** the line reads `- [ ] Angebot final schicken ^t-7f3a9k`

#### Scenario: Completing a task in the calendar while the note is open
- **WHEN** `plan.md` is open in the Janus Markdown Editor with an unsaved change in another line and the user checks task `t-7f3a9k` in the calendar day details
- **THEN** the editor shows the line as done, the other unsaved change is still there, and the note remains marked as unsaved

#### Scenario: Changing dates or priority
- **WHEN** the user sets a due date or changes the priority of a linked task in the task list
- **THEN** the note is not changed

### Requirement: Deleting Linked Tasks
When a linked task is deleted in a task list, the system SHALL remove the space and the ID from its line in the note named by the task's `note` field, so that the line remains as a plain task list item. It SHALL apply this to an open note in the same way as other task list changes.

#### Scenario: Deleting a linked task
- **WHEN** the user deletes task `t-7f3a9k` in the task list and `plan.md` contains `- [ ] Angebot schicken ^t-7f3a9k`
- **THEN** the line in `plan.md` reads `- [ ] Angebot schicken` and no task `t-7f3a9k` is created again when the note is saved
