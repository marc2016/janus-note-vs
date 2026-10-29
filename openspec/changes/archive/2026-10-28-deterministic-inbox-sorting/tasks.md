# Tasks

## 1. Parsing building blocks

- [x] 1.1 Rewrite `extractMeaningfulInboxBody` to drop the whole first paragraph when it starts with `Willkommen in deinen Janus Notes!` (remove `DEFAULT_INBOX_WELCOME_LINES`). Verify with tests in `tests/aiInboxSorting.test.ts`:
  - the init text from `notesRootCommands.ts` yields an empty body;
  - the long welcome from `sample/inbox.md` is removed;
  - a user paragraph after the welcome survives.
- [x] 1.2 Add `InboxBlock` and `splitInboxBlocks(body)`:
  - heading mode for `##`–`######` at column 0, with the preamble as its own block;
  - paragraph mode otherwise;
  - fenced code (```` ``` ````, `~~~`) never splits.

  Verify with tests:
  - `sample/inbox.md` yields 8 blocks;
  - an intro plus three sections yields 4;
  - three paragraphs, one of them a bullet list, yield 3;
  - a `##` line inside a fence does not split;
  - a blank line inside a fence does not split in paragraph mode.
- [x] 1.3 Replace the AI response schema with `{block, title?, action?, targetRelativePath}` and change `parseAiInboxSortItems(raw, blocks)` to return `InboxSortProposal { block, title, action, targetRelativePath }`:
  - unknown block numbers are dropped;
  - the first assignment per block wins;
  - paths are sanitized;
  - a missing title falls back to the block heading or its first line;
  - extra `content` and `sourceText` fields are ignored.

  Update the existing parser tests and add one for each of these rules.
- [x] 1.4 Add `collectNoteOutlines` with title (first `#` heading or file name) and up to 10 `##` headings per note, read outside fences, with timestamp suffixes stripped, each heading truncated to 80 chars, and outlines only for the first 200 notes (path-only after that). Verify with tests:
  - a note with `## Beta-Feedback (2026-10-20 09:15)` yields the heading `Beta-Feedback`;
  - a note without a title heading uses its file name;
  - with the limit lowered through an exported constant or parameter, notes beyond it carry no outline.

## 2. Sorting flow

- [x] 2.1 Rewrite the prompt in `sortInbox`:
  - numbered blocks, each capped at 2,000 chars in the prompt;
  - the note list with title and headings;
  - the system prompt asks only for block assignments.

  Verify with a test that captures the `completePrompt` arguments: block markers `[Block 1]`… are present, note headings appear, and the welcome text is absent.
- [x] 2.2 Implement write-time verification and cleanup per design decision 5: re-read the inbox (open document or disk), match selected blocks against the current blocks, write only matched blocks verbatim, and rebuild `inbox.md` from the unconsumed blocks. Verify with tests:
  - the AI assigns 2 of 3 blocks and all are confirmed → the third block stays in `inbox.md`;
  - all blocks are assigned and confirmed → `inbox.md` is `# Inbox\n\n`;
  - a block is edited in the open document between the AI call and the write → that block is not written to its target and stays edited in the inbox;
  - a new paragraph is typed during sorting → it survives;
  - the target note content equals heading + original block text, byte for byte.
- [x] 2.3 Update the preview QuickPick: the item detail comes from `proposal.block.text`, and a separator shows `N Abschnitt(e) ohne Vorschlag bleiben in der Inbox` when blocks are unassigned. Verify that the existing deselection test still passes, and add a test that the separator item is present when one block is unassigned.
- [x] 2.4 Change `SortInboxResult` to `unassignedBlocks`, `skippedChanged` and `remainingBlockCount`, and verify with `npm run compile` that no caller still uses `remainingItems`.

## 3. Result message

- [x] 3.1 Add an exported `showInboxSortResult(result)` helper in `src/editors/markdownEditorProvider.ts` with the messages:
  - `N Abschnitt(e) einsortiert, M in der Inbox verblieben.`;
  - the hint about blocks changed during sorting;
  - the empty and no-proposal messages;
  - the `Notiz öffnen` action.

  Use it in the `sortAiInbox` handler and in the `janus.sortInbox` command in `src/extension.ts`. Verify that the existing `sortAiInbox` webview message test passes, and add one asserting the message text when one block remained.

## 4. Specs and final check

- [x] 4.1 Run `npm test`, `npm run compile` and `npm run build`, and verify that all pass.
- [x] 4.2 Verify in the running extension with `sample/inbox.md`:
  - the preview lists proposals for the 8 sections and does not include the welcome text;
  - after confirming, each target note contains the original section text unchanged;
  - deselected or unassigned sections are still in `inbox.md`.
