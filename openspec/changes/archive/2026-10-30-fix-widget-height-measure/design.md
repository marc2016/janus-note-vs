# Design

## Context

- `ImageWidget` (`inlineImages.ts`) renders an `<img>` that loads asynchronously; on `error` it swaps in a hint. `MermaidWidget` (`mermaidBlocks.ts`) shows a loading text, then sets the SVG or an error after an async render.
- CodeMirror measures widget heights when it draws them. It ignores DOM mutations inside widgets and does not notice image loads, so a widget that grows later leaves CodeMirror's height map stale. Clicks (`posAtCoords`) and vertical motion (`moveVertically`) then use wrong line positions. The documented remedy is to call `view.requestMeasure()` when a widget changes size, and to provide `estimatedHeight`.

## Goals / Non-Goals

**Goals:**
- One mechanism for every widget whose size changes after `toDOM`.

**Non-Goals:**
- Reworking how widgets render.

## Decisions

### 1. `measureOnResize(dom, view)`

A helper attaches a `ResizeObserver` to the widget's root element and calls `view.requestMeasure()` on every observed size change (coalesced to once per animation frame). It returns a disposer that the widget calls in `destroy(dom)`; the observer is kept on the element (a `WeakMap` from element to disposer) since `destroy` receives the DOM, not the widget's state. The `ResizeObserver` covers all cases at once: image load, error hint, SVG insertion, theme and width changes.

Without `ResizeObserver` (not the case in VS Code, but in tests), the helper does nothing.

*Alternative considered:* calling `requestMeasure()` only in the image `load`/`error` handlers and after setting the SVG. That misses later size changes (width, theme) and is easy to forget in new widgets.

### 2. `estimatedHeight`

- `ImageWidget`: 200 px for loadable images, 24 px for the hint.
- `MermaidWidget`: 220 px in diagram view, 180 px for the preview.

Estimates only reduce jumps before the first measurement; correctness comes from re-measuring.

### 3. No vertical margins on block widgets

CodeMirror's documentation states that block decorations must not have vertical margins, because the height map does not include them. `.cm-mermaid` (`margin: 6px 0 10px`) and `.cm-line.cm-mermaid-code-first` (`margin-top: 6px`) violate this. The spacing moves to padding on an outer wrapper (`.cm-mermaid-outer` with `padding: 6px 0 10px` around the framed box) and to `padding-top` on the first code line. `.cm-inline-image` already uses padding only.

The same rule applies to editor lines: `.cm-line.cm-hr` (horizontal rules, `livePreview.ts`) had `margin: 0.5rem 0`. It now uses vertical padding and draws the rule as a centered 1 px background line, so it looks the same. This also explains reports of unreachable lines in notes without images or diagrams.

### 4. Both widgets use `toDOM(view)`

`ImageWidget.toDOM` currently takes no view; it gets the `EditorView` parameter CodeMirror already passes.

## Risks / Trade-offs

- [Many widgets in a note trigger many measures] → `requestMeasure` is cheap and coalesced by CodeMirror; observer callbacks are batched per frame.
- [Cause is different] → The manual check verifies clicking and arrow keys below an image and a diagram; if lines without nearby widgets are also affected, the investigation continues before archiving.
