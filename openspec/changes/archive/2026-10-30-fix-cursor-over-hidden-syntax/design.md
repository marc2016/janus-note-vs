# Design

## Context

`livePreviewPlugin` in `livePreview.ts` builds its decorations on every update. For hidden syntax it adds mark decorations with the class `cm-syntax-hidden`, which the base theme styles as `display: none`:

- heading markers (`## `), as part of the `cm-heading-mark` mark
- `[[`, `|`-prefix and `]]` of wiki links, `[` and `](url)` of Markdown links
- the delimiters of `StrongEmphasis`, `Emphasis`, `Strikethrough` and `InlineCode` (class `cm-inline-mark cm-syntax-hidden`)

The reveal logic (cursor on the heading line, cursor inside the element, the three visibility modes) only decides whether these marks are hidden; it does not need to change. See proposal.md for the bug.

A headless Chrome check in this exploration showed: with `display: none` at the start of a line, `cursorLineUp` skips that line in every case; with `Decoration.replace` or with only reduced opacity it lands in the line. The heading paddings play no role.

## Goals / Non-Goals

**Goals:**
- Hidden syntax no longer leaves document text without a place on screen.
- A regression test that runs CodeMirror with real layout.

**Non-Goals:**
- Changing reveal rules or styling of visible syntax markers.
- Making the hidden ranges atomic for horizontal cursor movement beyond what replace decorations already do.

## Decisions

- **One shared replace decoration.** `const hiddenSyntax = Decoration.replace({})`, exported for tests, replaces every `Decoration.mark({ class: '...cm-syntax-hidden' })`. For headings the plugin pushes `hiddenSyntax` when the marker is hidden and keeps the `cm-heading-mark` / `cm-heading-mark-active` mark when it is shown. The `.cm-syntax-hidden` theme rule is removed.
  - Alternative: hide with `font-size: 0` or `opacity: 0` marks. Rejected: the text keeps a (tiny or full) width, which shifts layout or still confuses CodeMirror's coordinate mapping; replace is what CodeMirror recommends for concealed text.
  - Alternative: a custom `ArrowUp` keybinding. Rejected: only hides the symptom; clicks and `ArrowDown` edge cases would stay inconsistent.
- **Decoration order.** Replace and mark decorations go into the same `RangeSet` builder, which already sorts with `Decoration.set(builder, true)`. Replace ranges never overlap the `cm-link-text` ranges (the link text is outside the hidden parts), so the clickable link spans stay intact.
- **Browser test inside vitest.** `tests/cursorNavigation.test.ts` bundles a small entry (`markdown()`, `livePreview(mode)`, `drawSelection()`, `EditorView.lineWrapping`) with esbuild into a temp dir, loads it in Google Chrome with `--headless=new --dump-dom`, and reads the results from a `<pre>` element. The entry runs `cursorLineUp` / `cursorLineDown` for the scenario lines in `auto` and `hidden` mode. The test uses `it.skipIf` when the Chrome binary from `scripts/generate-screenshots.js` (`/Applications/Google Chrome.app/...`) is missing, so `npm test` still runs elsewhere.
  - Alternative: Playwright or vitest browser mode. Rejected: new dependencies for one test.
- **Unit tests** in `tests/clickableLinks.test.ts` detect hidden ranges by `value === hiddenSyntax` (via the `collectDecorations` helper adding a `hidden` flag) instead of `className === 'cm-syntax-hidden'`.

## Risks / Trade-offs

- [Horizontal arrows jump over a replaced range in one step] → In `auto` mode the element is revealed as soon as the cursor touches its boundary, so the user sees the same as today. In `hidden` mode the cursor can no longer stop between `*` characters; that is the intended "clean" behavior.
- [Browser test is slow or flaky] → One Chrome start for all cases (about 1–3 s); a generous timeout; skipped without Chrome.
- [Other code relies on the class `cm-syntax-hidden`] → Only `livePreview.ts` and `clickableLinks.test.ts` use it (checked with grep).
