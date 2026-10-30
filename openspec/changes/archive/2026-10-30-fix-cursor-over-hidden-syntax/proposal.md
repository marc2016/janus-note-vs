# Proposal

## Why

In the Janus Markdown Editor, `ArrowUp` skips every line that starts with hidden Markdown syntax: a heading (`## `), bold, italic or code markers, or a wiki or Markdown link. The cursor lands on the line above, and only `ArrowDown` reaches the skipped line. The live preview hides these characters with a CSS class (`display: none`). CodeMirror does not support text without a place on screen, so its vertical cursor movement computes a wrong position at the start of such a line.

A headless Chrome check with the real `livePreview` code reproduces this for every heading level and column in `auto` mode. The same check with `## ` replaced through `Decoration.replace` works. Lines with hidden syntax in the middle and `ArrowDown` are not affected.

## What Changes

- The live preview hides Markdown syntax with CodeMirror replace decorations instead of the CSS class `cm-syntax-hidden`. This covers heading markers, bold, italic, strikethrough and inline code markers, and the hidden parts of wiki links and Markdown links (all 15 places in `livePreview.ts`).
- The look stays the same. The syntax visibility modes (`auto`, `visible`, `hidden`) and the reveal when the cursor is on the line or inside the element stay unchanged. Clicking links stays unchanged.
- `ArrowUp` and `ArrowDown` move to the adjacent line, also when that line starts with hidden syntax.
- A browser-based cursor test covers this, because the existing tests have no layout.

Non-goals: changing which syntax is hidden or when it is revealed, and the hidden syntax in other extensions (tables, task checkboxes, lists, images and Mermaid blocks already use replace decorations or widgets).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirement that vertical cursor movement never skips a line because of hidden Markdown syntax.

## Impact

- `src/webviews/markdown/extensions/livePreview.ts`: one shared replace decoration for hidden syntax. The `.cm-syntax-hidden` theme rule goes away.
- `tests/clickableLinks.test.ts`: the 10 checks for the class `cm-syntax-hidden` check the replace decoration instead.
- New browser test that bundles the editor extensions with esbuild and runs them in the installed Google Chrome. It is skipped when Chrome is not found.
- No new settings or dependencies.
