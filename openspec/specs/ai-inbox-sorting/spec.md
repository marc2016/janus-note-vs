# ai-inbox-sorting Specification

## Purpose

Enables AI-assisted sorting of deterministically split entries from `inbox.md` into the workspace's canonical top-level categories (`meetings`, `projects`, `knowledge`), enforcing strict append-only guarantees for existing files, configurable preview confirmation vs. direct execution, and selective cleanup of sorted entries in `inbox.md`.

## Requirements

### Requirement: Thematic Splitting and Target Classification of Inbox Content
The system SHALL split the actionable content of `<notesRoot>/inbox.md` into blocks deterministically, without the AI model: every Markdown heading of level 2 or deeper starts a new block, and any text before the first such heading forms its own block. If the content contains no such heading, every blank-line-separated paragraph forms a block. The system SHALL then ask the active AI model only to assign blocks, either to an existing note (`append`) or to a new note (`create`) inside one of the three canonical root categories (`meetings`, `projects`, `knowledge`). The model refers to blocks by their number and SHALL NOT be asked to return block content. A block the model does not assign, or assigns to an invalid target, SHALL count as unassigned.

#### Scenario: Proposing append and create targets from inbox.md within canonical root categories
- **WHEN** `inbox.md` contains multiple thoughts on different topics and the user triggers inbox sorting
- **THEN** the system queries the active AI model with the numbered inbox blocks and the existing folders and notes, and returns proposals whose `targetRelativePath` always resides under `meetings/`, `projects/`, or `knowledge/`

#### Scenario: Splitting by headings
- **WHEN** `inbox.md` contains a short intro paragraph followed by three `##` sections
- **THEN** the system sends four blocks to the AI model: the intro paragraph and one block per `##` section, each section block including its heading and all lines up to the next `##`-or-deeper heading

#### Scenario: Splitting by paragraphs when no headings exist
- **WHEN** `inbox.md` contains three paragraphs separated by blank lines and no `##` headings, where one paragraph is a bullet list without blank lines between its items
- **THEN** the system sends three blocks to the AI model, and the bullet list stays one block

#### Scenario: Ignoring invalid or duplicate block references
- **WHEN** the AI model references a block number that does not exist, or assigns the same block twice
- **THEN** the system ignores the unknown reference and keeps only the first assignment of the duplicated block

#### Scenario: Normalizing localized or unprefixed target paths to canonical English root folders
- **WHEN** the AI model proposes a path using a localized root folder name (e.g. `Projekte/App-Launch/app.md`, `Allgemeine Meetings/sync.md`, or `Wissensbasis/llm.md`)
- **THEN** the system normalizes the root segment to its canonical internal English folder name (`projects/App-Launch/app.md`, `meetings/sync.md`, or `knowledge/llm.md`)

#### Scenario: Empty or header-only inbox.md
- **WHEN** `inbox.md` contains no actionable content beyond the `# Inbox` heading or a default welcome paragraph
- **THEN** the system informs the user that there are no entries to sort without calling the AI model or modifying any files

#### Scenario: Ignoring any variant of the default welcome paragraph
- **WHEN** the first paragraph after `# Inbox` starts with the line `Willkommen in deinen Janus Notes!`, regardless of the wording of the following lines in that paragraph
- **THEN** the system excludes that whole paragraph from the blocks sent to the AI model

### Requirement: Strict Append-Only Protection for Existing Notes
The system SHALL never overwrite, truncate, or delete existing content in any target Markdown note when sorting inbox entries; if a target file already exists on disk, the system MUST append the new section to the end of the file preceded by a section heading containing the topic, date, and time (`## <Title> (YYYY-MM-DD HH:mm)`) even if the AI model proposed a `create` action.

#### Scenario: Appending a section to an existing note
- **WHEN** a sorting proposal targets an existing note `projects/App-Launch/app-launch.md`
- **THEN** the system reads the existing file content and appends the sorted section at the end separated by a blank line (`\n\n`) under a `## <Title> (YYYY-MM-DD HH:mm)` heading, preserving 100% of the existing file content byte-for-byte

