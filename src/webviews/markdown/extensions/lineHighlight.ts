import { StateEffect, StateField, Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';

export const setHighlightLine = StateEffect.define<number | null>();

let lastHighlightTimestamp = 0;
let lastHighlightLineNumber = 0;

export const highlightLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlightLine)) {
        if (effect.value === null) {
          lastHighlightLineNumber = 0;
          return Decoration.none;
        }
        const lineNum = effect.value;
        if (lineNum < 1 || lineNum > tr.state.doc.lines) {
          lastHighlightLineNumber = 0;
          return Decoration.none;
        }
        lastHighlightLineNumber = lineNum;
        lastHighlightTimestamp = Date.now();
        const line = tr.state.doc.line(lineNum);
        return Decoration.set([
          Decoration.line({
            class: 'cm-target-line-highlight',
          }).range(line.from),
        ]);
      }
    }

    if (decorations.size === 0) {
      return Decoration.none;
    }

    // Auto-clear when user edits the document
    if (tr.docChanged) {
      lastHighlightLineNumber = 0;
      return Decoration.none;
    }

    // Auto-clear when user moves selection / clicks elsewhere
    if (tr.selection) {
      const elapsed = Date.now() - lastHighlightTimestamp;
      const head = tr.state.selection.main.head;
      const currentDocLine = tr.state.doc.lineAt(head).number;
      // Allow initial focus / selection placement during the first 400ms if on the same line
      if (elapsed > 400 || currentDocLine !== lastHighlightLineNumber) {
        lastHighlightLineNumber = 0;
        return Decoration.none;
      }
    }

    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const lineHighlightTheme = EditorView.baseTheme({
  '.cm-target-line-highlight': {
    backgroundColor: 'rgba(234, 179, 8, 0.25) !important',
    borderLeft: '4px solid #eab308 !important',
    boxShadow: 'inset 0 0 0 1px rgba(234, 179, 8, 0.35) !important',
  },
  '&dark .cm-target-line-highlight': {
    backgroundColor: 'rgba(234, 179, 8, 0.28) !important',
    borderLeft: '4px solid #facc15 !important',
    boxShadow: 'inset 0 0 0 1px rgba(234, 179, 8, 0.4) !important',
  },
});

export function lineHighlightExtension(): Extension {
  return [highlightLineField, lineHighlightTheme];
}

