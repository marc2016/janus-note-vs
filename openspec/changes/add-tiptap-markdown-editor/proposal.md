# Proposal: TipTap Markdown WYSIWYG Editor for Janus Note

## Why

Janus Note pairs human-friendly Markdown notes with machine-operable companion files (`*.tasks.json`, `*.chart.json`). Currently, notes are edited solely in the raw VS Code text editor or plain markdown preview. Users desire an intuitive, Notion-style WYSIWYG editing experience with a fixed formatting toolbar while preserving 100% standard, portable CommonMark / GitHub Flavored Markdown (GFM) on disk without proprietary locks or alien syntax.

## What Changes

- Introduce a new Custom Text Editor `janus.markdownEditor` for `*.md` files powered by TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `tiptap-markdown`, task list extensions).
- Provide a pinned, fixed formatting toolbar built with shadcn/ui and `@mdi/js` icons (Undo/Redo, Headings H1–H3, Bold, Italic, Strikethrough, Code, Bullet/Numbered/Task Lists, Blockquote, Code Block, Horizontal Rule).
- Maintain 100% standard Markdown on disk (`.md`) via seamless bidirectional synchronization.
- Support instant split editing ("Quelltext bearbeiten" / beside column) with live round-tripping.
- Integrate theme adaptation for VS Code Light, Dark, and High Contrast themes.
- Add CodeLens shortcut (`$(edit) Rich Editor`) on Markdown notes to switch effortlessly into the WYSIWYG view.

## Capabilities

### New Capabilities
- `markdown-editor`: Interactive TipTap-powered WYSIWYG editor for `.md` files with fixed toolbar, GFM task list checkboxes, and bidirectional VS Code document synchronization.

### Modified Capabilities
None.

## Impact

- **UI & Webviews**: Adds `src/webviews/markdown/` React entry point and styles in `dist/webviews/markdown.js`.
- **VS Code Extension**: Registers `janus.markdownEditor` in `package.json` and `MarkdownEditorProvider` in `src/extension.ts`.
- **Dependencies**: Uses `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-placeholder`, and `tiptap-markdown`.
