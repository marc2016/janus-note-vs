# Tasks

## 1. Dependencies and CodeMirror Extensions

- [x] 1.1 Install CodeMirror 6 dependencies (`@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/lang-markdown`, `@codemirror/autocomplete`, `@codemirror/commands`) and verify package installation
- [x] 1.2 Implement Live Preview extension (`src/webviews/markdown/extensions/livePreview.ts`) applying line decorations to headings and concealing `# ` markers when cursor is outside the active line
- [x] 1.3 Implement interactive task checkbox extension (`src/webviews/markdown/extensions/taskCheckboxes.ts`) rendering `- [ ]` / `- [x]` as clickable widgets that dispatch single-character transactions
- [x] 1.4 Implement slash command autocomplete extension (`src/webviews/markdown/extensions/slashCommands.ts`) offering `/tasks`, `/h1`, `/table`, `/callout`, `/chart` completions

## 2. UI Components & Webview Integration

- [x] 2.1 Implement fixed formatting toolbar (`src/webviews/markdown/components/MarkdownToolbar.tsx`) with shadcn/ui buttons and `@mdi/js` icons dispatching CodeMirror transactions
- [x] 2.2 Rebuild `src/webviews/markdown/MarkdownEditorApp.tsx` with CodeMirror 6 view initialization, theme styling, and toolbar integration
- [x] 2.3 Wire two-way document synchronization between webview and VS Code host `MarkdownEditorProvider` without full AST re-serialization
- [x] 2.4 Clean up deprecated TipTap dependencies and legacy CSS

## 3. Verification & Zero-Diff Testing

- [x] 3.1 Verify in-place live preview rendering and active-line syntax reveal across headings, inline marks, and code blocks
- [x] 3.2 Verify slash command menu opens on typing `/` and replaces token with selected template on Enter
- [x] 3.3 Verify interactive task checkbox toggles in-place and leaves surrounding lines untouched
- [x] 3.4 Verify zero-diff persistence: modify a single sentence in a test markdown file, save, and verify `git diff` shows only the touched line
