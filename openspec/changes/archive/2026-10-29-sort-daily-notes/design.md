# Design

## Context

- `AiInboxSorterService.sortInbox(contextUri, openDoc, token)` hard-codes `<notesRoot>/inbox.md`. It reads the text (from the open document if there is one), strips `# Inbox` and the welcome paragraph, splits blocks with `splitInboxBlocks`, asks the model, shows the preview, re-reads and matches blocks by normalized text, appends or creates targets, and finally rewrites `inbox.md` without the consumed blocks (disk write plus a full-text `WorkspaceEdit` on the open document).
- `splitInboxBlocks(body)` returns `{ index, text, heading }`; block positions are not kept.
- `formatAppendedInboxSection(title, text, now)` adds `(YYYY-MM-DD HH:mm)`; `SORT_TIMESTAMP_SUFFIX_RE` strips exactly that form from outline headings.
- `sanitizeRelativeNotePath` maps any unknown first segment under `projects/` or `knowledge/`, so a proposed `journal/2026-10-28.md` would today become `projects/journal/2026-10-28.md`.
- The editor footer gets `onSortAiInbox` for every note. `MarkdownEditorProvider` handles `sortAiInbox` by calling `sortInbox(document.uri, document)`, which only uses the URI to find the notes root.
- `isDailyNotePath(relPath)` from `dailyNoteService.ts` recognizes `journal/YYYY-MM-DD.md`. `parseFrontmatter(text).bodyStart` from `noteMetadataService.ts` gives the end of the frontmatter.

## Goals / Non-Goals

**Goals:**
- One sorting pipeline for both sources. Only reading the blocks, the heading suffix, and updating the source differ.
- Keep inbox sorting behavior and its tests unchanged, apart from the `journal/` exclusion.

**Non-Goals:**
- A new command for the command palette. Daily notes are sorted from the footer only.

## Decisions

### 1. Shared core with a source description

`sortInbox` keeps its signature and becomes a thin wrapper. A new public `sortDailyNote(noteUri, openDocument?, token?)` is added. Both call a private `runSort(source, token)`, where

```ts
type SortSource =
  | { kind: 'inbox'; uri; openDoc? }
  | { kind: 'daily'; uri; openDoc?; date: string; relPath: string };
```

`runSort` does what `sortInbox` does today and branches only in four places: reading blocks (Decision 2), prompt and preview wording, the heading suffix (Decision 4), and updating the source (inbox: remove consumed blocks as today; daily: Decision 3). `SortInboxResult` gets `source: 'inbox' | 'daily'` so the result message can differ.

*Alternative considered:* a separate `AiDailyNoteSorterService`. It would duplicate the AI prompt, preview, matching and target writing, which are the parts most likely to change (`edit-inbox-sort-targets`, `fix-relative-links-after-inbox-sort`).

### 2. Daily note blocks keep their file line numbers

`splitInboxBlocks` additionally returns `startLine` and `endLine` (0-based, first and last non-blank line of the block, relative to the given body). Existing callers ignore them.

For a daily note, the body is the full file text with the frontmatter lines and the first `#` heading outside fenced code **replaced by empty lines**, not cut off. Line numbers in the body then equal line numbers in the file, so insertion needs no offset bookkeeping.

After splitting, two rules apply to daily notes only:
- A chunk that consists only of link lines (`SORTED_LINK_RE = /^->\s*\[\[[^\]\n]+\]\]\s*$/`) is merged into the preceding block. This matters in paragraph mode (no `##` headings), where the blank line before the link line would otherwise turn it into its own block, and the sorted paragraph would lose its marker.
- Blocks with a line matching `SORTED_LINK_RE` outside fenced code are already sorted and are dropped before the AI request. If none remain, the result is `skippedEmpty`.

Block numbers (`index`) are assigned after dropping, so the model sees 1..n.

### 3. Inserting link lines

After writing the targets, `runSort` re-reads the daily note (open document text if available), splits it again with Decision 2, and matches each executed block by normalized text as today. For every matched block it inserts `['', '-> [[' + target + ']]']` after `endLine`, working from the bottom up so earlier line numbers stay valid. `target` is `targetRelativePath` without `.md`.

The updated text is written like `inbox.md` today: to disk, and as a full-text replace in the open document if its text differs. The file's line ending (`\r\n` or `\n`) is kept.

A block whose text no longer matches is reported as `skippedChanged` and gets no link. Its target was not written either, because the existing check before writing already skips it.

### 4. Heading suffix

