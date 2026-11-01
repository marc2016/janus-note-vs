# Tasks

## 1. Test infrastructure

- [x] 1.1 Add a `createQuickPick` mock to `tests/__mocks__/vscode.ts` (settable `items`, `selectedItems`, `canSelectMany`, `title`, `placeholder`; `show`, `hide`, `dispose`; `onDidAccept`, `onDidHide`, `onDidTriggerItemButton` with helpers to fire them from tests)

## 2. Preview with editable rows

- [x] 2.1 Build the preview row model in `runSort`: one row per block, proposals checked with their target, unassigned blocks unchecked as `$(circle-slash) Kein Ziel` with `fallbackBlockTitle`; remove the unassigned separator and keep the direct-mode toggle row last
- [x] 2.2 Replace the main `showQuickPick` with a `createQuickPick` helper that resolves to accept / cancel / edit-request, gives every row a `$(edit)` "Ziel ändern" item button, and does not treat its own hide during editing as cancel
- [x] 2.3 Loop in `runSort` until accept or cancel: on an edit request run the target picker, update the row (target, action label from file existence, checked) and show the preview again with all selections restored
- [x] 2.4 On accept, turn selected rows that have a target into `InboxSortProposal`s, and report every block without a target as `unassignedBlocks`
- [x] 2.5 Move the existing preview tests in `tests/aiInboxSorting.test.ts` (deselection, block edited during sorting, unassigned listing, daily note confirmation) to the `createQuickPick` mock and keep them passing

## 3. Target picker

- [x] 3.1 Add the target picker: `showQuickPick` with `$(new-file) Neue Notiz…` first, then the existing notes from the collected outlines under `meetings/`, `projects/`, `knowledge/` (localized path as label, title as description, `$(check)` on the current target, `matchOnDescription`); cancel returns no change
- [x] 3.2 Add the new note input: `showInputBox` with `validateInput` based on `sanitizeRelativeNotePath` (error message for rejected paths, normalized path shown as a hint), prefilled with the current target's folder
- [x] 3.3 Tests in `tests/aiInboxSorting.test.ts` for the spec scenarios: redirect to an existing note, redirect to a new note (`Projekte/Beta/feedback` → `projects/Beta/feedback.md` created), invalid paths rejected (`../geheim.md`, `inbox.md`, `journal/…`), assigning an unassigned block (inbox reset to `# Inbox\n\n`), cancelling keeps the row, a selected row without a target stays in the inbox, editing a daily note target inserts the right link line

## 4. Samples

- [x] 4.1 Add a sentence on changing targets in the preview (pencil button, including blocks without a proposal) to the inbox section of `sample/project-plan.md` and the intro of `sample/inbox.md`

## 5. Wrap-up

- [x] 5.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 5.2 Manually sort `sample/inbox.md` with preview: redirect one block to another existing note, send one to a new note with a localized path, assign an unassigned block, cancel one edit, and check the written notes and the remaining inbox; repeat one edit for a daily note
