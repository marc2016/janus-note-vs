# Tasks

## 1. Sorting core

- [x] 1.1 Add `startLine`/`endLine` to the blocks returned by `splitInboxBlocks`, change `formatAppendedInboxSection` to take a suffix string, and widen `SORT_TIMESTAMP_SUFFIX_RE` to date-only suffixes; verify the existing `splitInboxBlocks` and append tests still pass, plus new tests for the line ranges and for the outline scenario with `## Call mit Anna (2026-10-27)`
- [x] 1.2 Exclude `journal/` from `collectNoteOutlines` and the folder list, and return `null` from `sanitizeRelativeNotePath` for a `journal` first segment; verify with tests for "Daily notes are not offered as targets" and "Proposal into journal is ignored"
- [x] 1.3 Refactor `sortInbox` into `runSort(source)` with `source: 'inbox'` in the result, without behavior changes; verify all existing `AiInboxSorterService.sortInbox` tests pass unchanged

## 2. Daily note sorting

- [x] 2.1 Add daily note block reading: blank out frontmatter and the first `#` heading, merge link-only chunks into the preceding block, drop blocks with a `SORTED_LINK_RE` line; verify with tests for "Title and frontmatter are not blocks", paragraph mode with an existing link line, and "Sorting the same daily note twice"
- [x] 2.2 Add `sortDailyNote(noteUri, openDocument?, token?)`: date suffix for appended sections, daily wording in prompt and preview, link insertion bottom-up after the matched blocks with the file's line ending, disk write plus open-document update, `skippedEmpty` when nothing is left; verify with tests for "Copying a block and linking it", "Creating a new note from a daily note block", "Unselected and unassigned blocks stay unlinked", "Nothing left to sort", a block changed during sorting (no target write, no link), and that `inbox.md` is not touched

## 3. Editor

- [x] 3.1 In `MarkdownEditorProvider`, compute the sort source per panel, send `{ type: 'sortSource', source }` after `init`, route `sortAiInbox` to `sortInbox` or `sortDailyNote` and ignore it for other notes, and adapt `showInboxSortResult` to the daily wording; verify with tests in `tests/aiInboxSorting.test.ts` for the inbox source, a daily note source, and a normal note (no sort call)
- [x] 3.2 In `MarkdownEditorApp.tsx` and `NotesLinksFooter.tsx`, show the sort button only with a source and use the label `Inbox einsortieren` / `Tagesnotiz einsortieren`; verify with tests in `tests/notesLinksFooter.test.tsx` for both labels and for no button without a source

## 4. Sorted link display

- [x] 4.1 Add `src/services/sortedLinkScan.ts` with `SORTED_LINK_RE` (sorter imports it from there) and `findSortedLinks(text)`; verify with unit tests for heading blocks, paragraph blocks, fenced code, and that sorter tests still pass
- [x] 4.2 Add host-side `resolveSortedLinks` (title, folder, exists, section line) and send `sortedLinks` with each links update for daily notes; verify with tests for title fallbacks, a missing target, and the section line from heading and from anchor text
- [x] 4.3 Add the webview extension `sortedLinks.ts` (card replace widget, heading badge, cursor and syntax-mode handling, click to open at line), enable it via a compartment for daily notes, and verify with decoration tests for "Card instead of the raw link line", "Missing target", "Editing the raw line" and "Other notes are not affected"

## 5. Wrap-up

- [x] 5.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 5.2 Manually check: no sort button in a project note; sort `inbox.md` as before; sort today's daily note, confirm the targets got `## … (YYYY-MM-DD)` sections and the daily note got `-> [[…]]` lines; add a new section and sort again, confirm only the new block is proposed; check the cards and heading badges, click one to land on the copied section, move the cursor onto a link line to see the raw text
