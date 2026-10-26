import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { Range, Extension, EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import { getAvailableTree, getListDepthAt } from '../lib/listStructure';

class BulletWidget extends WidgetType {
  constructor(
    readonly marker: string,
    readonly level: number
  ) {
    super();
  }

  eq(other: BulletWidget): boolean {
    return this.marker === other.marker && this.level === other.level;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = `cm-bullet-marker cm-bullet-level-${Math.min(this.level, 2)}`;
    // Hierarchical bullet glyphs: level 0 = •, level 1 = ◦, level 2+ = ▪
    const bullets = ['•', '◦', '▪'];
    span.textContent = bullets[Math.min(this.level, bullets.length - 1)];
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export const styledListsTheme = EditorView.baseTheme({
  '.cm-line.cm-list-item': {
    paddingLeft: '0.5rem',
  },
  '.cm-line.cm-list-item.cm-list-level-1': {
    paddingLeft: '1.75rem',
  },
  '.cm-line.cm-list-item.cm-list-level-2': {
    paddingLeft: '3rem',
  },
  '.cm-line.cm-list-item.cm-list-level-3': {
    paddingLeft: '4.25rem',
  },
  '.cm-line.cm-list-item.cm-list-level-4': {
    paddingLeft: '5.5rem',
  },
  '.cm-line.cm-list-item.cm-list-level-5': {
    paddingLeft: '6.75rem',
  },
  '.cm-line.cm-list-item.cm-list-level-6': {
    paddingLeft: '8rem',
  },
  '.cm-bullet-marker': {
    display: 'inline-block',
    width: '1.25rem',
    minWidth: '1.25rem',
    textAlign: 'center',
    color: 'var(--vscode-foreground, currentColor)',
    opacity: '0.85',
    userSelect: 'none',
    fontWeight: 'bold',
    verticalAlign: 'baseline',
  },
  '.cm-bullet-marker.cm-bullet-level-1': {
    fontSize: '0.95em',
    opacity: '0.8',
  },
  '.cm-bullet-marker.cm-bullet-level-2': {
    fontSize: '0.85em',
    opacity: '0.75',
  },
  '.cm-ordered-list-mark': {
    color: 'var(--vscode-descriptionForeground, rgba(156, 163, 175, 0.9))',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: '600',
  },
});

/**
 * Nesting level of the list item whose marker starts at `markerPos`, derived from the list
 * structure (CommonMark-aware). Falls back to the whitespace heuristic while the tree is incomplete.
 */
function listLevel(state: EditorState, tree: Tree, markerPos: number, indent: number): number {
  const depth = getListDepthAt(state, tree, markerPos);
  return Math.min(depth ?? Math.floor(indent / 2), 6);
}

export function buildListDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[]
): DecorationSet {
  const builder: Range<Decoration>[] = [];
  const tree = getAvailableTree(state, ranges.length ? ranges[ranges.length - 1].to : 0);

  for (const { from, to } of ranges) {
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);

      // Check for task list items first: optional whitespace + bullet + space + [ ] or [x]
      const isTaskList = /^(\s*[-*+]\s+)\[([ xX])\]/.test(line.text);
      if (isTaskList) {
        const indentMatch = line.text.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;
        const level = listLevel(state, tree, line.from + indent, indent);
        builder.push(
          Decoration.line({
            class: `cm-list-item cm-task-list-item cm-list-level-${level}`,
          }).range(line.from)
        );
      } else {
        // Match unordered list items: optional whitespace + bullet (- or * or +) + at least one space
        const bulletMatch = line.text.match(/^(\s*)([-*+])(\s+)/);
        if (bulletMatch) {
          const indent = bulletMatch[1].length;
          const markerChar = bulletMatch[2];
          const markerPos = line.from + indent;
          const level = listLevel(state, tree, markerPos, indent);

          // Line decoration for hierarchical indentation
          builder.push(
            Decoration.line({
              class: `cm-list-item cm-bullet-list-item cm-list-level-${level}`,
            }).range(line.from)
          );

          // Replace the marker character + 1 space (2 characters) with the BulletWidget
          builder.push(
            Decoration.replace({
              widget: new BulletWidget(markerChar, level),
            }).range(markerPos, markerPos + 2)
          );
        } else {
          // Match ordered list items: optional whitespace + numbers + . or ) + at least one space
          const orderedMatch = line.text.match(/^(\s*)(\d+[.)])(\s+)/);
          if (orderedMatch) {
            const indent = orderedMatch[1].length;
            const markerPos = line.from + indent;
            const level = listLevel(state, tree, markerPos, indent);
            const markerLen = orderedMatch[2].length;

            builder.push(
              Decoration.line({
                class: `cm-list-item cm-ordered-list-item cm-list-level-${level}`,
              }).range(line.from)
            );

            builder.push(
              Decoration.mark({
                class: 'cm-ordered-list-mark',
              }).range(markerPos, markerPos + markerLen)
            );
          }
        }
      }

      if (line.to >= state.doc.length) break;
      pos = line.to + 1;
    }
  }

  return Decoration.set(builder, true);
}

export const styledListsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildListDecorations(view.state, view.visibleRanges);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildListDecorations(update.state, update.view.visibleRanges);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export function styledLists(): Extension {
  return [styledListsTheme, styledListsPlugin];
}
