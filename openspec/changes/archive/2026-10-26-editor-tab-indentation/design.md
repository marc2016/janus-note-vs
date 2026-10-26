# Design

## Context

- The editor keymap in `src/webviews/markdown/MarkdownEditorApp.tsx` is `keymap.of([...formattingKeymap, ...defaultKeymap, ...historyKeymap])`. CodeMirror's `defaultKeymap` deliberately does not bind `Tab`, so it currently falls through to the browser and moves focus.
- The editor already parses the document with `@codemirror/lang-markdown` (Lezer Markdown + GFM `Table`). The syntax tree exposes `BulletList` / `OrderedList` → `ListItem` → `ListMark` nodes, so we can get list structure without regexes. `livePreview.ts` already uses `ensureSyntaxTree`.
- `styledLists.ts` decorates list lines with `cm-list-level-N` using regexes and `floor(indent / 2)`. That gives wrong levels once ordered lists are indented by CommonMark widths (see proposal).
- Tables are rendered by `codemirror-markdown-tables`, which handles in-cell `Tab` / `Shift-Tab` navigation itself. Slash command and link completion use `@codemirror/autocomplete`.
- The project follows a zero-diff principle (`markdown-editor` › Zero-Diff Persistence): edits must only touch the lines they need to touch.

## Goals / Non-Goals

**Goals:**
- One keymap entry for `Tab` / `Shift-Tab` that is list-aware, CommonMark-correct, and falls back to plain line indentation.
- Each `Tab` / `Shift-Tab` press is a single transaction, and therefore a single undo step, including any renumbering.
- Nesting depth for styling comes from the same structural understanding as the indent commands.

**Non-Goals:**
- Normalizing existing, inconsistently indented lists in the document (we only touch the lines affected by the user's action).
- Renumbering ordered lists on other edits (typing, deleting, pasting). Only Tab/Shift-Tab renumber.
- Changing `Enter` / `Backspace` list continuation behavior (already provided by `lang-markdown`'s `markdownKeymap`).
- Inserting literal tab characters or making the indent unit configurable.

## Decisions

**1. Custom commands in a new `src/webviews/markdown/lib/listIndentation.ts` instead of plain `indentWithTab`.**
`indentWithTab` (`indentMore` / `indentLess`) always shifts by `indentUnit` (2 spaces). That produces non-nesting Markdown under ordered markers (`1. ` needs 3). We export `indentListOrLines(view)` and `outdentListOrLines(view)` as `StateCommand`-style functions plus a `listIndentationKeymap: KeyBinding[]` (`Tab` → indent, `Shift-Tab` → outdent). When the selection contains no list items, they delegate to `indentMore` / `indentLess` from `@codemirror/commands`. When nothing can be done (first item, top-level outdent), they return `true` so that focus still stays in the editor.

**2. Use the syntax tree for list structure, not regexes.**
For each selected line we find the innermost `ListItem` starting on that line (via `ensureSyntaxTree`). From the tree we derive:
- the item's *block range*: the item line plus all lines of nested child items, which move along with it;
- its *previous sibling* `ListItem`, i.e. the nest target. The new indentation is the sibling's content column, which is the column after `ListMark` plus its following space(s). This matches CommonMark: child content must start at the parent's content column;
- its *parent* `ListItem` for outdent. The new indentation is the parent's own indentation (the column where its `ListMark` starts).
The whole block range is shifted by `delta = newIndent - currentIndent` columns. Lines with less leading whitespace than needed for a negative delta are clamped at 0.
*Alternative considered:* regex scanning like `styledLists` today. Rejected: lazy continuation lines, blank lines inside items and mixed markers make it fragile, and the tree is already available.

**3. Multi-selection handling.**
We collect the top-most list items touched by any selection range (ignoring items whose ancestor is also selected, so they move only once) and build one `ChangeSet` across all of them. Selections are mapped through the changes. Lines without a list item in a mixed selection are shifted by `indentUnit`, the same as the fallback.

**4. Renumbering (assumption from exploration: Obsidian-style).**
After computing the indentation changes, we renumber within the same transaction:
- *Nest:* the moved item becomes `1.` (keeping its delimiter `.` or `)`) if it starts a new sub-list. If it joins an existing ordered sub-list of the previous sibling, it continues that list's numbering. The remaining items of the list it left are renumbered consecutively, starting from the number of the moved item.
- *Outdent:* the moved item takes the number following its new previous sibling, and the following items of the destination list are renumbered consecutively. The list it left keeps its numbering, which is already consecutive because the moved item was last or its later siblings followed it in CommonMark terms.
- A list's start number (its first item) is always preserved. Only lists affected by the action are touched (zero-diff).
Renumbering is isolated in its own helper so that it can be dropped without touching the indent logic, should the assumption be rejected during review.

**5. Keymap precedence.**
`listIndentationKeymap` is added at default precedence after the existing keymaps: `keymap.of([...formattingKeymap, ...defaultKeymap, ...historyKeymap, ...listIndentationKeymap])`. `codemirror-markdown-tables` handles cell editing in its own nested editors and keymap, and `@codemirror/autocomplete`'s `completionKeymap` runs at `Prec.highest`. Both therefore win whenever they claim `Tab`. CodeMirror's built-in `Esc`, `Tab` focus escape (tab-focus mode) keeps working because it is handled by the view before keymaps run.

**6. Structural nesting depth in `styledLists`.**
Replace `floor(indent / 2)` with a depth computed from the syntax tree: the number of `ListItem` ancestors of the line's `ListItem` (top level = 0), capped at 6 as today. A small shared helper (e.g. `getListDepthAt(state, pos)`) lives in `listIndentation.ts` or a `lib/listStructure.ts` used by both modules. The decoration builder still iterates over visible lines, but resolves depth via the tree instead of regex groups. Marker detection for the bullet widget stays as it is.

## Risks / Trade-offs

- [Syntax tree not yet parsed for large documents] → Use `ensureSyntaxTree(state, line.to, 50)` and fall back to `syntaxTree(state)`, as `livePreview` does. If the tree is incomplete, the list commands fall back to plain `indentMore` / `indentLess` rather than guessing.
- [Lezer treats a line indented by fewer columns than required as a sibling or paragraph continuation] → That is exactly CommonMark semantics, and the reason we compute widths from the tree. Tests cover `1. `, `10. `, and `- [ ] `.
- [Table cell navigation could regress if `codemirror-markdown-tables` routes Tab through the outer editor] → Explicit test that `Tab` inside a table cell still navigates cells. If it conflicts, our command returns `false` when the cursor is inside a `Table` node.
- [Renumbering surprises users with intentionally non-consecutive numbers] → Only the lists touched by the action are renumbered, and the start number is preserved. The logic is isolated so it can be disabled.
- [Depth change in `styledLists` alters existing rendering of oddly indented lists] → The rendering becomes CommonMark-correct, matching what PDF export and other renderers show. This is accepted as a bug fix.
