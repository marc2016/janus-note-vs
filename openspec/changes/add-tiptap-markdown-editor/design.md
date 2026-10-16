# Technical Design: TipTap Markdown WYSIWYG Editor

## Context

Janus Note features companion file editors for Kanban task boards (`*.tasks.json`) and D3/Mermaid charts (`*.chart.json`). To provide an integrated editing experience for notes, a custom text editor for `*.md` files is introduced. See [proposal.md](file:///Users/marclammers/sources/janus-note-vs/openspec/changes/add-tiptap-markdown-editor/proposal.md).

## Goals / Non-Goals

**Goals:**
- Provide a Notion-style visual editor for markdown notes using TipTap and shadcn/ui.
- Maintain transparent, portable Markdown text files on disk without alien JSX wrappers or binary state.
- Ensure bidirectional synchronization between the visual webview and VS Code text documents.
- Keep the editor fast, lightweight, and fully offline-capable (bundled via esbuild without external CDNs).

**Non-Goals:**
- Replacing the VS Code native text editor by default (`priority: "option"` is used so users choose their editing mode).
- Executing arbitrary JavaScript expressions or complex MDX component trees within notes.

## Decisions

### 1. TipTap & ProseMirror over @mdxeditor/editor
- **Rationale**: TipTap is completely headless, allowing full styling integration with Tailwind CSS v4 and the existing shadcn/ui design tokens. ProseMirror provides rock-solid cursor management and typing stability inside VS Code webviews.
- **Alternatives Considered**: `@mdxeditor/editor` was evaluated; while it natively handles MDX ASTs, it introduces heavy Radix stylesheets that conflict with VS Code themes and is prone to focus bugs in sandboxed webviews.

### 2. Fixed Top Toolbar with shadcn/ui and MDI Icons
- **Rationale**: A pinned top toolbar ensures all formatting commands (Headings, Lists, Checkboxes, Marks) are always visible and discoverable.
- **Alternatives Considered**: Floating-only bubble menu. Rejected because users often prefer direct, visible access to block transforms and task list creations.

### 3. Bidirectional Debounced Sync
- **Rationale**: Typing updates in the webview trigger debounced `updateContent` messages (250ms), applying `vscode.WorkspaceEdit` to the document. External changes to the document (e.g. from git or split editor) are sent to the webview and update TipTap only when text differs, preventing feedback loops.

### 4. Custom Editor Priority "option"
- **Rationale**: Setting `priority: "option"` in `package.json` allows users to open notes in the visual editor via CodeLens (`$(edit) Rich Editor`) or "Reopen with...", while keeping the native VS Code editor default intact.

## Risks / Trade-offs

- **[Risk] Sync feedback loops between TipTap and VS Code TextDocument**:
  - *Mitigation*: Track local editing state (`isUpdatingFromHostRef`) and compare markdown serialization before calling `editor.commands.setContent()`.
- **[Risk] Markdown serialization formatting differences (whitespace/newlines)**:
  - *Mitigation*: Use `tiptap-markdown` with strict CommonMark/GFM rules and preserve paragraph line breaks cleanly.
