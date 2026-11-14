# Proposal

## Why

Text that belongs to a list item but is not on the marker line is not aligned with the item's text in the Janus Markdown Editor. Long list lines wrap below the bullet instead of below the text, continuation lines of an item (`  weiter` under `- A`) are shown without list indentation, and `Shift+Enter` in a list item starts a line without any indentation (`- A` + `Shift+Enter` gives `- A` / `` ). Users who want a manual line break inside a list item cannot get one that stays part of the item visually.

## What Changes

- `Shift+Enter` in a list item (bullet, task, ordered, also on its continuation lines) splits the line at the cursor. The new line has no list marker and is indented with spaces to the item's content column (2 under `- `, 3 under `1. `, 4 under `10. `, 2 for task items). Inside blockquotes the `>` prefix is kept. One undo step. Outside list items `Shift+Enter` keeps its current behavior.
- `Enter` on a continuation line of a list item starts a new item of the same list below it (same marker, `[ ] ` for tasks, next number for ordered items); on the empty line right after `Shift+Enter`, `Enter` turns that line into the new item.
- Continuation lines of a list item are shown with their text starting below the item's text (for task items below the text after the checkbox).
- Wrapped lines of list items and their continuation lines start below the item's text (hanging indent), for bullets, tasks and ordered items.
- Leading indentation spaces of list lines are no longer drawn in addition to the level padding; the visual indentation comes from the nesting level only. The Markdown source is unchanged.
- The PDF export already renders single line breaks (`breaks: true`), so a manual break appears there without further changes.

Not part of this change: hanging indent for lists inside blockquotes (they keep their current look; `Shift+Enter` still works there), and any change to `Enter` on marker lines, `Tab` or `Backspace`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirements for `Shift+Enter` line breaks in list items and for aligning continuation and wrapped lines with the item text. "Hierarchical Bullet List Styling", "Tab Key Indentation" and "Enter on Empty List Items" keep their behavior.

## Impact

- `src/webviews/markdown/lib/listIndentation.ts`: new `Shift+Enter` command, bound in `listEnterKeymap`.
- `src/webviews/markdown/extensions/styledLists.ts`: decorations for continuation lines, hidden leading indentation, marker widths as CSS variables, hanging indent styles.
- `src/webviews/markdown/extensions/taskCheckboxes.ts` (styles only, if needed for a fixed checkbox width).
- New tests in `tests/`.
- No new dependencies, no settings, no file format changes.
