import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection, Transaction, StateCommand } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import { history, undo } from '@codemirror/commands';
import { exitEmptyListItem } from '../src/webviews/markdown/lib/listIndentation';
import { markdownEditorKeymapExtensions } from '../src/webviews/markdown/lib/editorKeymap';

/** Creates a state where `^` marks the cursor and `«`/`»` mark a selection. */
function createState(docWithCursor: string, extra: any[] = []) {
  let doc = docWithCursor;
  let anchor: number;
  let head: number;
  if (doc.includes('«')) {
    anchor = doc.indexOf('«');
    doc = doc.replace('«', '');
    head = doc.indexOf('»');
    doc = doc.replace('»', '');
  } else {
    anchor = head = doc.indexOf('^');
    doc = doc.replace('^', '');
  }
  return EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [...extra, markdown({ extensions: [Table] }), history()],
  });
}

function run(command: StateCommand, state: EditorState) {
  let result = state;
  const handled = command({ state, dispatch: (tr: Transaction) => (result = tr.state) });
  return { handled, state: result };
}

/** Document with `^` at the cursor position. */
function show(state: EditorState) {
  const doc = state.doc.toString();
  const head = state.selection.main.head;
  return doc.slice(0, head) + '^' + doc.slice(head);
}

const enter = (doc: string) => run(exitEmptyListItem, createState(doc));

describe('Enter on empty list items', () => {
  it('moves an empty nested bullet one level up', () => {
    const { handled, state } = enter('- A\n  - B\n  - ^');
    expect(handled).toBe(true);
    expect(show(state)).toBe('- A\n  - B\n- ^');
  });

  it('moves an empty nested task one level up', () => {
    expect(show(enter('- [ ] A\n  - [ ] B\n  - [ ] ^').state)).toBe('- [ ] A\n  - [ ] B\n- [ ] ^');
  });

  it('renumbers an empty nested ordered item into the parent list', () => {
    expect(show(enter('1. A\n   1. B\n   2. ^').state)).toBe('1. A\n   1. B\n2. ^');
  });

  it('moves the third level to the second level', () => {
    expect(show(enter('- A\n  - B\n    - C\n    - ^').state)).toBe('- A\n  - B\n    - C\n  - ^');
  });

  it('ends the list on an empty top-level bullet', () => {
    const { handled, state } = enter('- A\n- ^');
    expect(handled).toBe(true);
    expect(show(state)).toBe('- A\n^');
  });

  it('ends the list on an empty top-level task without leftover spaces', () => {
    expect(show(enter('- [ ] A\n- [ ] ^').state)).toBe('- [ ] A\n^');
  });

  it('ends the list on an empty ordered item and an item without trailing space', () => {
    expect(show(enter('1. A\n2. ^').state)).toBe('1. A\n^');
    expect(show(enter('- A\n-^').state)).toBe('- A\n^');
  });

  it('keeps the blockquote prefix', () => {
    expect(show(enter('> - A\n> - ^').state)).toBe('> - A\n> ^');
    expect(show(enter('> - A\n>   - B\n>   - ^').state)).toBe('> - A\n>   - B\n> - ^');
  });

  it('works with the cursor in the middle of the trailing spaces', () => {
    expect(show(enter('- A\n  - B\n  - ^  ').state)).toBe('- A\n  - B\n- ^  ');
  });

  it('leaves items with text to the default Enter', () => {
    const { handled, state } = enter('- A\n  - B^');
    expect(handled).toBe(false);
    expect(state.doc.toString()).toBe('- A\n  - B');
  });

  it('leaves an empty item with child items to the default Enter', () => {
    expect(enter('- A\n- ^\n  - child').handled).toBe(false);
  });

  it('leaves a selection to the default Enter', () => {
    expect(run(exitEmptyListItem, createState('- A\n«  - »')).handled).toBe(false);
  });

  it('ignores lines that are not list items', () => {
    expect(enter('Text\n^').handled).toBe(false);
    expect(enter('# Heading^').handled).toBe(false);
  });

  it('is undone in a single step', () => {
    const before = createState('1. A\n   1. B\n   2. ^');
    const after = run(exitEmptyListItem, before).state;
    let undone = after;
    undo({ state: after, dispatch: (tr) => (undone = tr.state) });
    expect(show(undone)).toBe('1. A\n   1. B\n   2. ^');
  });

  it('never inserts a line or leaves space-only lines', () => {
    for (const doc of ['- A\n  - B\n  - ^', '- [ ] A\n- [ ] ^', '1. A\n   1. ^', '- A\n- ^']) {
      const before = createState(doc);
      const { state } = run(exitEmptyListItem, before);
      expect(state.doc.lines).toBe(before.doc.lines);
      expect(state.doc.toString().split('\n').some((l) => l.length > 0 && l.trim() === '')).toBe(false);
    }
  });
});

describe('Enter through the editor keymap stack', () => {
  // Mirrors CodeMirror's lookup: keymaps in precedence order, bindings tried until one handles the key.
  function pressEnter(doc: string) {
    const state = createState(doc, [markdownEditorKeymapExtensions()]);
    let result = state;
    const view = { state, dispatch: (tr: Transaction) => (result = tr.state) } as any;
    for (const bindings of state.facet(keymap)) {
      for (const binding of bindings) {
        if (binding.key === 'Enter' && binding.run?.(view)) return show(result);
      }
    }
    return show(result);
  }

  it('moves an empty nested item up before the Markdown list continuation runs', () => {
    expect(pressEnter('- A\n  - B\n  - ^')).toBe('- A\n  - B\n- ^');
  });

  it('still continues a list item with text', () => {
    expect(pressEnter('- A\n  - B^')).toBe('- A\n  - B\n  - ^');
  });
});
