import { describe, it, expect } from 'vitest';
import { EditorState, TransactionSpec } from '@codemirror/state';
import { getSlashCommands } from '../src/webviews/markdown/extensions/slashCommands';

function run(doc: string, command: string) {
  const from = doc.lastIndexOf(command);
  const view = {
    state: EditorState.create({ doc, selection: { anchor: from + command.length } }),
    dispatch(spec: TransactionSpec) {
      view.state = view.state.update(spec).state;
    },
  };
  const completion = getSlashCommands().find((c) => c.label === command)!;
  (completion.apply as any)(view, completion, from, from + command.length);
  const text = view.state.doc.toString();
  const head = view.state.selection.main.head;
  return { text, withCursor: text.slice(0, head) + '|' + text.slice(head) };
}

const ID = /\^t-[a-z0-9]{6}/;

describe('/aufgabe and /task', () => {
  it('turns plain text into a linked task with the cursor after the title', () => {
    const { text, withCursor } = run('Angebot schicken /aufgabe', '/aufgabe');
    expect(text).toMatch(/^- \[ \] Angebot schicken \^t-[a-z0-9]{6}$/);
    expect(withCursor).toMatch(/^- \[ \] Angebot schicken\| \^t-/);
  });

  it('links an existing checkbox and keeps indentation and state', () => {
    expect(run('# Plan\n  - [ ] Folien bauen /task', '/task').text).toMatch(/^# Plan\n {2}- \[ \] Folien bauen \^t-[a-z0-9]{6}$/);
    expect(run('- [x] Fertig /task', '/task').text).toMatch(/^- \[x\] Fertig \^t-/);
  });

  it('turns a list item into a linked task and keeps a blockquote prefix', () => {
    expect(run('* Punkt /aufgabe', '/aufgabe').text).toMatch(/^\* \[ \] Punkt \^t-/);
    expect(run('> Zitat /aufgabe', '/aufgabe').text).toMatch(/^> - \[ \] Zitat \^t-/);
  });

  it('places the cursor before the ID on an empty line', () => {
    const { text, withCursor } = run('/aufgabe', '/aufgabe');
    expect(text).toMatch(/^- \[ \] {2}\^t-[a-z0-9]{6}$/);
    expect(withCursor).toMatch(/^- \[ \] \| \^t-/);
  });

  it('only removes the command on an already linked line', () => {
    expect(run('- [ ] Angebot ^t-7f3a9k /aufgabe', '/aufgabe').text).toBe('- [ ] Angebot ^t-7f3a9k');
  });

  it('creates IDs that do not occur in the document', () => {
    const { text } = run('- [ ] A ^t-aaaaaa\nNeu /aufgabe', '/aufgabe');
    const ids = text.match(new RegExp(ID.source, 'g'))!;
    expect(new Set(ids).size).toBe(2);
  });

  it('keeps /tasks as a plain checkbox', () => {
    expect(getSlashCommands().find((c) => c.label === '/tasks')!.apply).toBe('- [ ] ');
  });
});
