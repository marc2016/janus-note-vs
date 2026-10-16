# Design

## Context

The Markdown Live Preview in `src/webviews/markdown/` uses CodeMirror 6 with custom view plugins and decorations (`livePreview.ts`, `styledLists.ts`, `taskCheckboxes.ts`). Currently, heading markers (`# `) are styled with dimmed opacity rather than hidden, and inline formatting markers (`**`, `*`, `~~`) are highlighted by Lezer without hiding. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Provide a 3-way cycle toggle button in `MarkdownToolbar` for switching between `auto`, `visible`, and `hidden` modes.
- Implement dynamic marker hiding/revealing in CodeMirror 6 using a configurable `Compartment`.
- In `auto` mode, hide heading hashes and inline mark delimiters when cursor is outside, and reveal them cleanly when the cursor enters the line/range.
- Preserve zero-diff guarantees: decorations strictly manipulate visual layout without changing underlying document buffer text.
- Persist the user's selected mode in VS Code webview state (`vscodeApi.setState`).

**Non-Goals:**
- Removing or stripping Markdown syntax from the underlying document (purely visual Live Preview decoration).
- Complex modal editing; only presentation modes are toggled.

## Decisions

### Decision 1: Single 3-Way Cycle Button in Toolbar
- **Rationale**: Keeps the formatting toolbar compact and uncluttered. A single button with dynamic icon (e.g., eye/eye-outline/eye-off) and contextual tooltip allows instantaneous toggling with one click.
- **Alternatives Considered**:
  - Segmented 3-button control: Occupies excessive horizontal space on smaller split view screens.
  - Dropdown menu: Requires two clicks instead of one.

### Decision 2: CodeMirror 6 Compartment for Dynamic Configuration
- **Rationale**: Wrapping the syntax visibility extension in a `Compartment` allows `MarkdownEditorApp` to dispatch a configuration transaction (`compartment.reconfigure(...)`) whenever the user clicks the toolbar button, updating decorations instantly without reloading the editor.
- **Alternatives Considered**:
  - Full editor teardown and remount: Causes flicker, cursor jump, and lost scroll position.

### Decision 3: CSS-based Token Masking
- **Rationale**: For heading prefixes and inline delimiters, use dedicated CSS classes (`.cm-syntax-hidden`) with `display: inline-block; width: 0; max-width: 0; overflow: hidden; opacity: 0; vertical-align: top;` rather than removing DOM nodes. This maintains cursor navigation integrity and prevents line break artifacts.
- **Alternatives Considered**:
  - `Decoration.replace`: Can occasionally cause cursor boundary traps or IME input issues when typing near mark edges.

### Decision 4: Webview State Persistence
- **Rationale**: Save `{ syntaxVisibilityMode: 'auto' | 'visible' | 'hidden' }` into `acquireVsCodeApi().setState(...)` on change and restore on initialization.

## Risks / Trade-offs

- **[Risk]** Layout shift when moving cursor into a hidden inline mark in `auto` mode.
  - **Mitigation**: Clear visual transition and instant reveal on focus. Users sensitive to layout shift can easily switch to `visible` (raw) mode.
- **[Risk]** Overlapping decorations with list items or headings.
  - **Mitigation**: Combine range calculations carefully in `livePreview.ts` so heading mark decorations do not conflict with list bullet or checkbox widgets.
