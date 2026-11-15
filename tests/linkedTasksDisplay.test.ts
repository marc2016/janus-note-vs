import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import { buildLinkedTaskDecorations, keepCursorBeforeTaskId } from '../src/webviews/markdown/extensions/linkedTasks';
import { insertListLineBreak, listEnterKeymap } from '../src/webviews/markdown/lib/listIndentation';
import { syntaxVisibilityFacet, SyntaxVisibilityMode } from '../src/webviews/markdown/extensions/livePreview';

const doc = '# Plan\n- [ ] Angebot schicken ^t-7f3a9k\n```\n- [ ] Beispiel ^t-000000\n```';

function decorations(mode: SyntaxVisibilityMode, cursor: number) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ extensions: [Table] }), syntaxVisibilityFacet.of(mode)],
  });
  const result: Array<{ replaced: string | null; at: number }> = [];
  buildLinkedTaskDecorations(state, [{ from: 0, to: state.doc.length }]).between(0, state.doc.length, (from, to) => {
    result.push({ replaced: from === to ? null : state.doc.sliceString(from, to), at: from });
  });
  return result;
}

const lineEnd = doc.indexOf('^t-7f3a9k') + '^t-7f3a9k'.length;

describe('linked task line display', () => {
  it('hides the ID behind the marker in auto mode when the cursor is elsewhere', () => {
    expect(decorations('auto', 0)).toEqual([{ replaced: ' ^t-7f3a9k', at: doc.indexOf(' ^t-7f3a9k') }]);
  });

  it('keeps the ID hidden in auto mode when the cursor is on the line', () => {
    expect(decorations('auto', lineEnd - 3)[0].replaced).toBe(' ^t-7f3a9k');
  });

  it('always hides the ID in hidden mode and always shows it in visible mode', () => {
    expect(decorations('hidden', lineEnd - 3)[0].replaced).toBe(' ^t-7f3a9k');
    expect(decorations('visible', 0)).toEqual([{ replaced: null, at: lineEnd }]);
  });

  it('ignores linked-looking lines in fenced code', () => {
    expect(decorations('hidden', 0)).toHaveLength(1);
  });
});

describe('cursor in front of the hidden task ID', () => {
  const text = '- [ ] Angebot schicken ^t-7f3a9k\nWeiter';
  const idFrom = text.indexOf(' ^t-');
  const lineTo = text.indexOf('\n');
  const create = (mode: SyntaxVisibilityMode, cursor: number) =>
    EditorState.create({
      doc: text,
      selection: { anchor: cursor },
      extensions: [markdown({ extensions: [Table] }), syntaxVisibilityFacet.of(mode), keepCursorBeforeTaskId],
    });

  it('moves a cursor placed behind the ID to the end of the title', () => {
    const state = create('auto', 0).update({ selection: { anchor: lineTo } }).state;
    expect(state.selection.main.head).toBe(idFrom);
  });

  it('types in front of the ID', () => {
    let state = create('auto', 0).update({ selection: { anchor: lineTo } }).state;
    state = state.update(state.replaceSelection('!')).state;
    expect(state.doc.line(1).text).toBe('- [ ] Angebot schicken! ^t-7f3a9k');
  });

  it('moves on to the next line with Arrow Right from the end of the title', () => {
    const state = create('auto', idFrom).update({ selection: { anchor: lineTo } }).state;
    expect(state.selection.main.head).toBe(lineTo + 1);
  });

  it('leaves the cursor alone in visible mode', () => {
    expect(create('visible', 0).update({ selection: { anchor: lineTo } }).state.selection.main.head).toBe(lineTo);
  });

  function run(command: (t: any) => boolean, state: EditorState) {
    let result = state;
    command({ state, dispatch: (tr: any) => (result = tr.state) });
    return result.doc.toString();
  }

  it('keeps the ID on its line with Enter and Shift+Enter at the end of the title', () => {
    const enter = listEnterKeymap.find((b) => b.key === 'Enter')!.run as any;
    expect(run(enter, create('auto', idFrom))).toBe('- [ ] Angebot schicken ^t-7f3a9k\n- [ ] \nWeiter');
    expect(run(insertListLineBreak, create('auto', idFrom))).toBe('- [ ] Angebot schicken ^t-7f3a9k\n  \nWeiter');
  });

  it('keeps the cursor after the checkbox space on an empty linked line and types there', () => {
    const empty = '- [ ]  ^t-7f3a9k';
    let state = EditorState.create({
      doc: empty,
      selection: { anchor: '- [ ] '.length },
      extensions: [markdown({ extensions: [Table] }), syntaxVisibilityFacet.of('auto'), keepCursorBeforeTaskId],
    });
    state = state.update(state.replaceSelection('s')).state;
    state = state.update(state.replaceSelection('p')).state;
    expect(state.doc.toString()).toBe('- [ ] sp ^t-7f3a9k');
  });

  it('keeps spaces typed in the title', () => {
    let state = EditorState.create({
      doc: '- [ ]  ^t-7f3a9k',
      selection: { anchor: '- [ ] '.length },
      extensions: [markdown({ extensions: [Table] }), syntaxVisibilityFacet.of('auto'), keepCursorBeforeTaskId],
    });
    for (const ch of 'Sprint Review') state = state.update(state.replaceSelection(ch)).state;
    expect(state.doc.toString()).toBe('- [ ] Sprint Review ^t-7f3a9k');
  });
});

