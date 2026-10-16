# Tasks

## 1. Core Word-Boundary Formatting Logic

- [x] 1.1 Extract and implement `toggleInlineFormatting(view: EditorView, marker: string): boolean` in `src/webviews/markdown/lib/formatting.ts` with word-boundary resolution (`state.wordAt`), node unwrap, and empty marker fallback
- [x] 1.2 Update `src/webviews/markdown/components/MarkdownToolbar.tsx` to delegate all inline mark actions (Bold, Italic, Strikethrough, Code) to the shared `toggleInlineFormatting` function

## 2. Editor Keyboard Shortcuts

- [x] 2.1 Add formatting key bindings (`Mod-b` for Bold, `Mod-i` for Italic, `Mod-e` for Code) to the CodeMirror keymap extension in `src/webviews/markdown/MarkdownEditorApp.tsx` and verify dispatch

## 3. Automated Tests & Verification

- [x] 3.1 Add comprehensive unit tests in `tests/markdownEditor.test.ts` testing word-boundary wrapping, formatted node stripping, empty whitespace fallback, and selection preservation
- [x] 3.2 Run test suite via `npm test` and verify clean compilation via `npm run compile`
