# Proposal

## Why

In `auto` syntax visibility mode the cursor appears to jump while the user navigates with the arrow keys or deletes text, especially in new notes, which always start with a `# Title` heading. The live preview hides and reveals the syntax of each element (heading marker, `**`, `*`, `~~`, `` ` ``, link delimiters) as soon as the cursor touches it or leaves it. Since hidden syntax is a zero-width replace decoration, every reveal or conceal shifts the text around the cursor, so the cursor is suddenly shown somewhere else.

## What Changes

- In `auto` mode, syntax is revealed **per line** instead of per element: while the cursor (head or anchor of the main selection) is on a line, all hidden syntax of that line is shown (inline formatting markers, wiki link and Markdown link delimiters). On all other lines it stays hidden as before. Moving the cursor within a line no longer changes the layout.
- Heading markers (`# ` to `###### `) keep their current rule: hidden outside the cursor line, shown on it. Entering a heading line still shifts its text once.
- `visible` and `hidden` modes do not change.
- A browser regression test checks that the text of a line keeps its horizontal position while the cursor moves within that line.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `markdown-editor`: The reveal rules of `auto` mode change from per element to per line. This affects the requirements *Non-destructive In-Place Live Preview*, *Configurable Markdown Syntax Visibility Modes* and *Interactive Clickable Links in Live Preview*. It adds a requirement for a stable layout while the cursor moves within a line in `auto` mode.

## Impact

- `src/webviews/markdown/extensions/livePreview.ts`: `buildDecorations` reveal conditions (wiki links, Markdown links, `StrongEmphasis`, `Emphasis`, `Strikethrough`, `InlineCode`).
- Tests: `tests/clickableLinks.test.ts` (auto mode cases with the cursor on the same line), `tests/cursorNavigation.test.ts` (new layout stability check).
- Not affected: document synchronization, saving, image captions, sorted-link cards and Mermaid blocks (they already reveal per line or have their own rules).
