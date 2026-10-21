# Tasks

## 1. Live Preview Link Parsing & Mode-Aware Decorations

- [x] 1.1 Implement link matching (`[[...]]` and `[...](...)`) in `src/webviews/markdown/extensions/livePreview.ts`, emitting mark decorations with `cm-link-text` and data attributes, and verify with unit tests.
- [x] 1.2 Implement mode-dependent syntax concealing for link delimiters (`[[`, `]]`, `[`, `](...)`) in `livePreview.ts` respecting `auto`, `visible`, and `hidden` modes, and verify with unit tests.

## 2. Webview Direct Click Dispatch & Editor Integration

- [x] 2.1 Add direct link click event listener in `src/webviews/markdown/MarkdownEditorApp.tsx` that dispatches `openLink` messages to the extension host, and verify event dispatch.
- [x] 2.2 Update link CSS styling in `src/webviews/markdown/extensions/livePreview.ts` for link color, cursor pointer, and hover effects, and verify compilation.

## 3. Extension Host Navigation & Missing Note Dialog

- [x] 3.1 Update `MarkdownEditorProvider.ts` to handle raw note targets and external URLs, opening existing notes/external browser, and verify with unit tests.
- [x] 3.2 Implement missing-note confirmation dialog in `MarkdownEditorProvider.ts` offering to create and open not-yet-existing notes, and verify with unit tests.

## 4. Verification & Integration Testing

- [x] 4.1 Run full build and test suite (`npm run compile` and `npm test`) to verify all existing and new tests pass with zero regressions.
