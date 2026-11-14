# Proposal

## Why

Pressing `Enter` on an empty list item in the Janus Markdown Editor does not leave the item or move it up a level. The first `Enter` moves the marker down one line and leaves a blank line with stray spaces above it (`- A` / `  - B` / `  - ` becomes `- A` / `  - B` / ` ` / `  - `); only a second `Enter` leaves the list. This is the default behavior of the Markdown keymap the editor uses unchanged, and it differs from what users expect from other editors: an empty nested item should move one level up, and an empty top-level item should end the list.

## What Changes

- `Enter` on an empty nested list item (bullet, task or ordered) moves the item one level up, exactly like `Shift-Tab`, including renumbering of ordered lists.
- `Enter` on an empty top-level list item removes the list marker; the line becomes empty and the list ends.
- No blank line with leftover spaces is created by `Enter` on an empty list item.
- The change is one undo step; inside blockquotes the `>` prefix is kept.
- `Enter` on a list item with text keeps its current behavior (new item below). Tables, open autocomplete popups and the heading time on `Enter` in daily notes keep priority.

Not part of this change: `Backspace` directly after the list marker, and `Enter` at the end of a parent item that has child items.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirement for `Enter` on empty list items. The existing requirement "Tab Key Indentation" is unchanged.

## Impact

- `src/webviews/markdown/lib/listIndentation.ts` (or a new sibling module in `lib/`): new `Enter` command for empty list items that reuses the existing outdent logic.
- `src/webviews/markdown/MarkdownEditorApp.tsx`: register the command with a precedence above the Markdown keymap.
- New tests in `tests/`.
- No new dependencies, no settings, no file format changes.
