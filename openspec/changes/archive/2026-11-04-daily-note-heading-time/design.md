# Design

## Context

- The webview already knows whether the open note is a daily note: the host sends `sortSource` (`'daily' | 'inbox' | null`), and `MarkdownEditorApp.tsx` uses it to enable the sorted-link cards through `sortedLinksCompartment`.
- Key bindings come from `markdownEditorKeymap` (`lib/editorKeymap.ts`), where `defaultKeymap` handles `Enter` (`insertNewlineAndIndent`).
- Sorting writes daily note blocks through `formatAppendedInboxSection(title, text, suffix)` with `suffix = source.date` for daily notes. New notes are created from the block text as is (`/^#\s+/.test(text) ? text : '# <name>\n\n' + text`). Undo stores the sections and file contents actually written, so a changed heading needs no extra undo handling.
- `SORT_TIMESTAMP_SUFFIX_RE` already recognizes `(YYYY-MM-DD HH:mm)` when outlines of target notes are sent to the AI model.

## Goals / Non-Goals

**Goals:**
- Capture the time a heading was started without any hidden metadata.
- Keep everything after insertion plain text.

**Non-Goals:**
- Times for headings typed before this change, created by AI actions, pasted, or written in other editors.
- Correcting the date when a heading is written into the daily note of another day (the target then gets that note's date with today's time; accepted).
- The folder hint for the AI (deferred).

## Decisions

**1. A `StateField` remembers when lines became headings.**
New extension `extensions/headingTime.ts`. Its `StateField` holds a `RangeSet` of point markers (value: the `HH:mm` string) at the start of lines that became a `#` or `##` heading through a user transaction (`userEvent` `input*`, not `Transaction.remote`). Detection: after a user input transaction, for each changed line check whether it matches `^#{1,2}\s` now but did not before the transaction (via `tr.startState`). Markers are mapped through changes and dropped when their line no longer is a heading.
- *Alternative:* add the time to every heading without a time on `Enter`. Rejected: template headings (`## Notizen`) and old entries would get the current time, which is wrong.
- *Alternative:* set the time when the line becomes a heading. Rejected: the heading text is not written yet, so the time would sit between `##` and the text.

**2. `Enter` binding with high precedence, only active in daily notes.**
`Prec.high(keymap.of([{ key: 'Enter', run }]))` inside a new `headingTimeCompartment`, reconfigured from `sortSource === 'daily'` like `sortedLinksCompartment`. `run` returns `false` (falls through to the default `Enter`) unless: the selection is a single cursor at the end of the line, the line has a marker, the heading has text, and it does not already end with `(HH:mm)` or `(YYYY-MM-DD HH:mm)`. Otherwise it dispatches one transaction that inserts ` (HH:mm)` at the line end and the newline after it (`userEvent: 'input'`), so a single undo reverts both, and removes the marker. Deleting the time later does not re-add it, because the marker is gone.
- The time comes from the marker, so it is the moment the line became a heading, not the moment `Enter` is pressed.
- Markers do not survive reopening the note; that is fine, because the time is in the text after the first `Enter`.

**3. Sorting: combine instead of append.**
A helper `combineHeadingTime(text, date)` turns a leading heading ending in ` (HH:mm)` into ` (YYYY-MM-DD HH:mm)`, and returns the text unchanged otherwise. For daily notes, it runs on the block text before `formatAppendedInboxSection` (whose existing `includes(timestamp)` check then skips the second suffix, because the date is already present) and before writing a new note. Inbox sorting is unchanged.
- *Alternative:* change `formatAppendedInboxSection` only. Rejected: new notes would keep the bare `(HH:mm)`.

**4. No special styling.**
The time is rendered like the rest of the heading, as the user asked ("normal part of the Markdown"). This was a small open point in exploration and is recorded as an assumption here.

## Risks / Trade-offs

- [`Enter` with an open autocomplete popup or inside a table] → Those bindings run before ours or the line is not a heading; the binding only acts on heading lines and otherwise returns `false`.
- [Heading created through the slash command `/h2`] → That is a user transaction too; whether its `userEvent` is `input` is checked in the unit tests, and the marker is set if it is.
- [User keeps typing in the heading for a long time] → The time is when the heading started; intended.
