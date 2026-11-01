## ADDED Requirements

### Requirement: Undoing the Last Sort Run
The system SHALL let the user undo the most recent sort run that wrote at least one block, both for `inbox.md` and for a daily note. Undo SHALL be offered as a „Rückgängig" action in the result message of that run and as the command „Janus: Letzte Inbox-Sortierung rückgängig machen". A run that was cancelled or wrote nothing SHALL NOT replace the run that can be undone. Each run SHALL be undoable at most once, and only within the current VS Code window session. When there is nothing to undo, the command SHALL tell the user so without changing any file.

Undo SHALL reverse each change of the run:
- a section appended to an existing note is removed from that note, leaving the rest of the note as it is,
- a note created by the run is deleted, together with folders the run created that are empty afterwards,
- for `inbox.md`, the blocks the run removed are restored,
- for a daily note, the `-> [[…]]` lines the run inserted are removed.

Files SHALL be read and written including unsaved changes in an open editor, as for sorting.

#### Scenario: Undoing a sort into existing and new notes
- **WHEN** a run appended block A to the existing note `projects/app.md`, created `knowledge/neu.md` from block B, reset `inbox.md` to `# Inbox\n\n`, and the user then chooses „Rückgängig"
- **THEN** `projects/app.md` has exactly its content from before the run, `knowledge/neu.md` no longer exists, and `inbox.md` has exactly its content from before the run

#### Scenario: Undoing a daily note sort
- **WHEN** a run copied a block of `journal/2026-10-27.md` to `projects/App-Launch/architektur.md` and inserted `-> [[projects/App-Launch/architektur]]` below it, and the user undoes the run
- **THEN** the appended section is removed from `architektur.md` and the link line with its separating blank line is removed from the daily note

#### Scenario: Removing a created folder
- **WHEN** a run created `projects/Beta/feedback.md` and the folder `projects/Beta` did not exist before, and the user undoes the run
- **THEN** both `projects/Beta/feedback.md` and the empty folder `projects/Beta` are removed

#### Scenario: Undo is offered only once
- **WHEN** the user has undone the last run and runs the undo command again
- **THEN** the system reports that there is no sort run to undo and changes no file

#### Scenario: Cancelled run keeps the previous undo
- **WHEN** the user sorts the inbox, then starts another sort and cancels it in the preview, and then runs the undo command
- **THEN** the first run is undone

### Requirement: Undo Keeps Changes Made After the Sort
Undo SHALL NOT remove or overwrite text the user wrote after the sort run. If a note created by the run has been changed since, it SHALL be kept. If an appended section can no longer be found verbatim in its note, that note SHALL be left unchanged. If `inbox.md` has been changed since the run, the removed blocks SHALL be added back at the end of `inbox.md`, separated by blank lines, instead of restoring the old content. If a daily note has been changed since the run, only the inserted link lines that are still present SHALL be removed. After undo, the system SHALL tell the user how many changes were undone and name the notes it left unchanged.

#### Scenario: Section appended to a note that was edited afterwards
- **WHEN** a run appended a section to `projects/app.md`, the user then added a line at the top of that note, and undoes the run
- **THEN** the appended section is removed and the new line at the top is kept

#### Scenario: Created note that was edited afterwards
- **WHEN** a run created `knowledge/neu.md`, the user then added text to it, and undoes the run
- **THEN** `knowledge/neu.md` is kept unchanged and the user is told that it was not removed

#### Scenario: Inbox edited after the sort
- **WHEN** a run sorted blocks A and B out of `inbox.md`, the user then added block C to the inbox, and undoes the run
- **THEN** `inbox.md` contains C followed by A and B with their original text, and the appended sections of A and B are removed from their targets

#### Scenario: Appended section was edited
- **WHEN** the user changed a word inside a section the run appended to `projects/app.md` and undoes the run
- **THEN** `projects/app.md` is left unchanged, its block is still restored to the inbox, and the user is told that `projects/app.md` was not changed
