# Design

## Context

`AiTaskGeneratorService.generateTasksForNote` sends one whole note plus the folder's existing task titles and today's date to the model, parses `{"tasks": [...]}` with `parseAiExtractedTasks` (date normalization included) and appends non-duplicate tasks via `FolderTasksService`. `AiInboxSorterService.runSort` writes the selected blocks, then the source note, and returns `SortInboxResult` with an undo record (`inboxSortUndo.ts`). The preview is a `createQuickPick` with block rows and a trailing direct-mode toggle row. Requirements: see the two spec deltas.

## Goals / Non-Goals

**Goals:**
- One extra AI request per run, only when enabled, only for written blocks.
- Reuse parsing, date normalization and duplicate rules of task generation.

**Non-Goals:**
- Per-block opt-in in the preview (the option applies to the whole run).
- Showing the extracted tasks for review before they are written.
- Extracting tasks from blocks that stay in the inbox.

## Decisions

### New method `AiTaskGeneratorService.extractTasksFromBlocks`
Input: `Array<{ text: string; targetUri: vscode.Uri }>` and a token. It
1. groups blocks by target folder and reads each folder's `tasks.json` (existing titles for the prompt and the duplicate set),
2. sends one prompt: numbered blocks `[Block n] (Ziel: projects/App-Launch/app-launch.md)` with their text, existing tasks per folder, today's date; expected answer `{"tasks": [{"block": n, "title", "priority", "dueDate", "scheduledDate"}]}`,
3. parses with a block-aware variant of `parseAiExtractedTasks` (shared item schema plus `block`; unknown block numbers are dropped),
4. per folder appends new tasks (`note` = target note file name, same id/createdAt scheme as `generateTasksForNote`) and writes `tasks.json` once,
5. returns `Array<{ tasksUri; existedBefore: boolean; added: TaskItem[] }>`.

The system prompt reuses the wording of `generateTasksForNote` for fields and dates, so both stay consistent. The sorter gets the generator as an optional third constructor argument (default `new AiTaskGeneratorService(aiModelService)`), so `extension.ts` and `MarkdownEditorProvider` need no changes.

- Alternative: call `generateTasksForNote` once per written block with the block text as content. Simple, but N requests per run and the note link would need a separate parameter.

### Preview row
A row `$(checklist) Aufgaben aus einsortierten Abschnitten erzeugen` (with `isExtractTasks: true`) sits before the direct-mode row, preselected from the setting; its state is kept across target edits like `directModePicked`. On accept, the selected state decides for this run; the setting is not written.

### Order and failure handling
Extraction runs after the target notes and the source note are written, inside a try/catch. `SortInboxResult` gets `createdTasks: number` and `taskExtractionFailed?: string`. `showInboxSortResult` appends `", N Aufgabe(n) erzeugt"` or `" Aufgaben konnten nicht erzeugt werden: <msg>"`. The undo record is extended before the result is returned, so undo also covers tasks.

### Undo of tasks
`InboxSortUndoRecord.tasks: Array<{ uri; existedBefore; added: TaskItem[] }>`. Undo reads each `tasks.json`, removes tasks whose id is listed and whose JSON is still deep-equal to the recorded task, counts changed ones as kept (`report.keptTasks`), writes the file, and deletes it if `!existedBefore` and no tasks are left. The undo message appends `"N geänderte Aufgabe(n) behalten."` when `keptTasks > 0`.

### Setting and Settings Panel
`janus.ai.inboxSortExtractTasks` (boolean, default false) in `package.json`; `settingsViewProvider` reads it into the state and handles it in `updateAiConfig` like `inboxSortConfirm`; `SettingsApp` gets a second checkbox in section 2.

## Risks / Trade-offs

- [Extra request adds latency after sorting] → Only when enabled; the footer spinner stays until done.
- [Model returns tasks for unknown block numbers] → dropped by the parser.
- [Many blocks make the request long] → Same truncation per block as the sort prompt (`MAX_BLOCK_PROMPT_CHARS`).
- [Deep-equal check fails because the tasks editor rewrites fields like `updatedAt` without visible change] → The task is kept and reported, which is the safe side.

## Migration Plan

None; new setting defaults to off.
