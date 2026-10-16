# Proposal: CodeMirror 6 Live-Preview Markdown Editor (Obsidian Paradigm)

## Why

TipTap and AST-based rich text editors re-serialize entire documents upon saving, modifying untouched lines, injecting unwanted backslashes (`\`), reformatting blank lines, and causing noisy git diffs for minor edits. Users require a Markdown editor that preserves 100% of the raw document's exact characters and formatting trivia while still delivering a visual editing experience with a fixed formatting toolbar, in-place decorations (Obsidian-style Live Preview), and extensible slash commands (`/`).

## What Changes

- Replace the TipTap AST engine in `janus.markdownEditor` with a CodeMirror 6 text engine.
- Implement in-place live preview decorations:
  - Headings rendered in rich typography with `# ` markers hidden when cursor is outside the line.
  - Interactive task list checkboxes replacing `- [ ]` and `- [x]`, toggling directly in-place without touching other lines.
  - Inline marks (bold, italic, code) decorated with rich styles.
- Retain the fixed top formatting toolbar built with shadcn/ui and `@mdi/js` icons (Undo/Redo, Headings, Bold, Italic, Strikethrough, Code, Task List, Table, Blockquote).
- Introduce an extensible slash command popup (`/`) via `@codemirror/autocomplete` for fast keyboard insertion (`/tasks`, `/chart`, `/h1`, `/table`, `/callout`).
- Ensure 100% non-destructive editing: saving touches ONLY the modified character ranges, guaranteeing zero unwanted git diffs.

## Capabilities

### New Capabilities
- `markdown-editor`: In-place Live-Preview Markdown editor using CodeMirror 6 with live decorations, fixed toolbar, slash commands, and non-destructive persistence.

### Modified Capabilities
None.

## Impact

- **Webviews**: `src/webviews/markdown/MarkdownEditorApp.tsx` rebuilt on CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/autocomplete`).
- **Dependencies**: Adds CodeMirror 6 packages; removes or deprecates `@tiptap/*` dependencies.
- **Provider & Extension**: `MarkdownEditorProvider` continues serving `janus.markdownEditor` without changing VS Code extension manifests or commands.