#### Scenario: Fallback to append when a proposed new note already exists
- **WHEN** a sorting proposal specifies action `create` for `knowledge/ki-prompts.md` but `knowledge/ki-prompts.md` already exists on disk
- **THEN** the system automatically switches the operation to `append` and appends the section to the end of `knowledge/ki-prompts.md` without overwriting existing content

### Requirement: Toggleable Preview Confirmation and Direct Execution Modes
The system SHALL support switching between a preview confirmation mode (`janus.ai.inboxSortConfirm: true` by default) and a direct execution mode (`janus.ai.inboxSortConfirm: false`), allowing users to review, deselect and edit the targets of individual sorting proposals before execution or sort immediately. The preview SHALL list every block: blocks with an AI proposal are selected, and blocks without one are unselected and shown without a target. A selected block that still has no target when the user confirms SHALL be treated as unselected.

#### Scenario: Reviewing and selectively confirming proposals in preview mode
- **WHEN** `janus.ai.inboxSortConfirm` is `true` (default) and the user triggers inbox sorting
- **THEN** the system displays a multi-select preview with all proposed targets pre-selected (`[x]`), allowing the user to deselect specific entries, change their targets, or toggle the confirmation mode before applying

#### Scenario: Unassigned blocks appear unselected in the preview
- **WHEN** the AI model assigns two of three blocks and the preview opens
- **THEN** the preview shows the two proposals selected and the third block unselected, marked as having no target

#### Scenario: Selecting a block without a target
- **WHEN** the user selects a row that has no target and confirms
- **THEN** that block is not written anywhere and stays in `inbox.md` (or stays unlinked in the daily note)

#### Scenario: Executing immediately in direct mode
- **WHEN** `janus.ai.inboxSortConfirm` is `false` and the user triggers inbox sorting
- **THEN** the system immediately executes all proposed sorting operations without displaying the confirmation preview

### Requirement: Selective Cleanup of Sorted Entries in inbox.md
The system SHALL remove only the blocks that were actually written to a target note from `inbox.md`. Unselected blocks, blocks that have no target when sorting is confirmed, and blocks that changed while sorting was in progress SHALL stay in `inbox.md` with their original text, under the preserved `# Inbox` header. The system SHALL determine the remaining blocks from the content of `inbox.md` at the time of writing, including unsaved changes in an open editor, not from the content read before the AI request.

#### Scenario: All inbox entries are sorted
- **WHEN** every block has a target and the user confirms all of them (or runs in direct mode with every block assigned by the AI model)
- **THEN** all blocks are written to their target notes and `inbox.md` is reset to `# Inbox\n\n`

#### Scenario: Partial selection in preview mode preserves unselected entries
- **WHEN** `inbox.md` contains two sections and the user deselects the second section in the preview
- **THEN** the system sorts only the first section into its target note and keeps the second section intact inside `inbox.md`

#### Scenario: Unassigned blocks are never removed
- **WHEN** `inbox.md` contains three blocks, the AI model assigns only two of them, and the user confirms both proposals without giving the third block a target
- **THEN** the two assigned blocks are written to their targets, the third block stays in `inbox.md` unchanged, and the user is told that one block remained in the inbox

#### Scenario: Block edited during sorting is skipped
- **WHEN** the user changes the text of a block in `inbox.md` while the AI request or the preview is pending
- **THEN** the system neither writes that block to its target note nor removes it from `inbox.md`, and any text the user added to `inbox.md` in the meantime is kept

### Requirement: Verbatim Transfer of Inbox Blocks
The system SHALL write each sorted block's original text from `inbox.md` into the target note without any rewording, shortening, or reformatting by the AI model. The only changes SHALL be the headings defined for appending and creating notes, and the rewrite of relative link and image paths defined in "Relative Path Rewrite for Moved Inbox Blocks".

#### Scenario: Appending a block without its own heading
- **WHEN** a paragraph block without a heading is appended to an existing note, with the AI-proposed title `Heartbeat-Intervall`
- **THEN** the note gains `## Heartbeat-Intervall (YYYY-MM-DD HH:mm)` followed by the paragraph exactly as it appeared in `inbox.md`

