# Proposal

## Why

Notes can contain Mermaid diagrams in ```` ```mermaid ```` blocks. The `/chart` slash command even inserts one, and the PDF export renders them. In the Janus Markdown Editor itself, these blocks only show as source code, so a note's diagrams are only visible after exporting it. Images became visible in the editor with `paste-images-in-editor`; diagrams should be too.

## What Changes

- The Janus Markdown Editor renders every ```` ```mermaid ```` block (outside other code) as a diagram, following the VS Code theme (light or dark).
- Each diagram has a toggle `Code` / `Diagramm`:
  - **Diagramm** (default): the code lines are collapsed and only the diagram is shown.
  - **Code**: the code is shown and editable, with the diagram below as a live preview that updates while typing.
- The toggle state is per block and lasts while the note is open; it is not written to the file.
- Moving the cursor into a collapsed block with the keyboard (arrow keys, search) switches that block to `Code`, so the user never edits hidden text.
- With syntax visibility set to always visible, all blocks start in `Code`.
- A diagram with a syntax error shows the Mermaid error message below the code instead of a diagram, and the block stays in `Code`.
- Mermaid is loaded only when a note contains a Mermaid block, so notes without diagrams open as fast as today.
- The Mermaid script ships with the extension (`dist/webviews/mermaid.min.js`). The PDF export uses the same file, so packaged installs no longer fall back to the CDN.

Non-goals (possible follow-ups): a global setting for the default view, remembering the toggle state across sessions, editing diagrams visually, other diagram languages (PlantUML, Graphviz), and rendering the separate diagram companions (`*.chart.json`) inside the note.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirement for rendering Mermaid blocks with a code/diagram toggle.

## Impact

- New webview extension `src/webviews/markdown/extensions/mermaidBlocks.ts` (block detection, widgets, toggle state, lazy Mermaid loading, render cache), registered in `MarkdownEditorApp.tsx`; styles in `globals.css`.
- `esbuild.js`: copies `node_modules/mermaid/dist/mermaid.min.js` to `dist/webviews/`.
- `src/editors/markdownEditorProvider.ts`: passes the Mermaid script URI to the webview.
- `src/services/pdfExportService.ts`: `findLocalMermaidScript` also finds the copy in `dist/webviews/`.
- No new dependencies (`mermaid` is already one) and no new settings.
