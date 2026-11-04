# Proposal

## Why

Daily note entries are `##` sections, often written at different times of the day. Today nothing records when an entry was written. When a block is sorted into a project note, it only gets the daily note's date (`## Call mit Anna (2026-10-29)`), so the time of the entry is lost.

## What Changes

- In a daily note, when the user finishes a newly typed heading of level 1 or 2 (`#`, `##`) by pressing `Enter` at its end, the editor appends the time the heading was started, as ` (HH:mm)`, to the heading text, for example `## Call mit Anna (14:32)`. The cursor moves to the new line as usual.
- The time is plain Markdown text. After insertion it is an ordinary part of the heading: it can be edited or deleted, is not inserted again, and is undone together with the line break by one undo step. It is displayed like the rest of the heading (no special styling).
- Deeper headings (`###` and below) never get a time. Neither do headings that were not typed in this editor session (the template title and template headings like `## Notizen`, older entries, headings in other notes or in `inbox.md`).
- When a daily note block whose heading ends with ` (HH:mm)` is sorted, the target heading combines the daily note's date with that time: `## Call mit Anna (2026-10-29 14:32)` instead of `## Call mit Anna (14:32) (2026-10-29)`, both when appending to an existing note and when creating a new one.
- Out of scope for now: a folder hint per entry for the AI (discussed, deferred).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `daily-notes`: new requirement for the creation time in daily note headings.
- `ai-inbox-sorting`: *Sorting a Daily Note by Copying and Linking* defines how a heading time is combined with the daily note's date.

## Impact

- Webview: a new editor extension (time capture plus `Enter` binding) in `src/webviews/markdown/extensions/`, enabled only for daily notes through a compartment in `MarkdownEditorApp.tsx`, like the sorted-link cards.
- `src/services/aiInboxSorterService.ts`: heading formatting for sorted daily note blocks (`formatAppendedInboxSection` and the create path).
- Tests: new unit tests for the extension, extended tests in `tests/aiInboxSorting.test.ts`.
- `sample/`: guide section and an example entry with a time in a sample daily note.
- No new settings or dependencies.
