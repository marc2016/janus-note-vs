import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  lineHighlightExtension,
  setHighlightLine,
  highlightLineField,
} from '../src/webviews/markdown/extensions/lineHighlight';

describe('Line Highlight CodeMirror Extension', () => {
  it('initializes with no line decorations', () => {
    const doc = 'Line 1\nLine 2\nLine 3\nLine 4';
    const state = EditorState.create({
      doc,
      extensions: [lineHighlightExtension()],
    });

    const decorations = state.field(highlightLineField);
    expect(decorations.size).toBe(0);
  });

  it('sets a line decoration on the requested 1-based line number', () => {
    const doc = 'Line 1\nLine 2\nLine 3\nLine 4';
    const state = EditorState.create({
      doc,
      extensions: [lineHighlightExtension()],
    });

    const tr = state.update({
      effects: [setHighlightLine.of(2)],
    });

    const decorations = tr.state.field(highlightLineField);
    expect(decorations.size).toBe(1);

    let decoratedFrom = -1;
    decorations.between(0, tr.state.doc.length, (from, _to, value) => {
      decoratedFrom = from;
      expect((value.spec as any).class).toBe('cm-target-line-highlight');
    });

    // Line 2 starts at index 7 ('Line 1\n' has length 7)
    expect(decoratedFrom).toBe(7);
  });

  it('clears line decoration when passed null', () => {
    const doc = 'Line 1\nLine 2\nLine 3';
    let state = EditorState.create({
      doc,
      extensions: [lineHighlightExtension()],
    });

    state = state.update({ effects: [setHighlightLine.of(2)] }).state;
    expect(state.field(highlightLineField).size).toBe(1);

    state = state.update({ effects: [setHighlightLine.of(null)] }).state;
    expect(state.field(highlightLineField).size).toBe(0);
  });

  it('ignores line numbers out of document bounds', () => {
    const doc = 'Line 1\nLine 2\nLine 3';
    const state = EditorState.create({
      doc,
      extensions: [lineHighlightExtension()],
    });

    // 0 is out of bounds (1-based)
    const tr0 = state.update({ effects: [setHighlightLine.of(0)] });
    expect(tr0.state.field(highlightLineField).size).toBe(0);

    // 5 is out of bounds (document has 3 lines)
    const tr5 = state.update({ effects: [setHighlightLine.of(5)] });
    expect(tr5.state.field(highlightLineField).size).toBe(0);
  });

  it('auto-clears highlight when the cursor or selection moves (Option 2)', () => {
    const doc = 'Line 1\nLine 2\nLine 3\nLine 4';
    let state = EditorState.create({
      doc,
      extensions: [lineHighlightExtension()],
    });

    // Highlight line 3
    state = state.update({ effects: [setHighlightLine.of(3)] }).state;
    expect(state.field(highlightLineField).size).toBe(1);

    // User moves cursor / changes selection
    const moveTr = state.update({
      selection: { anchor: 0 },
    });

    expect(moveTr.state.field(highlightLineField).size).toBe(0);
  });

  it('auto-clears highlight when the document is edited', () => {
    const doc = 'Line 1\nLine 2\nLine 3\nLine 4';
    let state = EditorState.create({
      doc,
      extensions: [lineHighlightExtension()],
    });

    // Highlight line 2
    state = state.update({ effects: [setHighlightLine.of(2)] }).state;
    expect(state.field(highlightLineField).size).toBe(1);

    // Document edit
    const editTr = state.update({
      changes: { from: 0, to: 0, insert: 'Header\n' },
    });

    expect(editTr.state.field(highlightLineField).size).toBe(0);
  });
});

