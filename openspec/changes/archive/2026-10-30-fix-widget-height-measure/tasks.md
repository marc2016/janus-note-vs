# Tasks

## 1. Re-measuring

- [x] 1.1 Add `src/webviews/markdown/lib/measureOnResize.ts` (`ResizeObserver` per element, `requestMeasure` coalesced per frame, disposer kept per element, no-op without `ResizeObserver`); verify with unit tests using a fake `ResizeObserver` that a size change requests one measure and that disposing disconnects
- [x] 1.2 Use it in `ImageWidget` and `MermaidWidget` (`toDOM(view)`, `destroy(dom)`) and add `estimatedHeight`; verify with tests that both widgets report the estimates and that `npm run compile` succeeds

- [x] 1.3 Replace vertical margins of block widgets, framed code lines and horizontal-rule lines with padding in `globals.css` and `livePreview.ts` (outer wrapper for the Mermaid box, centered background line for `---`); verify that no rule for `.cm-mermaid*` or `.cm-inline-image*` sets a vertical margin and that the diagrams look unchanged

## 2. Verification

- [x] 2.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 2.2 Manually check in `project-plan.md` (image and two diagrams): click lines below each widget, press `ArrowUp` from the end of the note up to the top, narrow the editor and repeat