#### Scenario: Appending a block that has its own heading
- **WHEN** a block starting with `## Sync-Architektur: WebSocket Heartbeats` is appended to an existing note
- **THEN** the note gains `## Sync-Architektur: WebSocket Heartbeats (YYYY-MM-DD HH:mm)` followed by the remaining block lines exactly as they appeared in `inbox.md`

#### Scenario: Creating a new note from a block
- **WHEN** a block is sorted into a note path that does not exist yet
- **THEN** the new note contains a `#` title heading followed by the block text exactly as it appeared in `inbox.md`

#### Scenario: Block with relative links keeps everything else verbatim
- **WHEN** a block containing the sentence `Siehe [Plan](knowledge/plan.md) für Details.` is sorted into `projects/app/launch.md` and `knowledge/plan.md` exists
- **THEN** the target note contains `Siehe [Plan](../../knowledge/plan.md) für Details.` and every other character of the block is unchanged

### Requirement: Existing Note Outline as Classification Context
The system SHALL include, for each existing Markdown note in the notes root except `inbox.md` and notes in the `journal` folder, its relative path, its title (first `#` heading, or the file name), and its `##` headings in the AI request. Timestamp suffixes added by earlier sorting runs, with or without a time, SHALL be removed from those headings. To keep the request bounded, the system SHALL limit the number of headings per note and SHALL send only paths for notes beyond a fixed note limit. A proposal whose target lies in the `journal` folder SHALL count as unassigned, both when sorting `inbox.md` and when sorting a daily note.

#### Scenario: Note headings appear in the request
- **WHEN** `projects/App-Launch/app-launch.md` has the title `App-Launch` and the headings `## Push-Notifications`, `## Beta-Feedback (2026-10-20 09:15)` and `## Call mit Anna (2026-10-27)`
- **THEN** the AI request lists that note with the title `App-Launch` and the headings `Push-Notifications`, `Beta-Feedback` and `Call mit Anna`

#### Scenario: Large note collections stay bounded
- **WHEN** the notes root contains more notes than the fixed note limit
- **THEN** the AI request includes title and headings for notes up to the limit and only the relative path for the remaining notes

#### Scenario: Daily notes are not offered as targets
- **WHEN** the notes root contains `journal/2026-10-28.md` and the user sorts `inbox.md`
- **THEN** the AI request does not list `journal/2026-10-28.md`

#### Scenario: Proposal into journal is ignored
- **WHEN** the AI model assigns a block to `journal/2026-10-28.md`
- **THEN** the block counts as unassigned and no file in `journal/` is written by the sort

### Requirement: Sorting a Daily Note by Copying and Linking
The system SHALL let the user sort a daily note (as defined in `daily-notes`). It SHALL split the daily note into blocks with the same rules as `inbox.md`, after leaving out the frontmatter and the first `#` title heading, and SHALL assign, preview and write the blocks with the same rules as inbox sorting, including append-only protection and verbatim transfer. Unlike inbox sorting, the system SHALL NOT remove any block from the daily note. Instead, for every block written to a target note, it SHALL insert a line `-> [[<target path relative to the notes root, without .md>]]` directly after that block, separated from the block by a blank line, and SHALL leave all other content of the daily note unchanged, including unsaved changes in an open editor. A section appended from a daily note SHALL use the daily note's date as its heading suffix (`## <Title> (YYYY-MM-DD)`) instead of the sorting date and time. When the block's leading heading ends with a time `(HH:mm)` (as defined in "Creation Time in Daily Note Headings" in `daily-notes`), that time SHALL be replaced by the daily note's date and the time (`## <Title> (YYYY-MM-DD HH:mm)`) instead of adding a second suffix, both when appending to an existing note and when creating a new note. A block that changed while sorting was in progress SHALL be neither written nor linked.

