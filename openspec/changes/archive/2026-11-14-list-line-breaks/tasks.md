# Tasks

## 1. Shift+Enter

- [x] 1.1 Add `insertListLineBreak` in `src/webviews/markdown/lib/listIndentation.ts` and bind it as `shift` of the Enter binding in `listEnterKeymap` (design.md decision 1); verify with `npm run compile`
- [x] 1.2 Add tests to `tests/listEnter.test.ts` for every scenario of "Line Breaks in List Items" (bullet, ordered with wide marker, nested task, splitting text without leftover spaces, continuation line, blockquote, outside lists returns `false`, cursor before the marker returns `false`, selection replaced, undo in one step) and a keymap-stack test showing `Shift-Enter` runs before `insertNewlineAndIndent`; verify with `npx vitest run tests/listEnter.test.ts`
- [x] 1.3 Add `insertItemFromContinuation` (Enter on a continuation line or on the indented empty line after `Shift+Enter` starts a new item of the same list, renumbering ordered lists) and chain it after `exitEmptyListItem` in the Enter binding; add tests for the new spec scenarios and the keymap stack; verify with `npx vitest run tests/listEnter.test.ts`

## 2. Rendering

- [x] 2.1 `styledLists.ts`: hide leading spaces of list marker lines (outside blockquotes), set `--cm-list-marker` per marker line (bullet, task with fixed-width dash mark, ordered with inline-block mark and hidden following space), and add the hanging indent CSS (design.md decision 2); verify with `npm run build`
- [x] 2.2 `styledLists.ts`: decorate continuation lines of list items with `cm-list-continuation`, the item's level and marker width, and hidden leading spaces; verify with `npm run build`
- [x] 2.3 Add `tests/styledLists.test.ts` for `buildListDecorations`: classes, `--cm-list-marker` values and hidden ranges for a bullet, a task, `1.` and `10.` items, a continuation line, a nested continuation line, and that blockquote lists are left as before; verify with `npx vitest run tests/styledLists.test.ts`

## 3. Verification

- [x] 3.1 Run `npm test` and `npm run build`; all tests pass
- [x] 3.2 Manual check in the Janus Markdown Editor: long bullet, task and `10.` items wrap below their text; `Shift+Enter` in a list item starts an indented line whose text lines up with the item text, also at the second level; nested lists still show distinct levels; `Enter`, `Tab`/`Shift-Tab` and task checkboxes behave as before; the PDF export shows the manual line break
