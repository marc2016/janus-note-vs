## ADDED Requirements

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

## MODIFIED Requirements

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
