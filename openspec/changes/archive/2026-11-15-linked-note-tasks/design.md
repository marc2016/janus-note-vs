# Design

## Context

See proposal.md for the motivation. Observed state:

- **Storage:** Tasks live in `tasks.json` per folder (`TaskItem`: `id`, `title`, `completed`, `status`, `priority`, `note`, `dueDate`, `scheduledDate`, `createdAt`). `note` is the file name of a note in the same folder (for example `sprint-review.md`).
- **Three writers of `tasks.json`:**
  - `FolderTasksService.updateTaskInFolder` / `addTaskToFolder` / `deleteTaskInFolder`, used by the global task list and the calendar views.
  - The folder task list (`TasksEditorProvider`), a custom text editor that edits the `tasks.json` `TextDocument` directly.
  - External edits (Git, other machines).
- **Note editor:** The Janus Markdown Editor writes the note through full-text `WorkspaceEdit`s and receives external document changes through `onDidChangeTextDocument` with a sync tracker (`update` message). Saving fires `vscode.workspace.onDidSaveTextDocument`.
- **Slash commands:** `getSlashCommands()` in `slashCommands.ts` returns CodeMirror `Completion`s whose `apply` is a string or a function receiving `(view, completion, from, to)`. They run in the webview and have no access to `tasks.json`.
- **Syntax hiding:** `livePreview.ts` hides syntax with `Decoration.replace` depending on `syntaxVisibilityFacet` (`auto` / `visible` / `hidden`) and the cursor line.
- **AI extraction:** `AiTaskGeneratorService` reads the note text, sends it to the model and dedupes by normalized title against the folder's tasks.

## Goals / Non-Goals

**Goals:**

- The webview only edits text; all `tasks.json` writes happen in the extension host, in one sync service.
- One code path covers creating, updating and moving tasks: "a saved note contains a linked line".
- List-to-note works for every writer of `tasks.json` without touching each call site.
- No sync loops and no writes when nothing changed.

**Non-Goals:**

- No syncing of dates or priority.
- No scanning of all notes on activation; only saved notes and changed task files are processed.

## Decisions

### 1. Pure line module `linkedTaskLines.ts`

It has no `vscode` import and is unit tested. It provides:

