# Tasks

## 1. Line-based reveal in auto mode

- [x] 1.1 In `buildDecorations` (`livePreview.ts`), compute the revealed lines from the main selection's head and anchor once, and replace the `isCursorInside` checks used for hiding wiki links, Markdown links, `StrongEmphasis`, `Emphasis`, `Strikethrough` and `InlineCode` with "start or end line is revealed"; keep `cm-link-editing` tied to the cursor inside the link. Verify with `npm run build`
- [x] 1.2 Headings: keep the line-based rule (hidden in `auto` outside the cursor line, `cm-heading-mark-active` on it); an always-visible dimmed marker was tried and rejected. Verify with `npm run build` and the unit tests in 2.1

## 2. Tests

- [x] 2.1 Update `tests/clickableLinks.test.ts`: auto-mode "cursor outside" cases put the cursor on another line; add cases for cursor on the same line outside the link (delimiters revealed), bold and inline code revealed by a cursor elsewhere on the line, and the heading marker hidden in `auto` mode only outside the cursor line. Verify with `npx vitest run tests/clickableLinks.test.ts`
- [x] 2.2 Extend `tests/cursorNavigation.test.ts` (headless Chrome): in `auto` mode, on `Ein **fetter** Satz mit [[Link]]` compare the x-coordinate of a fixed character before and after stepping with `cursorCharLeft`/`cursorCharRight` across the line. Verify the test fails before group 1 and passes after it
- [x] 2.3 Run `npm test` and `npm run build`; all tests pass

## 3. Manual check

- [x] 3.1 In a new note in `auto` mode, move with the arrow keys through the heading and through a line with bold text and a link, and press `Backspace` next to `**fett**`; check that the cursor no longer jumps within a line, the `# ` is hidden outside the cursor line, links stay clickable, and `visible`/`hidden` modes look as before
