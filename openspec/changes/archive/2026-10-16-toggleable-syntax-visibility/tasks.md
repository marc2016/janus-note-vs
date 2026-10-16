# Tasks

## 1. Extension & Live Preview Decorations

- [x] 1.1 Define `SyntaxVisibilityMode` type (`'auto' | 'visible' | 'hidden'`) and configure a CodeMirror 6 Compartment in `src/webviews/markdown/extensions/livePreview.ts`
- [x] 1.2 Implement dynamic syntax decoration masking in `livePreview.ts` for heading markers (`# `) and inline delimiters (`**`, `*`, `~~`, `` ` ``) conditioned on the active mode and cursor range
- [x] 1.3 Add styling rules for `.cm-syntax-hidden` in `livePreview.ts` to cleanly conceal markers without breaking character offsets or cursor selection

## 2. Toolbar UI & State Integration

- [x] 2.1 Export required eye/visibility icons in `src/ui/icons.ts`
- [x] 2.2 Add the 3-way cycle toggle button to `MarkdownToolbar.tsx` displaying the current state icon, descriptive tooltip, and firing mode change callbacks
- [x] 2.3 Connect state in `MarkdownEditorApp.tsx`: reconfigure the CodeMirror compartment dynamically and persist the active mode in webview state

## 3. Verification & Build

- [x] 3.1 Run `npm run compile` and `npm run build` to verify clean TypeScript compilation and webview bundling
- [x] 3.2 Run `npm test` to verify all test suites continue to pass without regressions
