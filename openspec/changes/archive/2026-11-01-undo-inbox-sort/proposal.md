# Proposal

## Why

An inbox sort run moves text into several notes at once. If it went wrong — wrong targets, direct mode without preview, or a misclick — the user has to find every appended section, delete created notes and copy the blocks back into the inbox by hand. A one-step undo makes sorting safe to try, especially in direct mode.

## What Changes

- After every sort run that wrote something, the system remembers what it changed: for each target note whether it was appended to or created, with the exact text it wrote, and the content of `inbox.md` (or the daily note) before and after.
- The result message gets a **„Rückgängig"** button, and a new command **„Janus: Letzte Inbox-Sortierung rückgängig machen"** (`janus.undoInboxSort`) does the same from the command palette.
- Undo restores the last run:
  - appended sections are removed from their target notes,
  - notes created by the run are deleted (and folders the run created, if they are empty again),
  - `inbox.md` gets its sorted blocks back, or the `-> [[…]]` lines are removed from the daily note.
- Undo never destroys edits made after the sort: a created note that was changed since is kept, an appended section that cannot be found verbatim stays, and if the inbox was edited since, the sorted blocks are added back at its end instead of overwriting it. The user is told what could not be undone.
- Only the most recent run can be undone, once, and only within the current VS Code window session.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ai-inbox-sorting`: new requirements for recording a sort run and undoing it (including the conflict rules above). Existing requirements are unchanged.

## Impact

- `src/services/aiInboxSorterService.ts`: record the run (before/after texts, appended sections, created files and folders) in the write phase.
- New `src/services/inboxSortUndo.ts`: holds the last run (shared by the command and the editor button, which use separate sorter instances) and performs the undo.
- `src/editors/markdownEditorProvider.ts` (`showInboxSortResult`): „Rückgängig" button.
- `src/extension.ts`, `package.json`: register and contribute `janus.undoInboxSort`.
- Tests in `tests/aiInboxSorting.test.ts` (or a new `tests/inboxSortUndo.test.ts`), sample guide entry.
