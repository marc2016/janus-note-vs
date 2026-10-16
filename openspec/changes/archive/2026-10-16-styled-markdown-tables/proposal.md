# Proposal

## Why

Markdown tables written with standard GitHub Flavored Markdown (GFM) pipe syntax (`| Header | ... |`) currently render in the Live Preview editor as unstyled plain text lines. Users require an interactive, visual table editing experience (similar to MDXEditor or Notion) where tables are rendered as full interactive HTML components with in-cell editing, row/column grip handles, adding/deleting/moving rows and columns, and auto-formatting, without breaking standard CommonMark document storage or zero-diff persistence.

## What Changes

- Integrate `codemirror-markdown-tables` via `src/webviews/markdown/extensions/styledTables.ts`.
- Render GFM pipe tables as rich, interactive HTML table components in the Live Preview editor:
  - Header and content rows rendered with visual grid cells and VS Code theme colors.
  - In-cell text editing directly inside cells without exposed pipes or raw delimiter hyphens.
  - Interactive handles and action menus for adding, inserting, moving, duplicating, and deleting rows and columns.
  - Smooth cell keyboard navigation (`Tab`, `Shift-Tab`, `Enter`, arrows) and cell selection.
- Ensure 100% standard GFM format on disk: document edits to table cells modify only the underlying Markdown file cleanly.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `markdown-editor`: Adds requirement for interactive visual GFM table components with in-cell editing, row/column manipulation, and standard GFM persistence.

## Impact

- **Webviews**: Adds `src/webviews/markdown/extensions/styledTables.ts`, registers it in `MarkdownEditorApp.tsx`.
- **Dependencies**: Adds `codemirror-markdown-tables`.
