# Proposal

## Why

In the inbox sort preview the user can only accept or drop each AI proposal. If the AI picks the wrong note, the only option is to deselect the block, sort it again or move it by hand afterwards. Blocks the AI left unassigned cannot be sorted from the preview at all. Correcting a single target in place would make the preview the place where the sort is actually decided.

## What Changes

- Each proposal row in the preview gets an edit button. It opens a target picker that lists the existing notes (append) and offers a "new note" entry with a path input (create).
- After the user picks a new target, the preview opens again with the changed row (new target, matching action label, checked) and every other selection and edit unchanged.
- Blocks the AI left unassigned are listed in the preview as unchecked rows without a target, each with the same edit button, so they can be sorted too. The existing summary separator line for unassigned blocks is replaced by these rows.
- Paths typed for a new note go through the same normalization and guardrails as AI proposals: canonical root folders, no `..`, no `inbox.md`, no `journal/`. An invalid path is rejected in the input box with a message.
- This works the same way when sorting a daily note.
- Direct mode (`janus.ai.inboxSortConfirm: false`) does not change: there is no preview, so there is nothing to edit.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ai-inbox-sorting`: the preview requirement gains editing of targets and assigning unassigned blocks. "Selective Cleanup" now says a block is unassigned only if it still has no target when the sort is confirmed.

## Impact

- `src/services/aiInboxSorterService.ts`: the preview moves from `showQuickPick` to `createQuickPick` (item buttons), and a target picker plus an input box for new paths are added.
- `tests/__mocks__/vscode.ts`: needs a `createQuickPick` mock with item buttons and accept/hide events.
- `tests/aiInboxSorting.test.ts`: existing preview tests move to the new mock, and new tests cover editing.
- `sample/`: the sample guide gets a short note on editing targets in the preview.
- No new dependencies or settings.
