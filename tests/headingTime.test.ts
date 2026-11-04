import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState, Extension, TransactionSpec } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';
import { headingMarkers, headingTime, insertHeadingTime } from '../src/webviews/markdown/extensions/headingTime';

function fakeView(doc: string, extensions: Extension = headingTime()) {
  const view = {
    state: EditorState.create({ doc, selection: { anchor: doc.length }, extensions: [history(), extensions] }),
    dispatch(spec: TransactionSpec) {
      view.state = view.state.update(spec).state;
    },
  };
  return view;
}

type View = ReturnType<typeof fakeView>;

/** Types `text` character by character at the cursor, like the keyboard does. */
function type(view: View, text: string, userEvent = 'input.type') {
  for (const ch of text) {
    const pos = view.state.selection.main.head;
    view.dispatch({ changes: { from: pos, insert: ch }, selection: { anchor: pos + 1 }, userEvent });
  }
}

function at(hours: number, minutes: number) {
  vi.setSystemTime(new Date(2026, 10, 4, hours, minutes));
}

const enter = (view: View) => insertHeadingTime(view as any);

afterEach(() => {
  vi.useRealTimers();
});

describe('heading time in daily notes', () => {
  it('appends the time the heading was started when Enter is pressed at its end', () => {
    vi.useFakeTimers();
    const view = fakeView('# Mittwoch\n\n');
    at(14, 32);
    type(view, '## Call mit Anna');
    at(14, 35);
    expect(enter(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('# Mittwoch\n\n## Call mit Anna (14:32)\n');
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
    expect(headingMarkers(view.state)).toHaveLength(0);
  });

  it('undoes the time and the line break in one step', () => {
    vi.useFakeTimers();
    at(9, 5);
    const view = fakeView('');
    type(view, '## Idee');
    enter(view);
    undo(view as any);
    expect(view.state.doc.toString()).toBe('## Idee');
  });

  it('works for # headings and headings from the /h2 completion, but not for ### and deeper', () => {
    vi.useFakeTimers();
    at(8, 0);
    const view = fakeView('');
    view.dispatch({ changes: { from: 0, insert: '## ' }, selection: { anchor: 3 }, userEvent: 'input.complete' });
    type(view, 'Aus Slash');
    expect(enter(view)).toBe(true);
    type(view, '# Titel');
    expect(enter(view)).toBe(true);
    type(view, '### Tiefer');
    expect(enter(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('## Aus Slash (08:00)\n# Titel (08:00)\n### Tiefer');
  });

  it('forgets a heading that becomes a ### heading', () => {
    const view = fakeView('');
    type(view, '## Idee');
    view.dispatch({ changes: { from: 0, insert: '#' }, userEvent: 'input.type' });
    expect(headingMarkers(view.state)).toHaveLength(0);
  });

  it('leaves headings alone that existed when the note was opened', () => {
    const view = fakeView('## Notizen');
    expect(enter(view)).toBe(false);
    type(view, ' heute');
    expect(enter(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('## Notizen heute');
  });

  it('does nothing for Enter in the middle of the heading or without heading text', () => {
    const view = fakeView('');
    type(view, '## Call mit Anna');
    view.dispatch({ selection: { anchor: 7 } });
    expect(enter(view)).toBe(false);

    const empty = fakeView('');
    type(empty, '## ');
    expect(enter(empty)).toBe(false);
  });

  it('does not add the time again after the user deleted it', () => {
    vi.useFakeTimers();
    at(10, 10);
    const view = fakeView('');
    type(view, '## Call');
    enter(view);
    const line = view.state.doc.line(1);
    view.dispatch({ changes: { from: line.from + '## Call'.length, to: line.to }, userEvent: 'delete' });
    view.dispatch({ selection: { anchor: view.state.doc.line(1).to } });
    expect(enter(view)).toBe(false);
    expect(view.state.doc.line(1).text).toBe('## Call');
  });

  it('skips headings that already end with a time and pasted headings', () => {
    const view = fakeView('');
    type(view, '## Termin (11:00)');
    expect(enter(view)).toBe(false);

    const pasted = fakeView('');
    pasted.dispatch({ changes: { from: 0, insert: '## Eingefügt' }, selection: { anchor: 12 }, userEvent: 'input.paste' });
    expect(enter(pasted)).toBe(false);
  });

  it('is inactive when the extension is not enabled (not a daily note)', () => {
    const view = fakeView('', []);
    type(view, '## Idee');
    expect(enter(view)).toBe(false);
  });

  it('forgets a heading that is turned back into normal text', () => {
    const view = fakeView('');
    type(view, '## Idee');
    view.dispatch({ changes: { from: 0, to: 3 }, userEvent: 'delete' });
    expect(headingMarkers(view.state)).toHaveLength(0);
  });
});
