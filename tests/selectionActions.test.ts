import { describe, it, expect, vi } from 'vitest';
import { EditorState, TransactionSpec } from '@codemirror/state';
import {
  createSelectionPopupField,
  eligibleSelection,
  insertDiagramAfterLine,
  setSelectionSettled,
} from '../src/webviews/markdown/extensions/selectionActions';
import { MERMAID_PLACEHOLDER } from '../src/services/markdownScan';

const sentence = 'Die Sync-Architektur nutzt WebSockets für Delta-Sync.';
const doc = `# Plan\n\n${sentence}\nZweite Zeile.\n\n\`\`\`js\nconst langerCodeText = 12345678901234567890;\n\`\`\`\n\n| Spalte | Wert mit genug Zeichen |\n|---|---|\n`;
const options = { onSummarize: vi.fn(), onDiagram: vi.fn() };
const field = createSelectionPopupField(options);

const select = (from: number, to: number) => EditorState.create({ doc, selection: { anchor: from, head: to }, extensions: [field] });
const tooltipOf = (state: EditorState) => state.field(field).tooltip;
const settle = (state: EditorState) => state.update({ effects: setSelectionSettled.of(true) }).state;

describe('selection popup', () => {
  const from = doc.indexOf(sentence);
  const to = from + sentence.length;

  it('shows after the selection is settled', () => {
    const state = select(from, to);
    expect(tooltipOf(state)).toBeNull();
    expect(tooltipOf(settle(state))).not.toBeNull();
    expect(eligibleSelection(state)).toEqual({ text: sentence, fromLine: 3, toLine: 3 });
  });

  it('stays hidden for short selections, code and tables', () => {
    expect(tooltipOf(settle(select(from, from + 8)))).toBeNull();
    const codeFrom = doc.indexOf('const');
    expect(tooltipOf(settle(select(codeFrom, codeFrom + 30)))).toBeNull();
    const tableFrom = doc.indexOf('| Spalte');
    expect(tooltipOf(settle(select(tableFrom, tableFrom + 25)))).toBeNull();
  });

  it('disappears on typing, on a changing selection and on unsettle (Esc)', () => {
    const shown = settle(select(from, to));
    expect(tooltipOf(shown.update({ changes: { from: 0, insert: 'x' } }).state)).toBeNull();
    expect(tooltipOf(shown.update({ selection: { anchor: from, head: to - 1 }, userEvent: 'select' }).state)).toBeNull();
    expect(tooltipOf(shown.update({ effects: setSelectionSettled.of(false) }).state)).toBeNull();
  });
});

describe('diagram from a selection', () => {
  it('inserts the placeholder on the line after the selection and leaves the selection unchanged', () => {
    const view = {
      state: EditorState.create({ doc: 'A\nAusgewählter Text\nC' }),
      dispatch(spec: TransactionSpec) {
        view.state = view.state.update(spec).state;
      },
    };
    const blockFrom = insertDiagramAfterLine(view, 2);
    expect(view.state.doc.toString()).toBe(`A\nAusgewählter Text\n\`\`\`mermaid\n${MERMAID_PLACEHOLDER}\n\`\`\`\nC`);
    expect(view.state.doc.lineAt(blockFrom).number).toBe(3);
    expect(view.state.doc.sliceString(blockFrom, blockFrom + 10)).toBe('```mermaid');
  });
});
