# Proposal

## Why

Tasks reach the task list only through AI extraction, which is not deterministic, or through the quick-add field of the list. A user writing a note cannot mark a line as "this is a task for the list". The existing slash command `/tasks` inserts a Markdown checkbox that never appears in the task list. Notes and the task list therefore drift apart: checkboxes in notes are invisible to the list, calendar and due dates, and tasks in the list do not show up where they were written.

## What Changes

- **New slash commands:** `/aufgabe` (alias `/task`) turn the current line into a *linked task line* `- [ ] Titel ^t-xxxxxx`. The ID at the line end links the line to a task with the same ID in the `tasks.json` of the note's folder. `/tasks` keeps inserting a plain checkbox.
- **Note to list:** When a note is saved, every linked line is matched to its task. A missing task is created in the note's folder; title and done state are copied from the line. A task found in another folder moves to the note's folder with all its fields, and its note reference points to the note.
- **List to note:** When the title or done state of a linked task changes anywhere (folder list, global list, calendar, or in `tasks.json` directly), the line in the note is updated immediately. This also works while the note is open, without losing unsaved edits elsewhere in it.
- **Deleting:** A linked task deleted in the list only loses its ID in the note; the line stays as a plain checkbox. A linked line removed from a note leaves its task in the list unchanged.
- **Dates and priority:** Due date, scheduled date and priority stay in the task list only and are not written into the note.
- **Editor display:** In the editor the ID is hidden like other syntax (shown on the cursor line in auto mode, always in visible mode), and a small symbol at the line end marks the line as linked.
- **AI extraction:** The extraction does not create tasks again for linked lines.

Not part of this change: showing dates or priority as chips in the editor, and turning checkboxes into tasks without the command.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `folder-tasks`: new requirements for linked note tasks and their synchronization (note to list on save, list to note immediately, deleting).
- `markdown-editor`: new requirements for the `/aufgabe` and `/task` slash commands and the display of linked task lines.
- `ai-task-generation`: new requirement that linked task lines are not extracted again.

## Impact

- New pure module for parsing and rewriting linked task lines (`src/services/linkedTaskLines.ts`) and a sync service (`src/services/linkedTaskSync.ts`) registered in `src/extension.ts`.
- `src/webviews/markdown/extensions/slashCommands.ts`: new commands.
- New editor extension for hiding the ID and showing the symbol, registered in `MarkdownEditorApp.tsx`.
- `src/services/aiTaskGeneratorService.ts`: linked lines are removed from the note text sent to the model.
- Files written: `tasks.json` files of the notes collection and notes containing linked lines. No new dependencies, no settings, no change to the `tasks.json` format.
