## ADDED Requirements

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
