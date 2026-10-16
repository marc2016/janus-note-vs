# Design

## Context

See `proposal.md` for background and motivation.

The editor is built on CodeMirror 6 with an in-place live preview architecture. Documents are saved as standard GFM markdown text directly to the VS Code TextDocument.

Markdown tables conform to GitHub Flavored Markdown (GFM) pipe table syntax:
- Header row with pipe-separated columns (`| Header 1 | Header 2 |`)
- Delimiter row specifying alignment (`| :--- | ---: |`)
- Zero or more content rows (`| Value 1 | Value 2 |`)

Users require an interactive, WYSIWYG-style table component (like MDXEditor / Notion) rather than monospaced plain text line styling.

## Goals / Non-Goals

**Goals:**
- Render GFM tables as rich, interactive HTML table components via `codemirror-markdown-tables`.
- Provide in-cell editing without visible pipe characters or raw delimiter rows.
- Provide drag handles and action menus for adding, inserting, moving, duplicating, and deleting rows/columns.
- Adapt table colors dynamically to VS Code's active dark and light themes.
- Maintain 100% standard GFM format on disk.

**Non-Goals:**
- Proprietary multi-line cell structures that break standard CommonMark/GFM specification.

## Decisions

### 1. Integrating `codemirror-markdown-tables`
- **Decision**: Integrate `codemirror-markdown-tables` (`ckant/codemirror-markdown-tables`) inside `src/webviews/markdown/extensions/styledTables.ts`.
- **Rationale**: `codemirror-markdown-tables` transforms markdown tables into interactive HTML components with in-cell editing, touch/drag controls for rows and columns, keyboard navigation (`Tab`, `Enter`, arrows), copy/paste as Markdown tables, auto-formatting, and full integration with CodeMirror's undo history.

### 2. VS Code Theme Integration
- **Decision**: Configure `TableTheme.githubLight` and `TableTheme.githubDark` using CSS variables mapped to VS Code's editor theme (`--vscode-editor-background`, `--vscode-editorWidget-border`, `--vscode-editor-inactiveSelectionBackground`, `--vscode-menu-*`).
- **Rationale**: Ensures the interactive tables seamlessly blend into any VS Code theme (light, dark, high contrast).

### 3. Safe Fallback in Headless Environments
- **Decision**: In `styledTables.ts`, guard against non-DOM environments (`typeof window === 'undefined'`) to ensure that headless Vitest unit tests can run safely without ReferenceError.

## Risks / Trade-offs

- **[Risk]** Third-party package maintenance and type definitions under NodeNext module resolution.
  → **Mitigation**: Provided comprehensive TypeScript declarations in `src/types/codemirror-markdown-tables.d.ts` and automated build validation via `npm run compile` and `npm run build`.
