import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection, Transaction, StateCommand } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import { history, undo } from '@codemirror/commands';
import { completionKeymap } from '@codemirror/autocomplete';
import {
  indentListOrLines,
  outdentListOrLines,
  listIndentationKeymap,
} from '../src/webviews/markdown/lib/listIndentation';
import { markdownEditorKeymap } from '../src/webviews/markdown/lib/editorKeymap';

/**
 * Creates a state from a document where `^` marks the cursor and `«`/`»` mark a selection.
 */
function createState(docWithCursor: string) {
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
    extensions: [markdown({ extensions: [Table] }), history()],
  });
}

function run(command: StateCommand, state: EditorState) {
  let result = state;
  const handled = command({
    state,
    dispatch: (tr: Transaction) => {
      result = tr.state;
    },
  });
  return { handled, state: result };
}

const tab = (doc: string) => run(indentListOrLines, createState(doc));
const shiftTab = (doc: string) => run(outdentListOrLines, createState(doc));

describe('List-aware Tab Indentation', () => {
  describe('Nesting with Tab', () => {
    it('nests a bullet item under its previous sibling by 2 spaces', () => {
      const { state, handled } = tab('- Parent\n- Ch^ild');
      expect(handled).toBe(true);
      expect(state.doc.toString()).toBe('- Parent\n  - Child');
      // Cursor keeps its position relative to the item text
      expect(state.selection.main.head).toBe(state.doc.toString().indexOf('ild'));
    });

    it('nests from any cursor position on the line, including the line start', () => {
      expect(tab('- Parent\n^- Child').state.doc.toString()).toBe('- Parent\n  - Child');
      expect(tab('- Parent\n- Child^').state.doc.toString()).toBe('- Parent\n  - Child');
    });

    it('uses the parent marker width (3 spaces) for ordered lists', () => {
      const { state } = tab('1. First\n2. Sec^ond');
      expect(state.doc.toString()).toBe('1. First\n   1. Second');
    });

    it('uses 4 spaces under wide ordered markers', () => {
      const { state } = tab('10. First\n11. Sec^ond');
      expect(state.doc.toString()).toBe('10. First\n    1. Second');
    });

    it('nests task items like bullets', () => {
      const { state } = tab('- [ ] Task\n- [ ] Sub^task');
      expect(state.doc.toString()).toBe('- [ ] Task\n  - [ ] Subtask');
    });

    it('moves child items along with their parent', () => {
      const { state } = tab('- A\n- B^\n  - B1\n    - B2\n- C');
      expect(state.doc.toString()).toBe('- A\n  - B\n    - B1\n      - B2\n- C');
    });

    it('joins an existing sub-list of the previous sibling', () => {
      const { state } = tab('- A\n  - A1\n- B^');
      expect(state.doc.toString()).toBe('- A\n  - A1\n  - B');
    });

    it('nests from a continuation line of the item', () => {
      const { state } = tab('- A\n- B\n  more^ text');
      expect(state.doc.toString()).toBe('- A\n  - B\n    more text');
    });

    it('indents lists inside blockquotes after the quote marker', () => {
      const { state } = tab('> - A\n> - B^');
      expect(state.doc.toString()).toBe('> - A\n>   - B');
    });
  });

  describe('Outdenting with Shift-Tab', () => {
    it('moves a nested bullet item to its parent level', () => {
      const { state } = shiftTab('- Parent\n  - Ch^ild');
      expect(state.doc.toString()).toBe('- Parent\n- Child');
    });

    it('moves children along when outdenting', () => {
      const { state } = shiftTab('- A\n  - B^\n    - B1');
      expect(state.doc.toString()).toBe('- A\n- B\n  - B1');
    });

    it('outdents an ordered item and renumbers the destination list', () => {
      const { state } = shiftTab('1. A\n   1. B^\n2. C');
      expect(state.doc.toString()).toBe('1. A\n2. B\n3. C');
    });

    it('outdents an item nested under a wide marker', () => {
      const { state } = shiftTab('10. A\n    - B^');
      expect(state.doc.toString()).toBe('10. A\n- B');
    });
  });

  describe('List boundaries', () => {
    it('leaves the document unchanged on the first item but keeps focus', () => {
      const { state, handled } = tab('- Fi^rst\n- Second');
      expect(handled).toBe(true);
      expect(state.doc.toString()).toBe('- First\n- Second');
    });

    it('leaves the document unchanged when outdenting a top-level item', () => {
      const { state, handled } = shiftTab('- A\n- B^');
      expect(handled).toBe(true);
      expect(state.doc.toString()).toBe('- A\n- B');
    });
  });

  describe('Renumbering ordered lists', () => {
    it('starts a new sub-list at 1 and renumbers following items', () => {
      const { state } = tab('1. First\n2. Sec^ond\n3. Third');
      expect(state.doc.toString()).toBe('1. First\n   1. Second\n2. Third');
    });

    it('continues an existing ordered sub-list', () => {
      const { state } = tab('1. A\n   1. A1\n2. B^\n3. C');
      expect(state.doc.toString()).toBe('1. A\n   1. A1\n   2. B\n2. C');
    });

    it('preserves the list start number and delimiter', () => {
      const { state } = tab('5) A\n6) B^\n7) C');
      expect(state.doc.toString()).toBe('5) A\n   1) B\n6) C');
    });

    it('renumbers items left behind when outdenting from the middle of a sub-list', () => {
      const { state } = shiftTab('1. A\n   1. A1\n   2. A2^\n   3. A3\n2. B');
      expect(state.doc.toString()).toBe('1. A\n   1. A1\n2. A2\n   1. A3\n3. B');
    });

    it('does not touch unrelated ordered lists', () => {
      const doc = '1. X\n1. Y\n\nText\n\n1. A\n2. B^';
      const { state } = tab(doc);
      expect(state.doc.toString()).toBe('1. X\n1. Y\n\nText\n\n1. A\n   1. B');
    });
  });

  describe('Multi-line selections', () => {
    it('nests a run of selected siblings under the preceding item', () => {
      const { state } = tab('- A\n- «B\n- C\n- D»');
      expect(state.doc.toString()).toBe('- A\n  - B\n  - C\n  - D');
      expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe(
        'B\n  - C\n  - D'
      );
    });

    it('outdents all selected nested items', () => {
      const { state } = shiftTab('- A\n  - «B\n  - C»');
      expect(state.doc.toString()).toBe('- A\n- B\n- C');
    });

    it('undoes a full indent including renumbering in a single step', () => {
      const original = '1. A\n2. «B\n3. C»\n4. D';
      const { state } = tab(original);
      expect(state.doc.toString()).toBe('1. A\n   1. B\n   2. C\n2. D');
      const undone = run(undo, state).state;
      expect(undone.doc.toString()).toBe(original.replace('«', '').replace('»', ''));
    });
  });

  describe('Plain text fallback', () => {
    it('indents a non-list line by 2 spaces', () => {
      expect(tab('Some ^text').state.doc.toString()).toBe('  Some text');
    });

    it('outdents up to 2 spaces of leading indentation', () => {
      expect(shiftTab('    Some ^text').state.doc.toString()).toBe('  Some text');
      expect(shiftTab(' Some ^text').state.doc.toString()).toBe('Some text');
    });

    it('indents plain lines in a mixed selection alongside list items', () => {
      const { state } = tab('- A\n- «B\nplain»');
      expect(state.doc.toString()).toBe('- A\n  - B\n  plain');
    });

    it('never inserts tab characters', () => {
      for (const doc of ['Some ^text', '- A\n- B^', '1. A\n2. B^']) {
        expect(tab(doc).state.doc.toString()).not.toContain('\t');
      }
    });
  });

  describe('Precedence', () => {
    it('does not handle Tab inside a table so table navigation keeps priority', () => {
      const { handled, state } = tab('| A | B |\n| --- | --- |\n| 1^ | 2 |');
      expect(handled).toBe(false);
      expect(state.doc.toString()).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
    });
  });
});

