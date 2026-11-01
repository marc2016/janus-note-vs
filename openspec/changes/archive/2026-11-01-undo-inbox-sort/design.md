# Design

## Context

`AiInboxSorterService.runSort` writes in one pass: per executed proposal it either appends `separator + formatAppendedInboxSection(...) + '\n'` to an existing note (after trimming its trailing whitespace) or writes a new file, creating parent folders with `createDirectory`. It then rewrites the source note once (`inbox.md` remaining blocks, or `insertSortedLinks` for a daily note) via `fs.writeFile` plus a `WorkspaceEdit` on an open document. The extension holds two sorter instances (`extension.ts` for `janus.sortInbox`, `MarkdownEditorProvider` for the footer button); both report through `showInboxSortResult`. Requirements: see `specs/ai-inbox-sorting/spec.md`.

## Goals / Non-Goals

**Goals:**
- Exact restore when nothing was touched since the run; safe partial restore otherwise.
- One shared undo slot for both entry points.

**Non-Goals:**
- Multi-step undo history or redo.
- Persisting the undo record across window reloads.
- Integrating with the editor's own Ctrl+Z history.

## Decisions

### Record built during the write phase
`runSort` collects an `InboxSortUndoRecord`:
```
{ source: { uri, kind, textBefore, textAfter, removedBlocks: string[], links: string[] },
  appended: [{ uri, textBefore, textAfter, section }],   // section = exactly the appended string incl. separator
  created:  [{ uri, text }],
  createdFolders: Uri[] }                                  // deepest first, only folders that did not exist
```
`textBefore`/`textAfter` are the full file texts the sorter read and wrote, so the common case (nothing changed since) is a plain write-back. Several proposals can target the same note; `appended` keeps one entry per note with the text before the first and after the last write, plus the list of sections, so the exact restore still works.

`createDirectory` is recursive, so before creating a parent the sorter walks up and records each missing folder.

The record is returned in `SortInboxResult.undo` (only when something was written) and stored by the caller.

- Alternative: snapshot whole files only. Simpler, but any later edit would make undo impossible or destructive; the section-level data enables the conflict rules.

### Shared store module `inboxSortUndo.ts`
A module-level `lastRun: InboxSortUndoRecord | undefined` with `rememberSortRun(record)`, `hasSortRunToUndo()` and `undoLastSortRun(): Promise<UndoReport>`. `showInboxSortResult` calls `rememberSortRun(result.undo)` when present and adds the „Rückgängig" button; both entry points already call it, so no wiring in the sorter instances is needed. `undoLastSortRun` clears `lastRun` before writing, so a second click or command does nothing.

- Alternative: a single shared `AiInboxSorterService` instance. Larger refactor of the provider's constructor and tests for no behavioral gain.

### Undo algorithm (per file, using the open document text if one exists)
- **Appended note**: current === `textAfter` → write `textBefore`. Else, for each recorded section: if it occurs exactly once in the current text, cut it out; otherwise mark the note as kept. A note where any section was missing is reported as unchanged and not written at all, to avoid half-undone notes.
- **Created note**: current === recorded text → delete the file; else keep and report. Then delete each recorded folder (deepest first) if `readDirectory` returns no entries.
- **Inbox**: current === `textAfter` → write `textBefore`. Else append `removedBlocks` (blocks that were written) to the end, joined with blank lines.
- **Daily note**: current === `textAfter` → write `textBefore`. Else remove each recorded link line (`-> [[target]]` line plus one preceding blank line) at its first occurrence.
- Writes go through one helper that writes the file and applies a full-range `WorkspaceEdit` to an open document, mirroring the sorter; that helper is extracted from `runSort` and reused.

### Report
`UndoReport { undone: number; keptNotes: string[] }` → `showInformationMessage("Sortierung rückgängig gemacht." + optional "Unverändert gelassen: a.md, b.md (seitdem bearbeitet).")`. The notes tree is refreshed via the existing `janus.refreshNotesTree` command.

## Risks / Trade-offs

- [The same section text appears twice in a note (e.g. the user copied it)] → "exactly once" check; otherwise the note is kept and reported.
- [An appended section was edited but its block is still restored to the inbox → text exists twice] → Accepted: duplication is recoverable, loss is not. The report names the note.
- [A trailing-whitespace difference: the sorter trims the note before appending] → the `textAfter` fast path restores the exact original; the fallback cut leaves the trimmed form, which is harmless.
- [Record kept in memory only] → Lost on window reload; documented as a non-goal.

## Migration Plan

None; new command and button only.
