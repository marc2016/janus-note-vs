# Proposal

## Why

In the Markdown editor's Live Preview view, raw markdown syntax markers (such as `### ` for headings and `**` for bold text) are currently either displayed permanently or only partially dimmed. Users want a clean reading and writing experience where markdown markers can be hidden, revealed dynamically on cursor focus, or toggled between three dedicated modes: Auto (revealed only when cursor is in the line/token), Visible (always shown for precise raw editing), and Hidden (always concealed for a distraction-free WYSIWYG reading experience).

## What Changes

- Add a 3-way cycle toggle button to the `MarkdownToolbar` (e.g. rotating through `Auto (Focus)`, `Visible (Raw)`, and `Hidden (Clean)`).
- Implement dynamic CodeMirror 6 live preview decorations in `src/webviews/markdown/extensions/livePreview.ts` that respond to the active visibility mode:
  - **Auto**: Hides markers (`### `, `**`, `*`, `~~`, `` ` ``) when the cursor is outside the target line/word range, and reveals them seamlessly when the cursor is placed within.
  - **Visible**: Renders all raw Markdown syntax markers permanently.
  - **Hidden**: Conceals raw Markdown syntax markers regardless of cursor position.
- Persist the selected visibility mode in the webview state so that user preferences are retained across tab switches and document reloads.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `markdown-editor`: Extends the Markdown editor requirements with a 3-way syntax visibility mode control (Auto, Visible, Hidden) and dynamic cursor-sensitive syntax hiding/revealing in the live preview.

## Impact

- **Webviews**: Updates `MarkdownToolbar.tsx` with the 3-way toggle button and tooltip states, and enhances `livePreview.ts` / `MarkdownEditorApp.tsx` with mode compartments and state persistence.
- **Dependencies**: No external dependencies added; utilizes existing CodeMirror 6 compartments and `@mdi/js` icons.