- **`parseLinkedTaskLines(text)`:** returns `{ id, title, done, line, indentPrefix }[]`. It skips fenced code (same fence tracking as the calendar's journal extraction) and uses the regex `^(\s*(?:>\s*)*[-*+]\s+)\[([ xX])\]\s+(.*?)\s+\^(t-[a-z0-9]{6})\s*$`.
- **`rewriteLinkedTaskLine(lineText, { title?, done? })`:** keeps the prefix and the ID.
- **`removeLinkedTaskId(lineText)`**
- **`newLinkedTaskId(existingText)`:** `t-` plus 6 random base36 characters, retried while it occurs in the text.

The slash command (webview) and the sync service (host) both import it. It lives in `src/services/` like `dailyNotePaths.ts`, which webviews already import.

### 2. Slash commands only edit text

`/aufgabe` and `/task` are `Completion`s with a function `apply` that deletes the typed command and rewrites the cursor line as specified, using `newLinkedTaskId(view.state.doc.toString())`. The task itself is created by the next save (decision 3). This keeps the webview free of host messaging, and the empty-title case ("linked once a title is there") falls out naturally.

Alternative considered: post a `createLinkedTask` message to the host. Rejected, because creation and updates would then follow two paths, and an unsaved note would already have a task.

### 3. Note to list: `onDidSaveTextDocument`

`LinkedTaskSync` listens to `onDidSaveTextDocument` for `.md` files under the notes root (via `companionManager.getNotesRootUri()`). For a saved note it:

1. parses the linked lines and skips empty titles,
2. loads the note folder's `tasks.json` and resolves IDs that are not there by searching the other task files (`findFolderTasksFiles`); the search runs only when an ID is unknown,
3. computes the changes (update title, done state, `status` and `note`; move; create) and writes each affected `tasks.json` once with `FolderTasksService.writeFolderCompanion`,
4. updates its snapshot (decision 4) before writing, so the resulting file events produce no note writes.

### 4. List to note: snapshot of linked tasks plus change detection on `tasks.json`

The service keeps a snapshot `Map<tasksUri, Map<id, { title, completed, note }>>` of the tasks it knows. It is built lazily per task file on first use and at activation for all task files (one `findFolderTasksFiles` pass).

Changes are detected by:

- `onDidChangeTextDocument` for documents named `tasks.json`, which covers the folder task list editing the document,
- a `FileSystemWatcher` on `**/tasks.json` (change, create, delete), which covers `FolderTasksService` writes and external edits.

Both are debounced per file (150 ms) and parse the current content with `parseTasksCompanion`.

The new content is diffed against the snapshot:

- **Title or `completed` changed:** rewrite the line with that ID in `<folder>/<note>`.
- **Task missing in the new content but present before:** remove the ID from the line. A task that moved to another file through decision 3 is removed from the snapshot of its old file first, so it is not treated as deleted.
- **Other fields:** ignored.

The snapshot is updated after applying.

Alternative considered: wrap the `FolderTasksService` mutation methods. Rejected, because the folder task list and external edits bypass the service.

### 5. Writing to notes

`applyToNote(noteUri, edits)`:

- **Note open** (in `workspace.textDocuments`): build a `WorkspaceEdit` that replaces only the affected line ranges, apply it, and call `document.save()` only if `isDirty` was false before. The Janus editor receives the change through its existing `onDidChangeTextDocument` path. Because only single lines are replaced, unsaved edits in other lines stay intact in the document.
- **Note closed:** read the file, rewrite the lines and write it with `workspace.fs.writeFile`.

Saving the note in the open case triggers decision 3, which finds nothing to change.

### 6. Editor display: `linkedTasks` extension

A new view plugin in `src/webviews/markdown/extensions/linkedTasks.ts`, registered next to `taskCheckboxes()`. For each linked line in the visible ranges it:

- replaces ` ^t-xxxxxx` with a `LinkedTaskWidget` (a small icon span with `title="In der Aufgabenliste"`) when the ID is hidden by the visibility mode,
- otherwise adds the widget after the ID.

It recomputes on doc, selection, viewport and visibility-mode changes, like `livePreview.ts`.

The ID is hidden in `auto` mode also on the cursor line, because seeing and editing it while typing is noise and risks breaking the link. A `transactionFilter` keeps empty cursors in front of the hidden ID (with `Arrow Right` at the title end moving on to the next line). `Enter` and `Shift+Enter` in front of the ID act as at the line end, so the ID stays on its line. One space after the checkbox is never part of the hidden range, so an empty title keeps a visible place to type, and `styledLists.ts` never hides a range that contains a cursor (typing into a hidden range would insert the text elsewhere).

### 7. AI extraction

`AiTaskGeneratorService` removes lines that `parseLinkedTaskLines` reports from the text before building the prompt. The block-numbered inbox and daily note sorting flows are not affected, since they do not extract from these lines.

## Risks / Trade-offs

- [Race between a list change applied to an open note and the webview's pending debounced edit] -> Only single lines are replaced in the document, and the webview's sync tracker already handles external updates with sequence numbers; the scenario is part of the manual check.
- [A task deleted while its note reference is stale; the ID survives in some note and the next save recreates the task] -> Rare; the recreated task is visible and can be deleted again.
- [ID collision between two independently created IDs] -> 36^6 combinations per folder collection; the creation retries within the current document. A cross-note collision would make the second line take over the task (move). Accepted.
- [Notes changed outside Janus are only synced when saved in VS Code] -> Documented in the proposal; external `tasks.json` changes are picked up by the watcher.
- [Activation cost of building the snapshot] -> One pass over the `tasks.json` files the global list already reads; no note scanning.
