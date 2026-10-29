# Tasks

## 1. Foundation

- [x] 1.1 Add `findFencedBlocks(text)` to `src/services/markdownScan.ts` (top-level blocks only, fence rules as in `findCodeRanges`, unclosed fences ignored); verify with unit tests for a `mermaid` block, a Mermaid example inside a ```` ```md ```` block, tilde fences, an unclosed fence, and that `tests/linkOccurrences.test.ts` still passes
- [x] 1.2 Copy `mermaid.min.js` to `dist/webviews/` in `esbuild.js` (build and watch), add `mermaidScriptUri` to the editor's `#initial-data`, and let `findLocalMermaidScript` prefer the copy in `dist/webviews/`; verify with a test of the webview HTML and of `findLocalMermaidScript`, and that `npm run build` produces the file

## 2. Mermaid blocks in the editor

- [x] 2.1 Add `src/webviews/markdown/extensions/mermaidBlocks.ts` with `mermaidBlocksField` (blocks, toggle map mapped through changes, error set, theme, syntax-mode default, keyboard entry switching to `Code`) and the replace/widget decorations; verify with tests for "Diagram instead of code", "Keyboard navigation into a collapsed block", "Toggle is not saved" (fresh state starts in `Diagramm`), "Other code blocks", the `visible` mode default, and that the toggle never changes the document
- [x] 2.2 Add the widgets and the renderer: lazy script loader, per-theme `initialize` with `securityLevel: 'strict'`, SVG cache, 300 ms debounce with the previous SVG shown meanwhile, error display dispatching `setMermaidError`, and `Code`/`Diagramm` buttons; inject the renderer through a facet and verify with a fake renderer that a syntax error switches the block to `Code` ("Syntax error") and that a cached diagram is not rendered twice
- [x] 2.3 Register the extension in `MarkdownEditorApp.tsx`, dispatch `setMermaidTheme` on load and theme changes, and add styles in `globals.css`; verify `npm run compile` and that the editor loads without errors

## 3. Wrap-up

- [x] 3.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 3.2 Manually check: `project-plan.md` with a `/chart` block shows the diagram; toggle to `Code`, edit `A-->B` to `A-->C` and watch the preview; arrow into a collapsed block; introduce a syntax error; switch the VS Code theme; open a note without Mermaid and confirm `mermaid.min.js` is not loaded; export a note with a diagram to PDF
