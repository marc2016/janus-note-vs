import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { Range, Extension, EditorState, Line } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode, Tree } from '@lezer/common';
import {
  getAvailableTree,
  getListDepthAt,
  hasAncestor,
  listItemDepth,
  toListItemInfo,
} from '../lib/listStructure';

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

/** Left padding of a list line before its marker: base plus one marker slot per nesting level. */
const LEVEL_BASE_REM = 0.5;
const LEVEL_STEP_REM = 1.25;

/** Rendered widths of the list prefixes (marker plus gap), used for the hanging indent. */
const BULLET_WIDTH = '1.25rem';
const TASK_WIDTH = 'calc(1.25rem + 20px)';
const orderedWidth = (markLength: number) => `calc(${markLength}ch + 0.5em)`;

const hiddenSpaces = Decoration.replace({});

export const styledListsTheme = EditorView.baseTheme({
  // Text of marker lines, wrapped lines and continuation lines starts after the marker slot;
  // the marker itself is pulled back into the padding by the negative text-indent.
  '.cm-line.cm-list-item': {
    paddingLeft: 'calc(var(--cm-list-pad, 0.5rem) + var(--cm-list-marker, 1.25rem))',
    textIndent: 'calc(-1 * var(--cm-list-marker, 1.25rem))',
  },
  '.cm-line.cm-list-continuation': {
    paddingLeft: 'calc(var(--cm-list-pad, 0.5rem) + var(--cm-list-marker, 1.25rem))',
  },
  // text-indent is inherited by inline blocks (bullets, checkboxes, images) and must not apply there
  '.cm-line.cm-list-item *': {
    textIndent: '0',
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
  '.cm-task-list-dash': {
    display: 'inline-block',
    width: '1.25rem',
    textAlign: 'center',
    whiteSpace: 'pre',
  },
  '.cm-ordered-list-mark': {
    display: 'inline-block',
    minWidth: 'var(--cm-list-marker)',
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

interface ListLineStyle {
  level: number;
  marker: string;
}

function lineAttributes({ level, marker }: ListLineStyle): Record<string, string> {
  return { style: `--cm-list-pad: ${LEVEL_BASE_REM + level * LEVEL_STEP_REM}rem; --cm-list-marker: ${marker}` };
}

/** Marker width of a list item, derived from its marker line. */
function markerWidthOf(state: EditorState, item: SyntaxNode): string | null {
  const info = toListItemInfo(state, item);
  if (!info) return null;
  if (info.ordered) return orderedWidth(info.markText.length);
  const line = state.doc.lineAt(info.markFrom);
  const rest = line.text.slice(info.markTo - line.from);
  return /^\s+\[[ xX]\]/.test(rest) ? TASK_WIDTH : BULLET_WIDTH;
}

/**
 * List item whose paragraph continues on `line` (a line without its own marker), or null.
 * Lines in code blocks, tables, headings or blockquotes are not continuation lines.
 */
function continuationItem(state: EditorState, tree: Tree, line: Line): SyntaxNode | null {
  const contentStart = line.text.match(/^[ \t]*/)![0].length;
  if (contentStart >= line.text.length) return null;
  for (let node: SyntaxNode | null = tree.resolveInner(line.from + contentStart, 1); node; node = node.parent) {
    if (node.name === 'Paragraph') {
      const item = node.parent;
      if (!item || item.name !== 'ListItem' || hasAncestor(item, 'Blockquote')) return null;
      return state.doc.lineAt(item.from).number < line.number ? item : null;
    }
    if (node.name === 'ListItem' || node.name === 'Document') return null;
  }
  return null;
}

export function buildListDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[]
): DecorationSet {
  const builder: Range<Decoration>[] = [];
  // Text typed inside a hidden range would land elsewhere, so a range holding a cursor stays visible
  const heads = state.selection.ranges.map((r) => r.head);
  const hide = (from: number, to: number) => {
    if (to > from && !heads.some((h) => h > from && h < to)) builder.push(hiddenSpaces.range(from, to));
  };
  const hideIndentation = (line: Line, length: number) => hide(line.from, line.from + length);
  const tree = getAvailableTree(state, ranges.length ? ranges[ranges.length - 1].to : 0);

  for (const { from, to } of ranges) {
    // Style of the list item on the previous line, for whitespace-only lines inside it
    let lastItem: ListLineStyle | null = null;
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);
      let current: ListLineStyle | null = null;

      // Check for task list items first: optional whitespace + bullet + space + [ ] or [x]
      const taskMatch = line.text.match(/^(\s*)([-*+]\s+)\[([ xX])\](\s*)/);
      const bulletMatch = taskMatch ? null : line.text.match(/^(\s*)([-*+])(\s+)/);
      const orderedMatch = taskMatch || bulletMatch ? null : line.text.match(/^(\s*)(\d+[.)])(\s+)/);

      if (taskMatch) {
        const indent = taskMatch[1].length;
        const markerPos = line.from + indent;
        current = { level: listLevel(state, tree, markerPos, indent), marker: TASK_WIDTH };
        builder.push(
          Decoration.line({
            class: `cm-list-item cm-task-list-item cm-list-level-${current.level}`,
            attributes: lineAttributes(current),
          }).range(line.from)
        );
        hideIndentation(line, indent);
        // Fixed-width slot for `- `; the checkbox widget replaces `[ ]` and brings its own gap
        builder.push(
          Decoration.mark({ class: 'cm-task-list-dash' }).range(markerPos, markerPos + taskMatch[2].length)
        );
        // Only the first space after the checkbox is hidden: further spaces (e.g. before a task ID on an
        // empty linked line) stay visible so the cursor never sits inside the hidden range
        const afterBox = markerPos + taskMatch[2].length + 3;
        if (taskMatch[4].length > 0) hide(afterBox, afterBox + 1);
      } else if (bulletMatch) {
        const indent = bulletMatch[1].length;
        const markerChar = bulletMatch[2];
        const markerPos = line.from + indent;
        current = { level: listLevel(state, tree, markerPos, indent), marker: BULLET_WIDTH };

        // Line decoration for hierarchical indentation and the hanging indent
        builder.push(
          Decoration.line({
            class: `cm-list-item cm-bullet-list-item cm-list-level-${current.level}`,
            attributes: lineAttributes(current),
          }).range(line.from)
        );
        hideIndentation(line, indent);

        // Replace the marker character and the following spaces with the BulletWidget
        builder.push(
          Decoration.replace({
            widget: new BulletWidget(markerChar, current.level),
          }).range(markerPos, markerPos + 1 + bulletMatch[3].length)
        );
      } else if (orderedMatch) {
        const indent = orderedMatch[1].length;
        const markerPos = line.from + indent;
        const markerLen = orderedMatch[2].length;
        current = { level: listLevel(state, tree, markerPos, indent), marker: orderedWidth(markerLen) };

        builder.push(
          Decoration.line({
            class: `cm-list-item cm-ordered-list-item cm-list-level-${current.level}`,
            attributes: lineAttributes(current),
          }).range(line.from)
        );
        hideIndentation(line, indent);

        // The mark has the width of the marker slot; the spaces after it are not drawn
        builder.push(Decoration.mark({ class: 'cm-ordered-list-mark' }).range(markerPos, markerPos + markerLen));
        hide(markerPos + markerLen, markerPos + markerLen + orderedMatch[3].length);
      } else {
        const item = continuationItem(state, tree, line);
        const marker = item ? markerWidthOf(state, item) : null;
        if (item && marker) {
          current = { level: Math.min(listItemDepth(item), 6), marker };
        } else if (lastItem && line.text.length > 0 && line.text.trim() === '') {
          // Indented empty line inside an item (e.g. right after Shift+Enter)
          current = lastItem;
        }
        if (current) {
          builder.push(
            Decoration.line({
              class: `cm-list-continuation cm-list-level-${current.level}`,
              attributes: lineAttributes(current),
            }).range(line.from)
          );
          hideIndentation(line, line.text.match(/^[ \t]*/)![0].length);
        }
      }

      lastItem = current;
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
        update.selectionSet ||
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
