# Tasks

## 1. List Structure Helpers

- [x] 1.1 Create `src/webviews/markdown/lib/listStructure.ts` with syntax-tree helpers: find the `ListItem` starting on a line, its block range (including child items), previous sibling, parent, content column, and nesting depth (`getListDepthAt`). Verify with unit tests in `tests/listStructure.test.ts` covering `- `, `* `, `1. `, `10. `, `1) `, and `- [ ] ` markers, plus nested and mixed lists.

## 2. Indent / Outdent Commands

- [x] 2.1 Implement `indentListOrLines` / `outdentListOrLines` in `src/webviews/markdown/lib/listIndentation.ts`: nest under the previous sibling's content column, outdent to the parent's indentation, move child items along, use spaces only, and make the first item / top-level boundary a no-op that still returns `true`. Verify with unit tests in `tests/listIndentation.test.ts` for each `Tab Key Indentation` scenario on bullets, ordered lists, and task items.
- [x] 2.2 Add the plain-line fallback (`indentMore` / `indentLess` with a 2-space indent unit) for lines outside list items, including mixed selections. Verify with unit tests that `Tab` / `Shift-Tab` on plain text add/remove up to 2 spaces and never insert `\t`.
- [x] 2.3 Support multi-line and multi-range selections: shift each top-most touched list item once in a single transaction and map the selection. Verify with unit tests that a selection over 3 items indents all of them, keeps the selection on the same text, and is undone with a single undo step.
- [x] 2.4 Implement ordered-list renumbering as a separate helper applied within the same transaction (new sub-list starts at `1.`, joining an existing sub-list continues it, the remaining source and destination items are renumbered consecutively, the list start number and delimiter are preserved, and untouched lists stay unchanged). Verify with the renumbering scenarios in `tests/listIndentation.test.ts`.

## 3. Editor Integration

- [x] 3.1 Export `listIndentationKeymap` (`Tab`, `Shift-Tab`) and append it to the editor keymap in `src/webviews/markdown/MarkdownEditorApp.tsx`. Verify with a test that creates an `EditorView` with the editor's keymap stack and simulates `Tab` on a list item.
- [x] 3.2 Verify precedence: write tests (or, if the table widget cannot run in jsdom, a manual check in the Extension Development Host) showing that `Tab` / `Shift-Tab` inside a table cell still navigate cells, and that an open slash-command / link completion popup is not overridden. If the outer editor receives `Tab` inside a `Table` node, make the commands return `false` there.

## 4. Structural List Styling

- [x] 4.1 Update `src/webviews/markdown/extensions/styledLists.ts` to compute `cm-list-level-N` and the bullet widget level from `getListDepthAt` instead of `floor(indent / 2)`, keeping the cap at 6. Verify with tests that `1. A` / `   1. B` / `      1. C` render at levels 0/1/2 and `10. A` / `    - B` at levels 0/1, and that the existing bullet and task checkbox rendering is unchanged.

## 5. Verification

- [x] 5.1 Run `npm run compile && npm run build && npm test` and confirm zero type errors and all tests pass.
- [x] 5.2 Manually check in the Extension Development Host: nest/outdent bullet, ordered, and task lists with Tab/Shift-Tab, confirm `Esc` then `Tab` leaves the editor, and confirm that exported PDF output shows the same nesting as the editor.
