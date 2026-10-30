# Proposal

## Why

In notes with inline images or Mermaid diagrams, some lines cannot be clicked anymore, and `ArrowUp` jumps to the top of the note. CodeMirror maps clicks and vertical cursor movement through the heights it measured for each line. Image and diagram widgets grow after they were measured (the image loads, the diagram SVG replaces the loading text), and CodeMirror is never told to measure again, so every position below such a widget is off until something else triggers a re-measure.

Assumption: the problem occurs in notes with images or Mermaid diagrams, below those widgets. The manual check confirms this.

## What Changes

- Image and Mermaid widgets ask the editor to re-measure whenever their size changes: after an image loads or fails, after a diagram or error message is inserted, and on later size changes (window width, theme, wrapping).
- The widgets give CodeMirror a realistic height estimate before their content is ready, so the layout jumps less while loading.
- Block widgets, the framed Mermaid code lines and horizontal-rule lines (`---`) no longer use vertical margins, which CodeMirror does not include in its line heights; the spacing moves to padding.
- Clicking any line and moving with the arrow keys work in notes with images and diagrams, also right after opening them.

Non-goals: changing how images and diagrams look, lazy-loading off-screen images.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirement that cursor placement and navigation stay correct around widgets whose size changes after rendering.

## Impact

- `src/webviews/markdown/extensions/inlineImages.ts` and `mermaidBlocks.ts`: shared size observation, `estimatedHeight`.
- A small helper `src/webviews/markdown/lib/measureOnResize.ts`.
- `src/webviews/styles/globals.css`: margins of `.cm-mermaid`, `.cm-line.cm-mermaid-code-first` and `.cm-inline-image` become padding.
- No new settings or dependencies.