#### Scenario: Copying a block and linking it
- **WHEN** `journal/2026-10-27.md` contains `## Call mit Anna` with the line `Backend auf Postgres umstellen`, the AI model assigns this block to the existing note `projects/App-Launch/architektur.md`, and the user confirms
- **THEN** `architektur.md` gains `## Call mit Anna (2026-10-27)` followed by `Backend auf Postgres umstellen`, and the daily note still contains the block, followed by a blank line and `-> [[projects/App-Launch/architektur]]`

#### Scenario: Block heading with a creation time
- **WHEN** `journal/2026-10-27.md` contains `## Call mit Anna (14:32)` and the block is appended to the existing note `projects/App-Launch/architektur.md`
- **THEN** `architektur.md` gains `## Call mit Anna (2026-10-27 14:32)`, and the heading in the daily note stays `## Call mit Anna (14:32)`

#### Scenario: New note from a block with a creation time
- **WHEN** the block `## Idee: Dunkelmodus (09:15)` of `journal/2026-10-29.md` is sorted into `knowledge/dark-mode.md`, which does not exist yet
- **THEN** the created note contains the heading `## Idee: Dunkelmodus (2026-10-29 09:15)` followed by the block text

#### Scenario: Title and frontmatter are not blocks
- **WHEN** a daily note consists of frontmatter `date: 2026-10-29`, the heading `# Donnerstag, 29.10.2026` and two `##` sections, and the user sorts it
- **THEN** the system sends exactly two blocks to the AI model

#### Scenario: Unselected and unassigned blocks stay unlinked
- **WHEN** a daily note has three blocks, the AI model assigns two of them, and the user deselects one of these in the preview
- **THEN** only the confirmed block is copied and gets a link line, and the other two blocks stay unchanged without a link line

#### Scenario: Creating a new note from a daily note block
- **WHEN** a daily note block is sorted into `knowledge/dark-mode.md`, which does not exist yet
- **THEN** the system creates `knowledge/dark-mode.md` with a title heading and the block text, and inserts `-> [[knowledge/dark-mode]]` below the block in the daily note

#### Scenario: Nothing left to sort
- **WHEN** a daily note contains no block, or every block already has a link line
- **THEN** the system informs the user that the daily note has no entries to sort, without calling the AI model or modifying any files

### Requirement: Already Sorted Daily Note Blocks Are Skipped
The system SHALL treat a daily note block that contains a line consisting only of `->` followed by a single wiki link (outside fenced code) as already sorted and SHALL NOT send it to the AI model again. Blocks without such a line SHALL be sorted as usual.

#### Scenario: Sorting the same daily note twice
- **WHEN** the morning blocks of `journal/2026-10-29.md` were sorted and linked, the user adds a new `## Idee` section in the afternoon and sorts the daily note again
- **THEN** the system sends only the `## Idee` block to the AI model, and the morning blocks and their link lines stay unchanged

### Requirement: Relative Path Rewrite for Moved Inbox Blocks
When writing a sorted block into its target note, the system SHALL rewrite the target path of every Markdown link and Markdown image in the block whose target is a relative path that resolves, relative to the folder of `inbox.md`, to an existing file, so that it resolves to the same file relative to the target note's folder. The rewritten path SHALL use `/` as separator and keep the link's label or alt text, optional title, and any `#anchor`, `#L42` or `:42` suffix. The system SHALL NOT change wiki-links, external URLs, anchor-only links, absolute paths, relative paths that do not resolve to an existing file from the folder of `inbox.md`, or links inside fenced code blocks and inline code spans.

#### Scenario: Image in a block moved two levels deeper
- **WHEN** a block contains `![Skizze](assets/skizze.png)`, `assets/skizze.png` exists in the notes root, and the block is sorted into `projects/app/launch.md`
- **THEN** the target note contains `![Skizze](../../assets/skizze.png)`

#### Scenario: Link with anchor and title
- **WHEN** a block contains `[Abschnitt](knowledge/plan.md#ziele "Ziele")`, `knowledge/plan.md` exists, and the block is sorted into `knowledge/notes.md`
- **THEN** the target note contains `[Abschnitt](plan.md#ziele "Ziele")`

