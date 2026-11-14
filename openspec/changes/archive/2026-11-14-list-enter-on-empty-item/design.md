# Design

## Context

See proposal.md for the motivation. Observed state:

- `MarkdownEditorApp.tsx` registers `keymap.of(markdownEditorKeymap)` (default precedence) and then `markdown({ extensions: [Table] })`. `markdown()` adds `Prec.high(keymap.of(markdownKeymap))`, whose `Enter` is `insertNewlineContinueMarkup`. That command produces the "loose list" blank line on an empty item.
- `headingTime` adds its own `Enter` binding with `Prec.high` through a compartment that comes after `markdown()`. `insertNewlineContinueMarkup` returns `false` outside list and quote markup, so the heading time still runs on heading lines.
- `listIndentation.ts` exports `outdentListOrLines`, which already moves a list item one level up, carries children, keeps blockquote prefixes, renumbers ordered lists and dispatches one transaction. `listStructure.ts` provides `findListItemAtLine`, `toListItemInfo` and `parentItem`.

## Goals / Non-Goals

**Goals:**

- One small `Enter` command that only acts on empty list items and otherwise returns `false`, so every other `Enter` path is unchanged.
- Reuse the existing outdent logic instead of a second implementation.

**Non-Goals:**

- No change to `insertNewlineContinueMarkup` behavior for items with text.
- No `Backspace` handling.

## Decisions

### 1. New command `exitEmptyListItem` next to the indentation logic

It lives in `src/webviews/markdown/lib/listIndentation.ts` (or `listEnter.ts` in the same folder if the file grows too large) and is exported with a `listEnterKeymap = [{ key: 'Enter', run: exitEmptyListItem }]`.

It returns `false` unless all of these hold: the editor is not read-only, there is exactly one empty selection, the syntax tree is available, the cursor line is the first line of a `ListItem` (found with `findListItemAtLine`), the item has no child list, the cursor is not before the marker, and the text after the marker (and an optional `[ ]`/`[x]` checkbox) is only spaces.

- **Nested item** (`parentItem(node)` exists): call `outdentListOrLines({ state, dispatch })`. It already handles renumbering, blockquotes and the single transaction. The cursor maps to the end of the moved line, which is after the marker.
- **Top-level item**: one transaction that deletes from the end of the quote prefix (or the line start) to the line end, puts the cursor there, and uses `userEvent: 'delete'`. Inside a blockquote the result is `> `.

Alternative considered: configure `markdown({ addKeymap: false })` and write a full replacement for `insertNewlineContinueMarkup`. Rejected, because the default command is correct for every other case and its list continuation logic is large.

### 2. Precedence: `Prec.high`, registered before `markdown()`

The keymap is added as `Prec.high(keymap.of(listEnterKeymap))` directly before `markdown(...)` in the extension list. Within the same precedence, earlier extensions win, so it runs before `insertNewlineContinueMarkup`, and because it returns `false` everywhere else, headingTime and the default command keep working.

- **Autocomplete:** popups bind `Enter` with `Prec.highest` and keep priority.
- **Tables:** cells are not list items, so the command returns `false` there.

Alternative considered: put the binding into `markdownEditorKeymap`. Rejected, because that keymap has default precedence and would never see `Enter` before the Markdown keymap.

## Risks / Trade-offs

- [Text typed directly on the empty line after a top-level list is lazy continuation of the last item in CommonMark (`- A` / `Text` renders as one item)] -> Accepted, as requested: the line is left empty. Pressing `Enter` once more creates the separating blank line, as in other editors.
- [An empty item with children falls back to the default "loose list" behavior] -> Rare; kept out of scope to avoid orphaning child items.
- [Precedence depends on extension order] -> Covered by a test that builds the editor extensions in the same order and presses `Enter` through the keymap, plus the manual check.
