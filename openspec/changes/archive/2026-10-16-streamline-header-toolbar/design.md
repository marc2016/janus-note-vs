# Design

## Context

See `proposal.md` for motivation. Currently, `MarkdownEditorApp.tsx` renders a separate `<header>` element containing a "Live Preview" status badge, an Obsidian subtitle, a manual theme toggle button, and an "Open Source" button. Below it sits `MarkdownToolbar.tsx`, containing text formatting tools.

## Goals / Non-Goals

**Goals:**
- Eliminate the top application `<header>` container to maximize vertical editing space.
- Integrate the "Open Source" action directly into `MarkdownToolbar` as the final toolbar element (e.g. aligned to the far right via `ml-auto` or at the end).
- Remove the manual "Light/Dark/Auto" button and related manual state logic, letting the app cleanly adapt to VS Code's theme dynamically.
- Keep `MarkdownToolbar` modular by passing `onOpenSource` as a prop from `MarkdownEditorApp`.

**Non-Goals:**
- Redesigning the CodeMirror editor core or existing formatting commands.
- Changing the VS Code extension host messaging protocol (`openSource` message remains identical).

## Decisions

### Decision 1: Pass `onOpenSource` callback prop to `MarkdownToolbar`
- **Rationale**: `MarkdownEditorApp` already holds the reference to `getVsCodeApi()` and orchestrates extension communication. Passing `onOpenSource?: () => void` keeps `MarkdownToolbar` decoupled from VS Code APIs, making it easier to test and reuse.
- **Alternatives considered**:
  - Calling `getVsCodeApi().postMessage({ type: 'openSource' })` directly inside `MarkdownToolbar`: couples toolbar directly to the webview API singleton.
  - Wrapping toolbar and a right-aligned button in an outer container in `MarkdownEditorApp`: creates unnecessary DOM wrapper layers.

### Decision 2: Visual Placement of the Open Source Button
- **Rationale**: Placed at the end of the `MarkdownToolbar` items with `ml-auto` so on wider windows it sits at the right end of the toolbar, while remaining gracefully flowable if the window is narrow. A separator line (`w-[1px] h-5 bg-border`) cleanly divides standard formatting actions from host document actions.
- **Alternatives considered**:
  - Leaving it inline immediately after Horizontal Rule without separation: visually mixes formatting tools with editor layout/navigation commands.

### Decision 3: Automatic VS Code Theme Synchronization
- **Rationale**: The webview already listens to `MutationObserver` on `document.body` classes (`vscode-dark`, `vscode-light`) and `prefers-color-scheme`. Removing manual override state simplifies component lifecycle and aligns perfectly with standard VS Code webviews.
- **Alternatives considered**:
  - Keeping theme toggle as a tiny icon in the toolbar: rejected as user explicitly stated "Diesen Light button brauche ich gar nicht".

## Risks / Trade-offs

- [Narrow webview width] → On very narrow editor split columns, a long toolbar might wrap to two lines. `flex-wrap` is already enabled on `MarkdownToolbar`, and placing the button at the end ensures natural flow.