`formatAppendedInboxSection(title, text, suffix)` takes the suffix string instead of `now`. Inbox sorting passes `formatInboxTimestamp(new Date())`, daily sorting passes the daily note's date `YYYY-MM-DD`. `SORT_TIMESTAMP_SUFFIX_RE` becomes `/\s*\(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?\)\s*$/`, so outline headings drop both forms.

### 5. Excluding `journal/`

- `collectNoteOutlines` skips paths starting with `journal/` (case-insensitive), and the folder list sent to the model leaves out `journal`.
- `sanitizeRelativeNotePath` returns `null` when the first segment is `journal`, so such a proposal counts as unassigned instead of being moved under `projects/`.

This applies to both sources.

### 6. Editor: which note can be sorted

`MarkdownEditorProvider` computes the sort source once per panel from `document.uri`: `inbox` if it equals `<notesRoot>/inbox.md`, `daily` if `isDailyNotePath` matches its path relative to the notes root, otherwise none. It sends `{ type: 'sortSource', source }` right after `init`. On `sortAiInbox` it calls `sortInbox` or `sortDailyNote` accordingly and ignores the message for other notes.

`MarkdownEditorApp` stores the source and passes `onSortAiInbox` and a `sortLabel` (`Inbox einsortieren` / `Tagesnotiz einsortieren`) to `NotesLinksFooter` only when a source is set. The footer's tooltip follows the label.

### 7. Wording

- Prompt: `Blöcke aus <relPath>:` instead of `Blöcke aus inbox.md:`, and rule 4 says unassigned blocks stay where they are.
- Preview title `KI Tagesnotiz-Sortierung – Vorschau bestätigen`, placeholder says the blocks are copied and linked.
- Result: `N Abschnitt(e) einsortiert und verlinkt.` (plus the changed-blocks hint), empty: `Die Tagesnotiz enthält keine neuen Einträge zum Einsortieren.`

### 8. Showing link lines as cards

The file keeps the plain `-> [[target]]` line (marker for re-sorting, portable to other tools). Only the Janus editor renders it differently.

- **Pure scanner** `src/services/sortedLinkScan.ts` (no `vscode` import, so the webview can use it): `SORTED_LINK_RE` moves here from the sorter, and `findSortedLinks(text)` returns per link line its line number, target, the heading of its block (nearest `##`-or-deeper heading above, outside fences) and an anchor text (the nearest non-blank line above the link line, which was copied verbatim).
- **Host** `resolveSortedLinks(text, notesRoot, date)` reads each target once: `exists`, title (frontmatter `title` → first `#` → file name), folder, and the 1-based line of the copied section: the line starting with `## <heading> (<date>`, else the line equal to the anchor text, else none. `MarkdownEditorProvider` sends `{ type: 'sortedLinks', links }` together with every links update, for daily notes only.
- **Webview** extension `sortedLinks.ts`: a `StateField` holds the resolved infos (set via a `StateEffect` on the message). A `ViewPlugin` scans visible lines with `findSortedLinks` logic and adds a `Decoration.replace` widget over each link line (card) and a `Decoration.widget` at the end of the block's heading (badge). It respects `syntaxVisibilityFacet` and the cursor like the live preview does. Before the host data arrives, the card shows the last path segment as title, so there is no flicker of raw text. Clicks call the existing `openLink` path with the target and the line.
- The extension is only active in daily notes: it is enabled through a `Compartment` when the `sortSource` message says `daily`.

*Alternative considered:* rendering cards from the host-provided outgoing links in `linksData`. Those carry no line of the copied section and are computed for all link kinds; a dedicated, small message keeps the footer data unchanged.

## Risks / Trade-offs

- [The user deletes a link line] → The block is sorted again on the next run and copied a second time. Accepted: the link line is the visible record of sorting, and removing it is a deliberate action.
- [The user writes a line `-> [[...]]` by hand] → That block counts as sorted. Accepted, since it then already points somewhere.
- [Full-text replace of the open daily note while the user types] → Same behavior and same risk as inbox sorting today; the re-read just before writing keeps the window small.
- [Copied text drifts from the daily note] → Intended: the daily note is a record of the day, the target note is the version to maintain.
- [Relative links inside a copied block] → They are resolved from `journal/` in the daily note and from the target folder after copying. Not handled here; `fix-relative-links-after-inbox-sort` has to include daily notes as a source.
- [Target note renamed after sorting] → `update-links-on-rename` rewrites the link line, so the card follows. If the copied section's heading was edited, the card opens the note at the top.
