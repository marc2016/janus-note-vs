# Tasks

## 1. Replace hidden syntax marks

- [x] 1.1 Add and export `hiddenSyntax = Decoration.replace({})` in `livePreview.ts`, use it for heading markers when hidden (keep the `cm-heading-mark` marks when visible) and remove the `.cm-syntax-hidden` theme rule; verify with `npm run build`
- [x] 1.2 Use `hiddenSyntax` for the hidden parts of wiki links, Markdown links and the bold, italic, strikethrough and inline code delimiters, so no `cm-syntax-hidden` class is left (`grep -rn cm-syntax-hidden src` is empty)
- [x] 1.3 Adjust `tests/clickableLinks.test.ts` to detect hidden ranges as `hiddenSyntax` instead of the class; verify with `npx vitest run tests/clickableLinks.test.ts`

## 2. Cursor test with layout

- [x] 2.1 Add `tests/cursorNavigation.test.ts`: bundle an entry with esbuild, run it in headless Chrome, check that `ArrowUp`/`ArrowDown` reach the line starting with a heading, `**Fett**`, `*kursiv*`, `` `code` ``, a wiki link and a Markdown link in `auto` and `hidden` mode; skipped without Chrome. Verify it fails with the old `display: none` code and passes after group 1
- [x] 2.2 Run `npm test` and `npm run build`; all tests pass

## 3. Manual check

- [x] 3.1 In the editor, press `ArrowUp` from the text below a heading and below lines starting with bold text or a link, in `auto` and `hidden` mode; check that the look of headings, formatting and links is unchanged and links stay clickable
