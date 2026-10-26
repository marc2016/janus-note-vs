import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import {
  getListTree,
  findListItemAtLine,
  toListItemInfo,
  previousSiblingItem,
  parentItem,
  getListDepthAt,
} from '../src/webviews/markdown/lib/listStructure';

function setup(doc: string) {
  const state = EditorState.create({ doc, extensions: [markdown({ extensions: [Table] })] });
  const tree = getListTree(state, state.doc.length, 5000)!;
  const itemAt = (lineNo: number) => {
    const node = findListItemAtLine(state, tree, state.doc.line(lineNo));
    return node ? toListItemInfo(state, node) : null;
  };
  return { state, tree, itemAt };
}

describe('List Structure Helpers', () => {
  it.each([
    ['- Item', 0, 2],
    ['* Item', 0, 2],
    ['+ Item', 0, 2],
    ['1. Item', 0, 3],
    ['10. Item', 0, 4],
    ['1) Item', 0, 3],
    ['- [ ] Task', 0, 2],
  ])('computes marker and content columns for %j', (doc, indentCol, contentCol) => {
    const { itemAt } = setup(doc);
    const info = itemAt(1)!;
    expect(info.indentCol).toBe(indentCol);
    expect(info.contentCol).toBe(contentCol);
  });

  it('detects ordered vs unordered items', () => {
    const { itemAt } = setup('1. A\n\n- B');
    expect(itemAt(1)!.ordered).toBe(true);
    expect(itemAt(3)!.ordered).toBe(false);
  });

  it('returns null for blank and non-list lines', () => {
    const { itemAt } = setup('Text\n\n- A');
    expect(itemAt(1)).toBeNull();
    expect(itemAt(2)).toBeNull();
  });

  it('includes nested child items in the block range', () => {
    const { itemAt } = setup('- A\n  - B\n    - C\n- D');
    const a = itemAt(1)!;
    expect(a.startLine).toBe(1);
    expect(a.endLine).toBe(3);
    expect(itemAt(2)!.endLine).toBe(3);
  });

  it('resolves the innermost item for nested and continuation lines', () => {
    const { itemAt } = setup('- A\n  - B\n    continued\n- C');
    expect(itemAt(2)!.markText).toBe('-');
    expect(itemAt(2)!.indentCol).toBe(2);
    expect(itemAt(3)!.indentCol).toBe(2);
  });

  it('finds previous siblings and parents', () => {
    const { itemAt, state } = setup('1. A\n2. B\n   - C');
    const b = itemAt(2)!;
    const c = itemAt(3)!;
    expect(previousSiblingItem(b.node)!.from).toBe(0);
    expect(previousSiblingItem(itemAt(1)!.node)).toBeNull();
    expect(parentItem(c.node)!.from).toBe(state.doc.line(2).from);
    expect(parentItem(b.node)).toBeNull();
  });

  it('computes structural depth for mixed and wide markers', () => {
    const { state, tree } = setup('1. A\n   1. B\n      1. C\n10. D\n    - E\n      - F');
    const depthOfLine = (n: number) => {
      const line = state.doc.line(n);
      return getListDepthAt(state, tree, line.from + line.text.search(/\S/));
    };
    expect([1, 2, 3, 4, 5, 6].map(depthOfLine)).toEqual([0, 1, 2, 0, 1, 2]);
  });
});
