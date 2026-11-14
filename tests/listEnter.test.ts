import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection, Transaction, StateCommand } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import { history, undo } from '@codemirror/commands';
import {
  exitEmptyListItem,
  insertItemFromContinuation,
  insertListLineBreak,
} from '../src/webviews/markdown/lib/listIndentation';
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

const shiftEnter = (doc: string) => run(insertListLineBreak, createState(doc));

describe('Shift+Enter line breaks in list items', () => {
  it('continues a bullet item on an indented line', () => {
    const { handled, state } = shiftEnter('- A^');
    expect(handled).toBe(true);
    expect(show(state)).toBe('- A\n  ^');
  });

  it('indents to the content column of ordered items', () => {
    expect(show(shiftEnter('1. Eins^').state)).toBe('1. Eins\n   ^');
    expect(show(shiftEnter('10. Zehn^').state)).toBe('10. Zehn\n    ^');
  });

  it('indents nested task items to their content column', () => {
    expect(show(shiftEnter('- [ ] A\n  - [ ] B^').state)).toBe('- [ ] A\n  - [ ] B\n    ^');
  });

  it('splits text without leaving spaces around the break', () => {
    expect(show(shiftEnter('- Erste Zeile ^zweite Zeile').state)).toBe('- Erste Zeile\n  ^zweite Zeile');
    expect(show(shiftEnter('- Erste Zeile^ zweite Zeile').state)).toBe('- Erste Zeile\n  ^zweite Zeile');
  });

  it('continues from a continuation line', () => {
    expect(show(shiftEnter('- A\n  weiter^').state)).toBe('- A\n  weiter\n  ^');
  });

  it('keeps the blockquote prefix', () => {
    expect(show(shiftEnter('> - Q^').state)).toBe('> - Q\n>   ^');
  });

  it('replaces a selection', () => {
    expect(show(run(insertListLineBreak, createState('- A «weg»B')).state)).toBe('- A\n  ^B');
  });

  it('keeps the space after the marker of an empty item', () => {
    expect(show(shiftEnter('- ^').state)).toBe('- \n  ^');
  });

  it('leaves lines outside lists and the area before the marker to the default', () => {
    expect(shiftEnter('Text^').handled).toBe(false);
    expect(shiftEnter('  ^- A').handled).toBe(false);
  });

  it('is undone in a single step', () => {
    const before = createState('- Erste ^zweite');
    const after = run(insertListLineBreak, before).state;
    let undone = after;
    undo({ state: after, dispatch: (tr) => (undone = tr.state) });
    expect(show(undone)).toBe('- Erste ^zweite');
  });
});

describe('Shift+Enter through the editor keymap stack', () => {
  function pressShiftEnter(doc: string) {
    const state = createState(doc, [markdownEditorKeymapExtensions()]);
    let result = state;
    const view = { state, dispatch: (tr: Transaction) => (result = tr.state) } as any;
    for (const bindings of state.facet(keymap)) {
      for (const binding of bindings) {
        const command = binding.key === 'Shift-Enter' ? binding.run : binding.key === 'Enter' ? binding.shift : undefined;
        if (command?.(view)) return show(result);
      }
    }
    return show(result);
  }

  it('runs before the default newline-and-indent in list items', () => {
    expect(pressShiftEnter('- A^')).toBe('- A\n  ^');
  });

  it('falls back to the default outside lists', () => {
    expect(pressShiftEnter('Text^')).toBe('Text\n^');
  });
});

const enterOnContinuation = (doc: string) => run(insertItemFromContinuation, createState(doc));

describe('Enter on continuation lines of list items', () => {
  it('starts a new bullet item after a manual line break', () => {
    const { handled, state } = enterOnContinuation('- A\n  weiter^');
    expect(handled).toBe(true);
    expect(show(state)).toBe('- A\n  weiter\n- ^');
  });

  it('continues ordered lists with the next number and renumbers the rest', () => {
    expect(show(enterOnContinuation('1. A\n   weiter^\n2. B').state)).toBe('1. A\n   weiter\n2. ^\n3. B');
  });

  it('starts an unchecked task after a task item', () => {
    expect(show(enterOnContinuation('- [x] A\n  weiter^').state)).toBe('- [x] A\n  weiter\n- [ ] ^');
  });

  it('starts a nested item at the level of the continued item', () => {
    expect(show(enterOnContinuation('- A\n  - B\n    weiter^').state)).toBe('- A\n  - B\n    weiter\n  - ^');
  });

  it('turns the empty line right after Shift+Enter into the new item', () => {
    expect(show(enterOnContinuation('- A\n  ^').state)).toBe('- A\n- ^');
    expect(show(enterOnContinuation('1. A\n   ^').state)).toBe('1. A\n2. ^');
  });

  it('moves the text after the cursor into the new item', () => {
    expect(show(enterOnContinuation('- A\n  erste ^zweite').state)).toBe('- A\n  erste\n- ^zweite');
  });

  it('keeps the blockquote prefix', () => {
    expect(show(enterOnContinuation('> - Q\n>   weiter^').state)).toBe('> - Q\n>   weiter\n> - ^');
  });

  it('leaves marker lines, plain text and code in items to other commands', () => {
    expect(enterOnContinuation('- A^').handled).toBe(false);
    expect(enterOnContinuation('Text\nmehr^').handled).toBe(false);
    expect(enterOnContinuation('- A\n\n  ```\n  code^\n  ```').handled).toBe(false);
    expect(enterOnContinuation('- A\n^').handled).toBe(false);
  });

  it('is undone in a single step', () => {
    const before = createState('1. A\n   weiter^\n2. B');
    const after = run(insertItemFromContinuation, before).state;
    let undone = after;
    undo({ state: after, dispatch: (tr) => (undone = tr.state) });
    expect(show(undone)).toBe('1. A\n   weiter^\n2. B');
  });

  it('runs through the editor keymap stack after Shift+Enter', () => {
    const state = createState('- A^', [markdownEditorKeymapExtensions()]);
    const press = (s: EditorState, shift: boolean) => {
      let result = s;
      const view = { state: s, dispatch: (tr: Transaction) => (result = tr.state) } as any;
      for (const bindings of s.facet(keymap)) {
        for (const binding of bindings) {
          const command = shift
            ? binding.key === 'Shift-Enter' ? binding.run : binding.key === 'Enter' ? binding.shift : undefined
            : binding.key === 'Enter' ? binding.run : undefined;
          if (command?.(view)) return result;
        }
      }
      return result;
    };
    const afterBreak = press(state, true);
    expect(show(afterBreak)).toBe('- A\n  ^');
    expect(show(press(afterBreak, false))).toBe('- A\n- ^');
  });
});
