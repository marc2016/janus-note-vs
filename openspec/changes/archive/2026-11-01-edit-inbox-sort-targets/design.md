# Design

## Context

The preview in `AiInboxSorterService.runSort` is a single `vscode.window.showQuickPick` call with `canPickMany`. It returns the checked items and has no per-row actions. Unassigned blocks appear only as one separator line with a count. Writing, the re-read of the source note, the append-only fallback and the path rewrite all run after the preview on a list of `InboxSortProposal`. So a changed target only has to end up in that list. Requirements: see `specs/ai-inbox-sorting/spec.md`.

## Goals / Non-Goals

**Goals:**
- Change the target per row without leaving the preview, then return to the same preview state.
- Allow giving unassigned blocks a target.
- Reuse the existing path guardrails and the write path unchanged.

**Non-Goals:**
- Editing the title or the block text in the preview.
- Splitting or merging blocks.
- Asking the AI again for a new proposal.
- A webview-based preview.

## Decisions

### Preview via `createQuickPick` with item buttons
Each row gets a `$(edit)` item button ("Ziel ändern"). Pressing it fires `onDidTriggerItemButton`. The preview is hidden, the target picker runs, and the preview is rebuilt and shown again.

- Alternative: an extra "edit targets…" entry in the existing `showQuickPick` that opens a second picker to choose the row. This needs two extra steps per edit and is less direct.
- Alternative: a webview panel. Too much for this change, and it breaks the QuickPick flow the user already knows.

The preview is wrapped in a small helper that returns a promise: `accept` → selected rows, `hide` without accept → cancelled, `button` → edit request for a row. `runSort` loops: show the preview; on an edit request, run the target picker, update the row model and show again. It exits on accept or cancel. The row state (`target`, `action label`, `picked`) lives in a plain array that the loop owns, so a rebuild keeps selections. Before each re-show, `selectedItems` is set from that array.

### Row model
Each row holds `block`, `title`, and `target?: string` (a sanitized relative path). Rows with a proposal start with `picked: true`. Unassigned rows start with `picked: false`, no target, the label `$(circle-slash) Kein Ziel` and the title `fallbackBlockTitle(block)`. On accept, rows that are selected and have a target become `InboxSortProposal`s with `action` derived from file existence, exactly like today. The separator line for unassigned blocks goes away. The "direct mode" toggle row stays last.

`unassignedBlocks` in `SortInboxResult` becomes "blocks without a target at confirmation". The editor's result message then counts correctly when the user assigned some of them.

### Target picker
`showQuickPick` (single-select) lists:
1. `$(new-file) Neue Notiz…`. This opens `showInputBox` with `validateInput` built on `sanitizeRelativeNotePath`. A `null` result shows an error message. Otherwise the input box shows the normalized path as a hint, so localized roots (`Projekte/…`) are visible as `projects/…` before confirming.
2. Existing notes from the `outlines` already collected for the prompt (same filter: no `inbox.md`, no `journal/`), shown with `formatRelativePathWithLocalizedRoot` and their title as description. The current target is marked with `$(check)`. `matchOnDescription` lets the user search by title.

The list is limited to notes under the canonical root folders, because `sanitizeRelativeNotePath` would rewrite any other path anyway. Notes in other top-level folders are left out instead of being silently moved.

### Testing
`tests/__mocks__/vscode.ts` gets a `createQuickPick` factory that returns a controllable object (`items`, `selectedItems`, `buttons`, `show`, `hide`, `dispose`, and `onDidAccept` / `onDidHide` / `onDidTriggerItemButton` registries). Tests drive the object with `vi.spyOn(vscode.window, 'createQuickPick')`. Existing preview tests that spy on `showQuickPick` for the main preview move to this mock. `showQuickPick` stays in use for the target picker.

## Risks / Trade-offs

- [Hide/show flicker when the preview opens again after an edit] → Acceptable for a QuickPick. Alternatively, keep the same QuickPick instance and only replace `items` and `selectedItems` after the picker closes.
- [`onDidHide` also fires when the preview is hidden for the target picker] → A flag `editing` in the helper keeps that hide from counting as a cancel.
- [Many notes make the target picker long] → QuickPick filtering covers it. There is no extra limit, because there is no AI-context cost here.
- [The source note changes during a long editing session] → The existing re-read after the preview still skips changed blocks.

## Migration Plan

None. The preview behaves as before for users who do not press the edit button. Rollback is a plain revert.