describe('Editor Keymap Integration', () => {
  // Mirrors CodeMirror's keymap lookup: bindings for a key are tried in order until one handles it.
  function pressKey(state: EditorState, key: 'Tab' | 'Shift-Tab') {
    let result = state;
    const view = { state, dispatch: (tr: Transaction) => (result = tr.state) } as any;
    for (const binding of markdownEditorKeymap) {
      const command = key === 'Shift-Tab' && binding.key === 'Tab' ? binding.shift : binding.key === key ? binding.run : undefined;
      if (command && command(view)) return { handled: true, state: result };
    }
    return { handled: false, state: result };
  }

  it('handles Tab and Shift-Tab on list items through the editor keymap stack', () => {
    const nested = pressKey(createState('- Parent\n- Ch^ild'), 'Tab');
    expect(nested.handled).toBe(true);
    expect(nested.state.doc.toString()).toBe('- Parent\n  - Child');

    const outdented = pressKey(nested.state, 'Shift-Tab');
    expect(outdented.handled).toBe(true);
    expect(outdented.state.doc.toString()).toBe('- Parent\n- Child');
  });

  it('binds Tab only through the list indentation keymap', () => {
    const tabBindings = markdownEditorKeymap.filter((b) => b.key === 'Tab' || b.key === 'Shift-Tab');
    expect(tabBindings).toEqual([...listIndentationKeymap]);
  });

  it('leaves Tab unbound in the autocomplete keymap so open completion popups are not overridden', () => {
    expect(completionKeymap.some((b) => b.key === 'Tab' || b.key === 'Shift-Tab')).toBe(false);
  });
});
