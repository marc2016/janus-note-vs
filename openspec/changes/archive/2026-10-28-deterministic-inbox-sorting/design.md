# Design

## Context

All sorting logic lives in `AiInboxSorterService.sortInbox` (`src/services/aiInboxSorterService.ts`). Today the flow is: read `inbox.md`, call the AI, parse `{title, content, sourceText, action, targetRelativePath}`, run the QuickPick, write the notes, and finally rebuild `inbox.md` from the body read before the AI call. Two callers show the result message with duplicated code: the `janus.sortInbox` command in `src/extension.ts` and the `sortAiInbox` webview message in `src/editors/markdownEditorProvider.ts`. The second caller passes the open `TextDocument`, so unsaved inbox edits are visible through `getText()`.

## Goals / Non-Goals

**Goals:**
- The text that lands in a note is a byte-identical copy of an inbox block, plus the defined heading.
- Cleanup can only remove a block that was demonstrably written.
- Keep public settings and the QuickPick flow (pre-selected items, direct-mode toggle) unchanged.

**Non-Goals:**
- No changes to the append and create formatting rules (`formatAppendedInboxSection`, the `#` title for new notes).
- No new configuration options.

## Decisions

### 1. Block splitter as a pure function

`splitInboxBlocks(body: string): InboxBlock[]` returns `{ index (1-based), text, heading? }`. Each block's text is the trimmed original slice.
- **Heading mode** applies when at least one line matches `^#{2,6}\s` outside a fenced code block. Each such line starts a block, and any preamble becomes block 1.
- **Paragraph mode** is used otherwise. Blocks are separated by one or more blank lines outside fences.
- In both modes, lines inside ```` ``` ```` or `~~~` fences never split.

*Alternative considered:* letting the AI split but return line ranges. This was rejected because it still depends on the AI being precise, and line numbers drift if the user edits during the request.

### 2. Welcome detection by paragraph

`extractMeaningfulInboxBody` strips the `# Inbox` heading. If the first remaining paragraph starts with `Willkommen in deinen Janus Notes!`, it drops that whole paragraph (up to the next blank line). This covers the init text in `notesRootCommands.ts` and the longer variant in `sample/inbox.md`. The `DEFAULT_INBOX_WELCOME_LINES` replace loop goes away.

### 3. AI response references blocks only

The new schema is `{ items: [{ block: number, title?: string, action?: 'append'|'create', targetRelativePath: string }] }`, and the parser stays tolerant to code fences and to a bare array. `parseAiInboxSortItems(raw, blocks)` does the following:
- maps each item to its block and drops unknown indices;
- keeps the first assignment per block;
- runs `sanitizeRelativeNotePath`;
- falls back to the block heading or the block's first line (truncated) when `title` is missing.

`InboxSortProposal` becomes `{ block: InboxBlock, title, action, targetRelativePath }` and loses `content` and `sourceText`. Downstream code reads `proposal.block.text`.

In the prompt, each block's text is capped at 2,000 characters, with a `…` marker. The model only needs enough text to classify a block, and the verbatim transfer always uses the full text. This keeps very large inboxes affordable.

*Alternative considered:* keeping `content` and diffing it against the block. That adds a failure mode without adding any benefit.

### 4. Note outline context

`collectNoteOutlines(notesRootUri, noteUris)` reads each note and extracts:
- the first `# ` heading as title, with the file name as fallback;
- up to 10 `## ` headings, read outside fences, with ` (YYYY-MM-DD HH:mm)` suffixes stripped and each heading truncated to 80 characters.

Only the first 200 notes (sorted by path) get an outline; the rest are listed by path. These are module constants, not settings. The prompt renders notes as:

```
- projects/App-Launch/app-launch.md — "App-Launch": Push-Notifications; Beta-Feedback
```

### 5. Write-time verification and cleanup

After the QuickPick, and before any note is written:
1. Re-read the inbox: `openInboxDocument.getText()` when it is open, otherwise from disk.
2. Run it through `extractMeaningfulInboxBody` and `splitInboxBlocks` to get the current blocks.
3. A selected proposal is executable only if its block text matches a current block. Matching compares the text with trailing whitespace trimmed per line, and each current block can be consumed only once. Non-executable proposals are skipped.
4. Write the executable proposals to their notes using the existing append and create logic.
5. Rebuild the inbox as `# Inbox\n\n` + the unconsumed current blocks joined by `\n\n`, or just `# Inbox\n\n` if none remain. Write it the same way as today: the file, plus a `WorkspaceEdit` for the open document.

This removes the special case "all selected → reset". The reset now follows from "no unconsumed blocks left", so unassigned blocks, deselected blocks, edited blocks and newly typed text all survive. As before, the welcome paragraph is not written back.

*Alternative considered:* removing text by `indexOf` on the raw document. This was rejected because it is ambiguous with duplicate blocks and fragile with whitespace.

### 6. Result reporting

`SortInboxResult` replaces `remainingItems` with:
- `unassignedBlocks: InboxBlock[]`: blocks with no valid AI proposal;
- `skippedChanged: InboxSortProposal[]`: proposals not executed because their block changed;
- `remainingBlockCount: number`: blocks left in the inbox after cleanup.

A shared `showInboxSortResult(result)` helper, exported from `markdownEditorProvider.ts`, replaces the two duplicated message blocks. It shows `N Abschnitt(e) einsortiert, M in der Inbox verblieben.` and, if any blocks changed, the hint `K Abschnitt(e) wurden währenddessen geändert und nicht verschoben.`

In the QuickPick, a separator item lists the number of unassigned blocks (`N Abschnitt(e) ohne Vorschlag bleiben in der Inbox`). The separator is informational and cannot be picked.

## Risks / Trade-offs

- [Paragraph mode may split one thought into several blocks.] → Several blocks may target the same note, and each is appended in inbox order. This is acceptable; the alternative of AI-merged blocks would reintroduce paraphrasing.
- [A `##` heading inside a quoted or indented context could be treated as a block start.] → Only column-0 headings outside fences count, which matches how the editor renders headings.
- [Reading every note for its outline costs I/O on large roots.] → The outline is capped at 200 notes and computed only once per sort run. Files are read sequentially, as `buildNoteGraph` already does.
- [Older models may still return `content` and `sourceText`.] → Extra fields are ignored by the schema, and only `block` and the target are used.
- [Changing `InboxSortProposal` breaks existing tests.] → The tests in `tests/aiInboxSorting.test.ts` are updated as part of this change; there are no other consumers.
