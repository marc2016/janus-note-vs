# Tasks

## 1. Command

- [x] 1.1 Add `exitEmptyListItem` and `listEnterKeymap` in `src/webviews/markdown/lib/listIndentation.ts` as described in design.md decision 1 (nested: reuse `outdentListOrLines`; top level: remove marker, checkbox and trailing spaces, keep the quote prefix; otherwise return `false`); verify with `npm run compile`
- [x] 1.2 Add `tests/listEnter.test.ts` covering every scenario of the delta spec (nested bullet, task, ordered with renumbering, third level, top-level bullet and task, blockquote, item with text returns `false`, item with children returns `false`, selection returns `false`, undo in one step, no space-only lines); verify with `npx vitest run tests/listEnter.test.ts`

## 2. Editor integration

- [x] 2.1 Register `Prec.high(keymap.of(listEnterKeymap))` directly before `markdown(...)` in `MarkdownEditorApp.tsx`; verify with `npm run build`
- [x] 2.2 Add a test that runs `Enter` through the keymaps in editor order (list Enter keymap, then `markdown()`'s keymap) and checks that an empty nested item is moved up while an item with text still continues the list; verify with `npm test`

## 3. Verification

- [x] 3.1 Run `npm test` and `npm run build`; all tests pass
- [x] 3.2 Manual check in the Janus Markdown Editor: empty nested bullet, task and ordered item move up with `Enter`, an empty top-level item ends the list without a stray blank line, `Cmd+Z` restores it, `Enter` after a heading in today's daily note still adds the time, and slash command popups still take `Enter`