#### Scenario: Link with explicit current-folder prefix
- **WHEN** a block contains `[Plan](./knowledge/plan.md)`, `knowledge/plan.md` exists, and the block is sorted into `meetings/sync.md`
- **THEN** the target note contains `[Plan](../knowledge/plan.md)`

#### Scenario: Wiki-links and external links stay unchanged
- **WHEN** a block contains `[[plan]]`, `[[knowledge/plan]]`, `[Docs](https://example.com/docs)` and `[Oben](#oben)`, and the block is sorted into `projects/app/launch.md`
- **THEN** all four links appear in the target note exactly as in `inbox.md`

#### Scenario: Unresolved relative link stays unchanged
- **WHEN** a block contains `[Später](ideen/später.md)` and no file `ideen/später.md` exists in the notes root
- **THEN** the link appears in the target note exactly as in `inbox.md`

#### Scenario: Links in code stay unchanged
- **WHEN** a block contains `[Plan](knowledge/plan.md)` inside a fenced code block and inside an inline code span, and `knowledge/plan.md` exists
- **THEN** both appear in the target note exactly as in `inbox.md`

#### Scenario: Target note in the notes root
- **WHEN** a block containing `[Plan](knowledge/plan.md)` is sorted into a note directly inside the notes root
- **THEN** the link appears in the target note exactly as in `inbox.md`

#### Scenario: Blocks remaining in the inbox are not rewritten
- **WHEN** a block containing `![Skizze](assets/skizze.png)` is not assigned by the AI model and stays in `inbox.md`
- **THEN** `inbox.md` still contains `![Skizze](assets/skizze.png)`

### Requirement: Editing Sort Targets in the Preview
In preview confirmation mode the system SHALL let the user change the target of any block listed in the preview before applying, both when sorting `inbox.md` and when sorting a daily note. For each row the user SHALL be able to choose either an existing note (the block is appended) or a new note path (the block is created there). The list of existing notes SHALL contain the existing notes inside the canonical root categories (`meetings`, `projects`, `knowledge`), so `inbox.md` and notes in the `journal` folder are not offered. A typed path SHALL be normalized and validated with the same rules as AI-proposed paths. A path those rules reject SHALL NOT be accepted, and the user SHALL be told why. A path that resolves to an existing file SHALL be appended to, as defined in "Strict Append-Only Protection for Existing Notes". After a target is chosen, the preview SHALL show the row with the new target and the matching action, the row SHALL be selected, and all other rows SHALL keep their selection and targets. Cancelling the target choice SHALL leave the row unchanged. The block text and the title the AI proposed SHALL stay the same when the target changes. For a block that had no AI proposal, the title SHALL be derived from the block in the same way as when the AI omits a title.

#### Scenario: Redirecting a proposal to another existing note
- **WHEN** the AI proposes to append a block to `knowledge/ideen.md`, and in the preview the user changes the target to the existing note `projects/App-Launch/app-launch.md` and confirms
- **THEN** the block is appended to `projects/App-Launch/app-launch.md` under the AI-proposed title, `knowledge/ideen.md` is not changed, and the block is removed from `inbox.md`

#### Scenario: Redirecting a proposal to a new note
- **WHEN** the AI proposes to append a block to an existing note, the user chooses "new note", enters `Projekte/Beta/feedback` and confirms
- **THEN** the preview row shows the action "create" for `projects/Beta/feedback.md`, and on confirmation the system creates `projects/Beta/feedback.md` containing the block

#### Scenario: Rejecting an invalid new note path
- **WHEN** the user enters `../geheim.md`, `inbox.md` or `journal/2026-11-01.md` as a new note path
- **THEN** the input is not accepted, a validation message is shown, and the row keeps its previous target

#### Scenario: Assigning a block the AI left unassigned
- **WHEN** the AI assigns two of three inbox blocks, and in the preview the user picks the existing note `meetings/sync.md` for the third block and confirms all rows
- **THEN** all three blocks are written to their targets, the third under a title derived from its heading or first line, and `inbox.md` is reset to `# Inbox\n\n`

