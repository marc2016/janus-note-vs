import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection, Transaction } from '@codemirror/state';
import { minimalChange, DocumentSync } from '../src/webviews/markdown/lib/documentSync';

/** Small harness mimicking the editor: local typing, sending, and receiving host updates. */
function createEditor(initial: string) {
  const sync = new DocumentSync();
  sync.reset(initial);
  let state = EditorState.create({ doc: initial, selection: EditorSelection.cursor(initial.length) });

  return {
    sync,
    get state() {
      return state;
    },
    type(text: string, at: number = state.selection.main.head) {
      const tr = state.update({
        changes: { from: at, insert: text },
        selection: EditorSelection.cursor(at + text.length),
      });
      sync.recordLocal(tr.changes);
      state = tr.state;
    },
    send() {
      return sync.takeOutgoing(state.doc.toString());
    },
    receive(content: string, ackSeq?: number) {
      const changes = sync.applyRemote(content, ackSeq);
      if (changes) {
        state = state.update({ changes, annotations: Transaction.remote.of(true) }).state;
      }
      return changes;
    },
    setCursor(pos: number) {
      state = state.update({ selection: EditorSelection.cursor(pos) }).state;
    },
  };
}

describe('minimalChange', () => {
  it('returns null for identical texts', () => {
    expect(minimalChange('abc', 'abc')).toBeNull();
  });

  it('detects insertions, deletions and replacements', () => {
    expect(minimalChange('abc', 'abXc')).toEqual({ from: 2, to: 2, insert: 'X' });
    expect(minimalChange('abXc', 'abc')).toEqual({ from: 2, to: 3, insert: '' });
    expect(minimalChange('hello world', 'hello there')).toEqual({ from: 6, to: 11, insert: 'there' });
    expect(minimalChange('', 'new')).toEqual({ from: 0, to: 0, insert: 'new' });
  });

  it('handles repeated characters at the boundary', () => {
    const change = minimalChange('aaa', 'aaaa')!;
    const applied = 'aaa'.slice(0, change.from) + change.insert + 'aaa'.slice(change.to);
    expect(applied).toBe('aaaa');
  });

  it('never splits surrogate pairs', () => {
    const change = minimalChange('a😀b', 'a😃b')!;
    expect(change.insert).toBe('😃');
    expect(change.to - change.from).toBe(2);
  });
});

describe('DocumentSync', () => {
  it('keeps characters typed while an echo of the sent edit arrives', () => {
    const editor = createEditor('');
    editor.type('abc');
    const { seq } = editor.send();
    editor.type('d');

    // Echo of the sent text (host already applied seq) must not revert "d"
    expect(editor.receive('abc', seq)).toBeNull();
    expect(editor.state.doc.toString()).toBe('abcd');
  });

  it('ignores stale updates produced before the latest sent edit was applied', () => {
    const editor = createEditor('abc');
    editor.type('d');
    const first = editor.send();
    editor.type('e');
    editor.send();

    expect(editor.receive('abcd', first.seq)).toBeNull();
    expect(editor.state.doc.toString()).toBe('abcde');
  });

  it('applies external changes minimally and keeps the cursor at the same text position', () => {
    const initial = 'Para 1\n\nPara 2\n\nPara 3';
    const editor = createEditor(initial);
    const cursor = initial.indexOf('3');
    editor.setCursor(cursor);

    editor.receive('Para one\n\nPara 2\n\nPara 3', 0);

    expect(editor.state.doc.toString()).toBe('Para one\n\nPara 2\n\nPara 3');
    const head = editor.state.selection.main.head;
    expect(editor.state.sliceDoc(head, head + 1)).toBe('3');
  });

  it('rebases external changes onto unsent local edits', () => {
    const editor = createEditor('Title\n\nBody');
    editor.type(' typed', editor.state.doc.length); // local, not sent yet

    // External change to the title, based on the last synced text
    editor.receive('New Title\n\nBody', 0);

    expect(editor.state.doc.toString()).toBe('New Title\n\nBody typed');
    expect(editor.sync.hasPending).toBe(true);

    // The next outgoing edit contains both
    expect(editor.send().content).toBe('New Title\n\nBody typed');
  });

  it('treats a missing ackSeq as current', () => {
    const editor = createEditor('abc');
    expect(editor.receive('abcX')).not.toBeNull();
    expect(editor.state.doc.toString()).toBe('abcX');
  });

  it('starts over on reset', () => {
    const editor = createEditor('abc');
    editor.type('d');
    editor.sync.reset('fresh');
    expect(editor.sync.hasPending).toBe(false);
  });

  it('records only local transactions so typing during an echo is never lost', () => {
    const sync = new DocumentSync();
    sync.reset('');
    let state = EditorState.create({ doc: '' });
    const apply = (spec: Parameters<EditorState['update']>[0]) => {
      const tr = state.update(spec);
      state = tr.state;
      return tr;
    };

    // User types "abc" (local) and the edit is sent
    expect(sync.recordLocalTransactions([apply({ changes: { from: 0, insert: 'abc' } })])).toBe(true);
    const { seq } = sync.takeOutgoing(state.doc.toString());

    // User keeps typing "d" before the host processed the edit
    sync.recordLocalTransactions([apply({ changes: { from: 3, insert: 'd' } })]);

    // An echo arrives; a remote transaction would not be recorded as local
    const echo = sync.applyRemote('abc', seq);
    expect(echo).toBeNull();
    const remoteTr = apply({ changes: { from: 0, insert: '' }, annotations: Transaction.remote.of(true) });
    expect(sync.recordLocalTransactions([remoteTr])).toBe(false);

    expect(state.doc.toString()).toBe('abcd');
    expect(sync.takeOutgoing(state.doc.toString()).content).toBe('abcd');
  });
});

