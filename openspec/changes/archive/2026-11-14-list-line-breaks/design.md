# Design

## Context

See proposal.md for the motivation. Observed state:

- `Shift-Enter` is not bound by the editor. It reaches `insertNewlineAndIndent` through `defaultKeymap` (`{ key: 'Enter', shift: insertNewlineAndIndent }`), which copies at most the existing leading spaces of the line, so a top-level item gets no indentation. The Markdown keymap binds only plain `Enter`.
- `markdownEditorKeymapExtensions()` in `editorKeymap.ts` already registers `Prec.high(keymap.of(listEnterKeymap))` before `markdown()`.
- `styledLists.ts` decorates only marker lines: a line class `cm-list-item cm-list-level-N` with a fixed `padding-left` per level, a `BulletWidget` (inline-block, `1.25rem`) replacing `- ` for bullets, a mark `cm-ordered-list-mark` for numbers, and nothing for the `- ` of task items. Leading spaces stay visible in addition to the padding. Continuation lines get no decoration.
- `taskCheckboxes.ts` replaces `[ ]`/`[x]` with a checkbox widget (14px plus 6px margin). The `- ` before it is shown as text.
- The editor uses `EditorView.lineWrapping`; every document line is one `.cm-line` block, so `text-indent` affects only its first visual line.

## Goals / Non-Goals

**Goals:**

- `Shift+Enter` as a small command next to `exitEmptyListItem`, reusing `listStructure.ts`.
- Hanging indent and continuation alignment from CSS only, with widths that are known up front (no DOM measuring).

**Non-Goals:**

- Hanging indent for lists inside blockquotes.
- Changing nesting detection; levels keep coming from `getListDepthAt`.

## Decisions

### 1. `insertListLineBreak` command, bound as `shift` of the list Enter binding

It lives in `listIndentation.ts`, and `listEnterKeymap` becomes `[{ key: 'Enter', run: exitEmptyListItem, shift: insertListLineBreak }]`. Because that keymap is `Prec.high` and comes before `markdown()`, it runs before `defaultKeymap`'s `insertNewlineAndIndent`.

It returns `false` unless the editor is writable, there is one selection range, the syntax tree is available, the range is not inside a `Table`, and the line of the range start belongs to a `ListItem` (via `findListItemAtLine`; for a continuation line this finds the enclosing item). On the marker line the cursor must be at or after `markTo`.

The inserted text is a newline, then the quote prefix of the current line (`>` characters with one following space each, as in `quotePrefixLength`), then spaces up to the item's `contentCol` (from `toListItemInfo`, measured from the line start). The replaced range extends over spaces directly before the cursor and directly after it (or the selection). One transaction with `userEvent: 'input'`; the cursor goes to the end of the inserted indentation.

Alternative considered: `insertNewlineAndIndent` with a custom indent service. Rejected, because the Markdown language's indentation is used by other commands too and would change their behavior.

### 2. Rendering: leading spaces hidden, level padding plus a marker width variable

For every list marker line and continuation line outside blockquotes, `buildListDecorations`:

- **Leading spaces:** replaces them with an empty `Decoration.replace` (nothing drawn; the source is unchanged).
- **Line decoration:** adds `cm-list-level-N` and `style="--cm-list-marker: <width>"`. The width is the rendered width of the item's prefix:
  - bullet: `1.25rem` (existing widget width)
  - task: `1.25rem` for `- ` plus the checkbox width `20px` (`calc(1.25rem + 20px)`). The `- ` gets a mark `cm-task-list-dash` styled `display: inline-block; width: 1.25rem` so the width is fixed.
  - ordered: `calc(<marker length>ch + 0.5em)`; the existing `cm-ordered-list-mark` gets `display: inline-block; min-width: var(--cm-list-marker)` (the following space is included in the replaced width by hiding it inside the mark's box, see below).
- **CSS for marker lines:** `padding-left: calc(<level padding> + var(--cm-list-marker)); text-indent: calc(-1 * var(--cm-list-marker))`.
- **CSS for continuation lines** (`cm-list-continuation`): the same `padding-left` without `text-indent`.

The space after an ordered marker and after the task checkbox is part of the prefix. For ordered items the space after `1.` is covered by a replace decoration so that the mark's fixed width alone defines the offset. For tasks the checkbox widget's margin already acts as the gap; the following space is replaced the same way.

Continuation lines are lines whose first non-space character lies inside a `ListItem` whose marker is on an earlier line. They use the level and marker width of that item, so their text lines up with the item text.

Alternative considered: measure the prefix in the DOM and set `text-indent` per line. Rejected, because it needs layout reads on every update and breaks CodeMirror's height estimates.

### 3. Tests

- **`Shift+Enter`:** unit tests on `EditorState`, like `tests/listEnter.test.ts`, plus one keymap-stack test proving it runs before `insertNewlineAndIndent`.
- **Rendering:** unit tests on `buildListDecorations` (already exported) checking classes, the `--cm-list-marker` value and the hidden ranges for bullets, tasks, ordered items and continuation lines.
- **Visual result:** checked manually.

## Risks / Trade-offs

- [Hidden leading spaces: the cursor skips them, so manually typed indentation spaces are not visible] -> Accepted; indentation is changed with `Tab`/`Shift-Tab`, and the level change is visible immediately. In the editor's raw source view the spaces stay visible.
- [Font-dependent `ch` width for numbers with a proportional font] -> `ch` is the width of `0`, which matches digits in most UI fonts; `min-width` keeps longer markers from overlapping.
- [Changed look of nested lists: they lose the extra space from leading spaces] -> Intended by the spec ("nesting level drives indentation"); nesting levels stay visually distinct through the level padding.
- [Blockquote lists keep the old rendering] -> Documented non-goal; can follow later.
