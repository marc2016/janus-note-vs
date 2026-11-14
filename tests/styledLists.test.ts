import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import { buildListDecorations } from '../src/webviews/markdown/extensions/styledLists';

interface LineInfo {
  line: number;
  classes: string;
  style: string;
  /** Source text of ranges replaced without a widget (hidden). */
  hidden: string[];
  /** Source text of ranges replaced by a widget. */
  widgets: string[];
  /** Source text and class of mark decorations. */
  marks: string[];
}

function decorate(doc: string): Map<number, LineInfo> {
  const state = EditorState.create({ doc, extensions: [markdown({ extensions: [Table] })] });
  const lines = new Map<number, LineInfo>();
  const get = (pos: number) => {
    const n = state.doc.lineAt(pos).number;
    if (!lines.has(n)) lines.set(n, { line: n, classes: '', style: '', hidden: [], widgets: [], marks: [] });
    return lines.get(n)!;
  };
  buildListDecorations(state, [{ from: 0, to: state.doc.length }]).between(0, state.doc.length, (from, to, deco) => {
    const spec = deco.spec as any;
    const info = get(from);
    // Line decorations are zero-length at the line start; marks and replacements cover text
    if (from === to && spec.class) {
      info.classes = spec.class;
      info.style = spec.attributes?.style ?? '';
    } else if (spec.class) {
      info.marks.push(`${spec.class}:${state.doc.sliceString(from, to)}`);
    } else if (spec.widget) {
      info.widgets.push(state.doc.sliceString(from, to));
    } else {
      info.hidden.push(state.doc.sliceString(from, to));
    }
  });
  return lines;
}

describe('list decorations for aligned text', () => {
  it('gives a bullet line the hanging indent variables and replaces marker and space', () => {
    const line = decorate('- Item').get(1)!;
    expect(line.classes).toContain('cm-list-item');
    expect(line.style).toBe('--cm-list-pad: 0.5rem; --cm-list-marker: 1.25rem');
    expect(line.widgets).toEqual(['- ']);
    expect(line.hidden).toEqual([]);
  });

  it('hides leading spaces of nested items and pads by level only', () => {
    const lines = decorate('- A\n  - B\n- C\n    - D');
    expect(lines.get(2)!.hidden).toEqual(['  ']);
    expect(lines.get(2)!.style).toContain('--cm-list-pad: 1.75rem');
    expect(lines.get(4)!.hidden).toEqual(['    ']);
    expect(lines.get(4)!.style).toBe(lines.get(2)!.style);
  });

  it('uses a fixed dash slot plus the checkbox width for task items', () => {
    const line = decorate('- [ ] Task').get(1)!;
    expect(line.style).toContain('--cm-list-marker: calc(1.25rem + 20px)');
    expect(line.marks).toEqual(['cm-task-list-dash:- ']);
    expect(line.hidden).toEqual([' ']);
  });

  it('sizes ordered markers by their length and hides the following space', () => {
    const one = decorate('1. Eins').get(1)!;
    expect(one.style).toContain('--cm-list-marker: calc(2ch + 0.5em)');
    expect(one.marks).toEqual(['cm-ordered-list-mark:1.']);
    expect(one.hidden).toEqual([' ']);

    const ten = decorate('10. Zehn').get(1)!;
    expect(ten.style).toContain('--cm-list-marker: calc(3ch + 0.5em)');
  });

  it('aligns continuation lines with the item text', () => {
    const lines = decorate('- A\n  weiter');
    const cont = lines.get(2)!;
    expect(cont.classes).toContain('cm-list-continuation');
    expect(cont.classes).not.toContain('cm-list-item');
    expect(cont.style).toBe(lines.get(1)!.style);
    expect(cont.hidden).toEqual(['  ']);
  });

  it('aligns continuation lines of nested and task items', () => {
    const nested = decorate('- A\n  - B\n    weiter');
    expect(nested.get(3)!.style).toBe(nested.get(2)!.style);

    const task = decorate('- [ ] A\n  weiter');
    expect(task.get(2)!.style).toContain('--cm-list-marker: calc(1.25rem + 20px)');
  });

  it('treats an indented empty line inside an item as continuation', () => {
    const lines = decorate('- A\n  ');
    expect(lines.get(2)!.classes).toContain('cm-list-continuation');
    expect(lines.get(2)!.hidden).toEqual(['  ']);
  });

  it('leaves code blocks, plain paragraphs and blockquote lists alone', () => {
    const lines = decorate('- A\n\n  ```\n  code\n  ```\n\nText\n  more\n\n> - Q\n>   weiter');
    for (const n of [3, 4, 5, 7, 8, 10, 11]) {
      expect(lines.get(n)).toBeUndefined();
    }
  });
});
