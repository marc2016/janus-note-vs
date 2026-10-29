# Design

## Context

- `mermaid` (^12) is already a dependency. `DiagramViewApp.tsx` bundles it into `chart.js`, which is about 13 MB. `markdown.js` is about 2.4 MB, and `node_modules/mermaid/dist/mermaid.min.js` alone is about 5.5 MB.
- The PDF export loads `mermaid.min.js` by `<script>` from `node_modules` via `findLocalMermaidScript`, falling back to a CDN. `.vscodeignore` excludes `node_modules/**`, so packaged installs always use the CDN.
- The editor webview HTML has no Content-Security-Policy. `localResourceRoots` includes `dist`. The initial document is passed as JSON in `#initial-data`.
- `inlineImages.ts` (from `paste-images-in-editor`) shows the pattern for block widgets: a `StateField` providing `EditorView.decorations`, with a pure scanner from `markdownScan.ts`.
- `MarkdownEditorApp.tsx` already tracks the theme (`effectiveIsDark`, a `MutationObserver` on the body class) and the syntax visibility mode (`syntaxVisibilityFacet`).

## Goals / Non-Goals

**Goals:**
- Notes without Mermaid load no extra code.
- Typing in a Mermaid block does not flicker the diagram or block the editor.

**Non-Goals:**
- Sharing the renderer with `DiagramViewApp` (it keeps its own bundled Mermaid and settings).

## Decisions

### 1. Load Mermaid lazily from a shipped file

`esbuild.js` copies `node_modules/mermaid/dist/mermaid.min.js` to `dist/webviews/mermaid.min.js` after each build (also in watch mode). The provider adds `mermaidScriptUri` (`asWebviewUri` of that file) to `#initial-data`. A small loader in the webview appends a `<script src>` the first time a Mermaid block is rendered and resolves with `window.mermaid`; later calls reuse the same promise.

`findLocalMermaidScript` in the PDF export checks `dist/webviews/mermaid.min.js` (relative to the extension's `dist/`) first, so packaged installs export diagrams offline.

*Alternative considered:* `import('mermaid')` with esbuild code splitting. The webview build is `iife`, which does not support splitting; switching to `esm` would affect every webview.

### 2. Finding blocks

A pure `findFencedBlocks(text)` in `markdownScan.ts` returns `{ info, from, to, codeFrom, codeTo }` for every top-level fenced block, using the same fence rules as `findCodeRanges` (3+ backticks or tildes, closing fence of the same character and at least the same length). A Mermaid block is one whose info string's first word is `mermaid` (case-insensitive). Text inside another fenced block is never a block of its own, which covers the "Mermaid example inside a ```md block" scenario. An unclosed fence is ignored, so a block being typed is not rendered until it is closed.

### 3. State and decorations in one `StateField`

`mermaidBlocksField` holds the blocks and a `Map<blockFrom, 'code' | 'diagram'>` of explicit toggles, with keys mapped through document changes (`mapPos`), plus a `Set<blockFrom>` of blocks whose last render failed. The view of a block is: `code` if it has an error; else the explicit toggle; else `code` when `syntaxVisibilityFacet` is `visible`, otherwise `diagram`.

Decorations (block widgets must come from a `StateField`):
- `diagram` view: `Decoration.replace({ block: true, widget })` over the whole block, from the start of the opening fence line to the end of the closing fence line. The widget shows the diagram and a `Code` button.
- `code` view: `Decoration.widget({ block: true, side: 1 })` at the end of the closing fence line. It shows the preview and a `Diagramm` button. Line decorations (`cm-mermaid-code-line`, `cm-mermaid-code-first`) give the code lines side and top borders, so code and preview form one frame.

Effects: `toggleMermaidView(blockFrom)`, `setMermaidError({ blockFrom, error })` (dispatched by the widget after rendering), `setMermaidTheme(isDark)`.

**Keyboard entry:** in the field's `update`, when a transaction has a selection from a user event other than `select.pointer` (arrow keys, search, select-all) and the head lies within a block in `diagram` view, the block's toggle becomes `code`. Pointer clicks on the widget go through its button.

### 4. Rendering, cache and debounce

The widget stores `code`, `isDark`, `view` and `blockFrom`; `eq` compares the first three, so blocks are not re-rendered while other parts of the note change. `toDOM` looks up a module-level cache (`Map` keyed by theme + code → SVG string). On a hit, it inserts the SVG at once. On a miss, it shows the last SVG of that block (if any) dimmed, waits 300 ms (cancelled in `destroy`), then calls `mermaid.render(id, code)`, stores the result and inserts it. On failure it shows the error message and dispatches `setMermaidError`. A successful render after an error dispatches the error's removal.

Mermaid is initialized once per theme with `startOnLoad: false`, `securityLevel: 'strict'` and `theme: isDark ? 'dark' : 'default'`. `strict` keeps notes from running scripts or click handlers through diagram definitions. `DiagramViewApp` uses `loose`, but those diagrams are separate companion files.

The renderer (loader plus `mermaid.render`) is injected through a facet, so tests can supply a fake without a DOM or Mermaid.

### 5. Theme

`MarkdownEditorApp` dispatches `setMermaidTheme(effectiveIsDark)` initially and whenever the theme changes. The field stores it, and all widgets get new `isDark` values, so the cache key changes and diagrams re-render in the new theme.

## Risks / Trade-offs

- [Mermaid adds about 5.5 MB to the extension package] → It is already a dependency and is now shipped once in `dist/`; it is only loaded by notes with diagrams.
- [Rendering large diagrams is slow] → Debounce and cache keep it to one render per change; rendering is async and does not block typing.
- [Block keys are positions] → Mapped through every change. If a block is deleted and retyped, its toggle starts fresh, which is acceptable.
- [Mermaid's global `initialize`] → Only this webview uses the loaded script, so per-theme initialization does not affect other webviews.
