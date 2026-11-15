import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { EditorSelection, EditorState, Extension, Facet, Range, Transaction, TransactionSpec } from '@codemirror/state';
import { linkedTaskIdRange } from '../../../services/linkedTaskLines';
import { getAvailableTree, isInsideNode } from '../lib/listStructure';
import { syntaxVisibilityFacet } from './livePreview';

/** Called with the task ID when the marker of a linked task line is clicked. */
export const openLinkedTaskFacet = Facet.define<(taskId: string) => void, ((taskId: string) => void) | undefined>({
  combine: (values) => values[0],
});

/** Small marker at the end of a linked task line; clicking it opens the task list. */
class LinkedTaskWidget extends WidgetType {
  constructor(readonly taskId: string) {
    super();
  }

  eq(other: LinkedTaskWidget): boolean {
    return other.taskId === this.taskId;
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-linked-task-marker';
    span.title = 'In der Aufgabenliste \u2013 klicken zum \u00d6ffnen';
    span.setAttribute('aria-label', 'In der Aufgabenliste');
    span.setAttribute('role', 'button');
    span.textContent = '\u2611';
    span.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.state.facet(openLinkedTaskFacet)?.(this.taskId);
    });
    return span;
  }

  ignoreEvent(event: Event): boolean {
    return event.type === 'mousedown' || event.type === 'click';
  }
}

export const linkedTasksTheme = EditorView.baseTheme({
  '.cm-linked-task-marker': {
    marginLeft: '6px',
    opacity: '0.55',
    fontSize: '0.85em',
    userSelect: 'none',
    cursor: 'pointer',
    color: 'var(--vscode-descriptionForeground, currentColor)',
  },
  '.cm-linked-task-marker:hover': {
    opacity: '1',
    color: 'var(--vscode-textLink-foreground, currentColor)',
  },
});

/**
 * Decorations for linked task lines in `ranges`: the ` ^t-xxxxxx` ID is replaced by the marker unless the
 * syntax visibility mode is `visible`, where the marker is added after the shown ID.
 */
export function buildLinkedTaskDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[]
): DecorationSet {
  const hide = state.facet(syntaxVisibilityFacet) !== 'visible';
  const tree = getAvailableTree(state, ranges.length ? ranges[ranges.length - 1].to : 0);
  const builder: Range<Decoration>[] = [];

  for (const { from, to } of ranges) {
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);
      const idRange = linkedTaskIdRange(line.text);
      if (idRange && !isInsideNode(tree, line.from, 'FencedCode')) {
        const marker = new LinkedTaskWidget(line.text.match(/\^(t-[a-z0-9]{6})\s*$/)![1]);
        builder.push(
          hide
            ? Decoration.replace({ widget: marker }).range(line.from + idRange.from, line.from + idRange.to)
            : Decoration.widget({ widget: marker, side: 1 }).range(line.to)
        );
      }
      if (line.to >= state.doc.length) break;
      pos = line.to + 1;
    }
  }
  return Decoration.set(builder, true);
}

/**
 * Keeps empty cursors in front of a hidden task ID: typing behind the ID would end the line with text
 * and break the link. Moving right from the end of the title goes on to the next line.
 */
export const keepCursorBeforeTaskId = EditorState.transactionFilter.of((tr: Transaction): Transaction | readonly (Transaction | TransactionSpec)[] => {
  if (!tr.selection || tr.startState.facet(syntaxVisibilityFacet) === 'visible') return tr;
  const doc = tr.newDoc;
  let changed = false;
  const ranges = tr.newSelection.ranges.map((range, i) => {
    if (!range.empty) return range;
    const line = doc.lineAt(range.head);
    const idRange = linkedTaskIdRange(line.text);
    if (!idRange) return range;
    const idFrom = line.from + idRange.from;
    if (range.head <= idFrom) return range;
    const before = tr.startState.selection.ranges[i];
    const movingRight = !tr.docChanged && before?.empty && before.head === idFrom && range.head === line.to;
    changed = true;
    return EditorSelection.cursor(movingRight && line.to < doc.length ? line.to + 1 : idFrom);
  });
  if (!changed) return tr;
  return [tr, { selection: EditorSelection.create(ranges, tr.newSelection.mainIndex), sequential: true }];
});

export const linkedTasksPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLinkedTaskDecorations(view.state, view.visibleRanges);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.state.facet(syntaxVisibilityFacet) !== update.startState.facet(syntaxVisibilityFacet)
      ) {
        this.decorations = buildLinkedTaskDecorations(update.state, update.view.visibleRanges);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

export function linkedTasks(options?: { onOpenTask?: (taskId: string) => void }): Extension {
  return [
    linkedTasksTheme,
    linkedTasksPlugin,
    keepCursorBeforeTaskId,
    options?.onOpenTask ? openLinkedTaskFacet.of(options.onOpenTask) : [],
  ];
}