#### Scenario: Cancelling the target choice keeps the row
- **WHEN** the user opens the target choice for a row and closes it without choosing
- **THEN** the preview opens again with that row's target and selection unchanged and with all other rows' selections and targets unchanged

#### Scenario: Editing a daily note target
- **WHEN** the user sorts `journal/2026-10-29.md`, changes a block's target in the preview to `knowledge/dark-mode.md` and confirms
- **THEN** the block is copied to `knowledge/dark-mode.md`, and the daily note gets `-> [[knowledge/dark-mode]]` below that block

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

### Requirement: Extracting Tasks from Sorted Blocks
The system SHALL offer to extract tasks from the blocks a sort run writes, both when sorting `inbox.md` and when sorting a daily note. The setting `janus.ai.inboxSortExtractTasks` (default `false`) SHALL decide whether tasks are extracted in direct mode and SHALL preselect the option in the preview. The preview SHALL show a separate row for this option, and selecting or deselecting it SHALL apply only to the current run without changing the setting. Only blocks that were actually written to a target note SHALL be sent for extraction, all in a single request to the active AI model, each together with its target note. Each extracted task SHALL be added to the `tasks.json` in the folder of the target note of its block, linked to that note, with the same fields, date normalization and duplicate check against that folder's existing tasks as task generation for a single note. When task extraction fails, the blocks SHALL stay written, and the user SHALL be told that no tasks were created.

#### Scenario: Tasks from a block sorted into a project note
- **WHEN** extraction is enabled and a block containing "APNs-Zertifikat bis Donnerstag erneuern" is appended to `projects/App-Launch/app-launch.md`
- **THEN** `projects/App-Launch/tasks.json` gains a task with that title, linked to `app-launch.md`, and the result message reports one created task

#### Scenario: Blocks with different target folders
- **WHEN** extraction is enabled and one run writes a block to `projects/App-Launch/app-launch.md` and another to `meetings/sync.md`
- **THEN** the system sends one request with both blocks, and each task is added to the `tasks.json` of its block's target folder

#### Scenario: Duplicate tasks are skipped
- **WHEN** an extracted task has the same title (ignoring case and surrounding whitespace) as an existing task in the target folder's `tasks.json`
- **THEN** the task is not added again

#### Scenario: Enabling extraction for one run in the preview
- **WHEN** `janus.ai.inboxSortExtractTasks` is `false` and the user selects the task extraction row in the preview and confirms
- **THEN** tasks are extracted for this run, and the setting stays `false`

#### Scenario: Disabled extraction
- **WHEN** `janus.ai.inboxSortExtractTasks` is `false` and the user sorts in direct mode
- **THEN** no task extraction request is sent and no `tasks.json` is changed

#### Scenario: Unselected and unwritten blocks are not used
- **WHEN** extraction is enabled and the user deselects a block in the preview, or a block changed during sorting
- **THEN** that block is not sent for task extraction

#### Scenario: Extraction fails
- **WHEN** extraction is enabled and the AI request for tasks fails after the blocks were written
- **THEN** the blocks stay in their target notes, the inbox is updated as usual, and the result message says that no tasks could be created

### Requirement: Undo Removes Tasks Created by the Sort
When the user undoes a sort run that created tasks, the system SHALL remove those tasks from their `tasks.json` files. A task that was changed since the run (for example its status or title) SHALL be kept and counted among the changes left in place. A `tasks.json` file the run created SHALL be deleted when it contains no tasks after the removal.

#### Scenario: Undoing a run with created tasks
- **WHEN** a run added two tasks to `projects/App-Launch/tasks.json`, which already had one task, and the user undoes the run
- **THEN** `projects/App-Launch/tasks.json` contains only the original task

#### Scenario: Task completed before undo
- **WHEN** the user marks one of the created tasks as done and then undoes the run
- **THEN** that task is kept, the other created tasks are removed, and the undo message mentions that a changed task was kept

#### Scenario: tasks.json created by the run
- **WHEN** the run created `meetings/tasks.json` with one task and the user undoes the run
- **THEN** `meetings/tasks.json` no longer exists
