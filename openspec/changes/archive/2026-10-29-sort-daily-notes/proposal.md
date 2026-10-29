# Proposal

## Why

The footer button `Inbox einsortieren` appears in every note, but always sorts `inbox.md`, no matter which note is open. That is confusing in any note other than the inbox. At the same time, daily notes (from `daily-notes`) collect thoughts during the day that belong into project and knowledge notes, but they cannot be sorted. Unlike the inbox, a daily note is a record of the day and must stay readable afterwards, so sorting it must not empty it.

## What Changes

- The footer sort button only appears in `inbox.md` (`Inbox einsortieren`) and in daily notes (`Tagesnotiz einsortieren`). Other notes no longer show it. The `janus.sortInbox` command and the chat `/inbox` action are unchanged and still sort `inbox.md`.
- Sorting a daily note uses the same AI assignment, preview and append-only rules as the inbox, but **copies** each block into its target instead of moving it.
- After a block is copied, the daily note gets a link line directly below that block: `-> [[<target path without .md>]]`, for example `-> [[projects/App-Launch/architektur]]`. The rest of the daily note stays unchanged.
- A block that already has such a link line counts as sorted and is skipped in later runs, so sorting the same daily note again only handles new blocks.
- The frontmatter and the `#` title of a daily note never count as blocks.
- Sections copied from a daily note get the daily note's date in their heading (`## Call mit Anna (2026-10-27)`), not the time of sorting.
- Daily notes (`journal/`) are no longer offered to the AI model as sort targets, and proposals pointing into `journal/` are ignored. This applies to inbox sorting too.

Non-goals (possible follow-ups): sorting a single block from an action at its heading, sorting other note types, undoing a daily note sort (`undo-inbox-sort`), and adjusting relative links inside copied blocks (`fix-relative-links-after-inbox-sort` should treat `journal/` as another source folder).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-inbox-sorting`: new requirement for sorting daily notes by copying and linking; daily notes are excluded as targets.
- `markdown-editor`: the footer sort button is only shown in `inbox.md` and in daily notes, with a label matching the note.

## Impact

- `src/services/aiInboxSorterService.ts`: shared sorting core for both sources, block line ranges, daily note body extraction, link insertion, sorted-marker detection, `journal/` exclusion, date-only heading suffix.
- `src/editors/markdownEditorProvider.ts`: tells the webview which sort source the open note is, routes the footer click to inbox or daily note sorting, reports the result.
- `src/webviews/markdown/MarkdownEditorApp.tsx` and `components/NotesLinksFooter.tsx`: button visibility and label.
- Reuses `isDailyNotePath` from `src/services/dailyNoteService.ts`.
- No new settings or dependencies. `janus.ai.inboxSortConfirm` also controls the daily note preview.
