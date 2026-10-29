import { EditorView, keymap, showTooltip, Tooltip, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { EditorState, Extension, Prec, StateEffect, StateField, TransactionSpec } from '@codemirror/state';
import { findFencedBlocks, MERMAID_PLACEHOLDER } from '../../../services/markdownScan';

export const MIN_SELECTION_CHARS = 20;
const KEYBOARD_SETTLE_MS = 300;

export interface SelectionInfo {
  text: string;
  /** 1-based lines of the selection. */
  fromLine: number;
  toLine: number;
}

export interface SelectionActionsOptions {
  onSummarize: (selection: SelectionInfo) => void;
  /** Called after the placeholder block was inserted below the selection. */
  onDiagram: (selection: SelectionInfo & { blockFrom: number }) => void;
}

/** Marks whether the selection is finished (mouse released / keyboard paused) or not. */
export const setSelectionSettled = StateEffect.define<boolean>();

/** The selection the popup would act on, or undefined when it should not be shown. */
export function eligibleSelection(state: EditorState): SelectionInfo | undefined {
  const { from, to, empty } = state.selection.main;
  if (empty) return undefined;
  const text = state.sliceDoc(from, to);
  if (text.trim().length < MIN_SELECTION_CHARS) return undefined;

  // Not in code, Mermaid blocks or tables
  if (findFencedBlocks(state.doc.toString()).some((b) => from < b.to && to > b.from)) return undefined;
  const fromLine = state.doc.lineAt(from).number;
  const toLine = state.doc.lineAt(to).number;
  for (let n = fromLine; n <= toLine; n++) {
    if (state.doc.line(n).text.trim().startsWith('|')) return undefined;
  }
  return { text, fromLine, toLine };
}

/** Inserts the `/ki-diagramm` placeholder on its own lines after `toLine` and returns its start. */
export function insertDiagramAfterLine(
  view: { state: EditorState; dispatch: (spec: TransactionSpec) => void },
  toLine: number
): number {
  const line = view.state.doc.line(toLine);
  const insert = `\n\`\`\`mermaid\n${MERMAID_PLACEHOLDER}\n\`\`\``;
  view.dispatch({ changes: { from: line.to, insert } });
  return line.to + 1;
}

function createTooltip(state: EditorState, options: SelectionActionsOptions): Tooltip | null {
  const selection = eligibleSelection(state);
  if (!selection) return null;
  return {
    pos: state.selection.main.head,
    above: true,
    strictSide: false,
    arrow: false,
    create(view) {
      const dom = document.createElement('div');
      dom.className = 'cm-selection-actions';
      const button = (label: string, run: () => void) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.textContent = label;
        // Keep the selection while clicking
        el.addEventListener('mousedown', (e) => e.preventDefault());
        el.addEventListener('click', (e) => {
          e.preventDefault();
          view.dispatch({ effects: setSelectionSettled.of(false) });
          run();
        });
        dom.appendChild(el);
      };
      button('Diagramm erstellen', () => {
        const blockFrom = insertDiagramAfterLine(view, selection.toLine);
        options.onDiagram({ ...selection, blockFrom });
      });
      button('Zusammenfassen', () => options.onSummarize(selection));
      return { dom };
    },
  };
}

interface PopupState {
  settled: boolean;
  tooltip: Tooltip | null;
}

function popupField(options: SelectionActionsOptions) {
  return StateField.define<PopupState>({
    create: () => ({ settled: false, tooltip: null }),
    update(value, tr) {
      let settled = value.settled;
      let explicit = false;
      for (const effect of tr.effects) {
        if (effect.is(setSelectionSettled)) {
          settled = effect.value;
          explicit = true;
        }
      }
      // Typing hides the popup; a changing selection waits until it settles again
      if (tr.docChanged || (!explicit && tr.selection)) settled = false;
      if (!settled) return value.tooltip || value.settled ? { settled: false, tooltip: null } : value;
      if (value.settled && !tr.docChanged && !tr.selection) return value;
      return { settled, tooltip: createTooltip(tr.state, options) };
    },
    provide: (field) => showTooltip.compute([field], (state) => state.field(field).tooltip),
  });
}

/** Settles the selection after the mouse is released or the keyboard selection pauses. */
const settleTracker = ViewPlugin.fromClass(
  class {
    timer: ReturnType<typeof setTimeout> | undefined;
    dragging = false;

    constructor(readonly view: EditorView) {}

    update(update: ViewUpdate) {
      const keyboardSelect = update.transactions.some(
        (tr) => tr.selection && tr.isUserEvent('select') && !tr.isUserEvent('select.pointer')
      );
      if (keyboardSelect && !this.dragging) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.timer = undefined;
          this.view.dispatch({ effects: setSelectionSettled.of(true) });
        }, KEYBOARD_SETTLE_MS);
      }
    }

    destroy() {
      if (this.timer) clearTimeout(this.timer);
    }
  },
  {
    eventHandlers: {
      mousedown() {
        this.dragging = true;
      },
      mouseup(_event, view) {
        this.dragging = false;
        // Let CodeMirror finish the pointer selection first
        setTimeout(() => view.dispatch({ effects: setSelectionSettled.of(true) }), 0);
      },
    },
  }
);

const selectionActionsTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-tooltip-above:has(.cm-selection-actions), .cm-tooltip:has(.cm-selection-actions)': {
    border: 'none',
    background: 'transparent',
  },
  '.cm-selection-actions': {
    display: 'flex',
    gap: '4px',
    padding: '3px',
    borderRadius: '8px',
    border: '1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.35))',
    background: 'var(--vscode-editorWidget-background, #252526)',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  },
  '.cm-selection-actions button': {
    padding: '3px 10px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '12px',
    cursor: 'pointer',
    color: 'var(--vscode-foreground, inherit)',
    background: 'transparent',
  },
  '.cm-selection-actions button:hover': {
    background: 'var(--vscode-list-hoverBackground, rgba(127,127,127,0.2))',
  },
});

/** Popup with AI actions for selected text. */
export function selectionActions(options: SelectionActionsOptions): Extension {
  const field = popupField(options);
  return [
    field,
    settleTracker,
    selectionActionsTheme,
    Prec.high(
      keymap.of([
        {
          key: 'Escape',
          run: (view) => {
            if (!view.state.field(field).tooltip) return false;
            view.dispatch({ effects: setSelectionSettled.of(false) });
            return true;
          },
        },
      ])
    ),
  ];
}

/**
 * Inserts `insert` after the last line of the `anchorText` occurrence nearest to `line`, separated
 * by a blank line, in one undoable change. Returns `changed` when the text is no longer there.
 */
export function insertAfterAnchor(
  view: { state: EditorState; dispatch: (spec: TransactionSpec) => void },
  request: { anchorText: string; insert: string; line?: number }
): 'ok' | 'changed' {
  const doc = view.state.doc;
  const text = doc.toString();
  let best: { end: number; distance: number } | undefined;
  for (let i = text.indexOf(request.anchorText); i !== -1; i = text.indexOf(request.anchorText, i + 1)) {
    const distance = Math.abs(doc.lineAt(i).number - (request.line ?? 1));
    if (!best || distance < best.distance) best = { end: i + request.anchorText.length, distance };
  }
  if (!best || !request.anchorText) return 'changed';
  const lineEnd = doc.lineAt(best.end).to;
  view.dispatch({ changes: { from: lineEnd, insert: `\n\n${request.insert}` }, userEvent: 'input.ai' });
  return 'ok';
}

/** Exposed for tests: the popup field built with the given options. */
export const createSelectionPopupField = popupField;
