# Design

## Context

- `livePreviewPlugin` rebuilds all decorations through `buildDecorations` on every `selectionSet`, `docChanged` or viewport change.
- Since the fix in `2026-10-30-fix-cursor-over-hidden-syntax`, hidden syntax is a zero-width `Decoration.replace` (`hiddenSyntax`). Revealing it inserts visible characters and shifts the rest of the line.
- In `auto` mode the reveal condition differs per element:
  - Headings: cursor head or anchor on the line → `cm-heading-mark` (+ `-active`), otherwise `hiddenSyntax`.
  - Wiki links, Markdown links, `StrongEmphasis`, `Emphasis`, `Strikethrough`, `InlineCode`: cursor head or anchor inside `[from, to]` of the element.
- CodeMirror computes the target of a cursor motion using the decorations of the *current* state. The plugin then rebuilds the decorations for the new selection. When the reveal state changes in between, the layout shifts after the cursor has moved, and the user sees a jump (see proposal.md - Why).
- Image captions, sorted-link cards and Mermaid blocks have their own extensions and already switch per line or by their own rules. They are not changed.

## Goals / Non-Goals

**Goals:**
- In `auto` mode, the reveal state of a line depends only on whether the cursor is on that line.

**Non-Goals:**
- `hidden` mode: horizontal movement and deletion next to concealed syntax stay as they are. Backspace at the visible start of a heading in `hidden` mode can still remove the space of `# ` (out of scope, it was not reported).
- Multiple selections: only the main selection counts, as today.
- Changing styles of revealed syntax beyond reusing the existing heading mark styles.

## Decisions

**1. One `revealedLines` set per build instead of per-element checks.**
At the start of `buildDecorations`, compute the line numbers of `selection.main.head` and `selection.main.anchor`. A small helper `isLineRevealed(pos)` (line of `pos` is in the set) replaces every `isCursorInside` check in `auto` mode. For elements that span a line break (possible for `Emphasis`/`StrongEmphasis` over a soft break), the element is revealed when its start line or end line is revealed. The `cm-link-editing` class stays tied to the cursor being inside the link, so the editing cursor style is unchanged.
- *Alternative:* reveal all lines between anchor and head for a multi-line selection. Rejected: shift-selecting downward would reveal and shift every line in between, which is the same kind of jump this change removes.

**2. Headings keep their line-based rule.**
Heading markers were already revealed per line, so they stay as they are: hidden outside the cursor line in `auto` mode, `cm-heading-mark-active` on it.
- *Alternative (tried, rejected by the user):* keep `# ` always visible but dimmed in `auto` mode, so the heading text never shifts. It made `auto` look like `visible` for headings; a single shift when entering a heading line is preferred.

**3. No change to the update trigger.**
The plugin still rebuilds on `selectionSet`. Because the reveal state now only changes when the cursor changes lines, rebuilding within a line produces the same decorations, and CodeMirror does not touch the line's DOM.

**4. Tests.**
- Unit tests (`clickableLinks.test.ts`, via `buildDecorations` and `collectDecorations`): auto-mode "cursor outside" cases put the cursor on another line. New cases: cursor on the same line but outside the link → delimiters revealed; bold and inline code revealed by a cursor anywhere on the line; heading marker hidden in `auto` only outside the cursor line.
- Browser test (`cursorNavigation.test.ts`, existing headless Chrome harness): for `auto` mode, record `view.coordsAtPos` of a fixed character on the line before and after a series of `cursorCharLeft`/`cursorCharRight` moves; the x-coordinates must be equal. The existing heading scenario still checks that `ArrowUp` lands in the heading line.

## Risks / Trade-offs

- [Links and formatting on the cursor line now show raw syntax even when the cursor is far from them] → Intended (line-based reveal, as in other Markdown editors). Clicking a link still works, because the `cm-link-text` mark stays on the label in both states.
- [Moving to another line still reveals that line's syntax and shifts its text once, also for headings] → Accepted trade-off; it happens once per line change instead of at every element boundary.
