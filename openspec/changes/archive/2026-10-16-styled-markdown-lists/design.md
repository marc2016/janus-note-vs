# Design

## Context

The Markdown editor uses CodeMirror 6 with live preview decorations (`livePreview.ts` for headings and blockquotes, `taskCheckboxes.ts` for task checkboxes). List items are currently rendered as plain monospaced text with raw hyphens (`- `) or asterisks (`* `) and raw spaces. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Render unordered list markers (`- `, `* `, `+ `) with a clean typographic bullet point (`•`) using a permanent visual decoration without jumpy layout shift on focus.
- Calculate list item nesting level from leading whitespace (`level = Math.floor(indent / 2)`) and apply visual hierarchical indentation via `Decoration.line`.
- Ensure harmonious coexistence with `taskCheckboxes.ts`: task items receive hierarchical line indentation while preserving checkbox widgets without duplicate bullets.
- Support hierarchical visual indentation for ordered list items (`1. `, `2. `) as well.
- Maintain strict zero-diff file integrity: all changes in CodeMirror are visual decorations only; document transactions and saved files contain unmodified raw markdown markers.

**Non-Goals:**
- Custom rich-text list conversion or serialization tools that alter Markdown AST.
- Custom drag-and-drop reordering of list items.

## Decisions

### Decision 1: Permanent Visual Bullet via `Decoration.replace` with `BulletWidget`
- **Choice**: Replace the single marker character (`-`, `*`, `+`) with a `BulletWidget` that renders `<span class="cm-bullet-marker">•</span>`. The trailing space remains a normal text space.
- **Rationale**:
  - Eliminates the jumpy layout shifting associated with reveal-on-focus implementations.
  - Leaves CodeMirror's cursor and selection navigation smooth and predictable: cursor can move directly before or after the bullet marker.
  - Backspacing at column 1 deletes the marker character cleanly.
- **Alternatives Considered**:
  - Reveal-on-focus (Variante 2): causes horizontal layout shift and jarring visual flicker when arrowing up/down across lines.
  - CSS `::before` pseudo-element with hidden text: interferes with CodeMirror's caret coordinate measurement and causes cursor drift.

### Decision 2: Hierarchical Indentation via `Decoration.line` Classes
- **Choice**: Measure leading whitespace on list lines (`indent = match[1].length`) and assign CSS classes `cm-list-item cm-list-level-${level}` (where `level = Math.min(Math.floor(indent / 2), 6)`).
- **Rationale**:
  - `Decoration.line` applies styles directly to the line wrapper without splitting text nodes or invalidating heightmap coordinates.
  - Supports 2-space and 4-space markdown indentation conventions gracefully.
  - Line decoration CSS:
    ```css
    .cm-list-item.cm-list-level-1 { padding-left: 1.25rem; }
    .cm-list-item.cm-list-level-2 { padding-left: 2.5rem; }
    .cm-list-item.cm-list-level-3 { padding-left: 3.75rem; }
    ```
- **Alternatives Considered**:
  - Hardcoded inline styles on DOM elements: breaks CodeMirror DOM recycling and makes themes difficult to customize.

### Decision 3: Modular Architecture via `styledLists.ts`
- **Choice**: Encapsulate list decoration logic in `src/webviews/markdown/extensions/styledLists.ts` and register it in `MarkdownEditorApp.tsx`.
- **Rationale**:
  - Follows established project pattern (`taskCheckboxes.ts`, `slashCommands.ts`, `livePreview.ts`).
  - Keeps extensions modular and unit-testable.

### Decision 4: Task List Disambiguation
- **Choice**: Use negative lookahead `^(\s*)([-*+]\s+)(?!\[[ xX]\])` for bullet point replacement. For lines matching task items (`^(\s*[-*+]\s+)\[[ xX]\]`), apply only the `cm-list-item cm-list-level-${level}` line decoration and let `taskCheckboxes.ts` handle the checkbox widget.
- **Rationale**: Prevents rendering an unwanted bullet in front of a task checkbox.

## Risks / Trade-offs

- **[Risk] Cursor positioning around replacement widget**: If a replacement widget is too wide or styled with variable margin, the cursor might feel misaligned.
  - *Mitigation*: Style `.cm-bullet-marker` with fixed width, centered alignment, and font sizing consistent with base editor typography.
- **[Risk] Viewport scanning performance on large lists**: Scanning all visible lines on each keystroke could add latency if regex is unoptimized.
  - *Mitigation*: Limit decoration generation strictly to `view.visibleRanges` (consistent with `livePreview.ts` and `taskCheckboxes.ts`).
