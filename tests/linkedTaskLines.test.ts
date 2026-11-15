import { describe, it, expect } from 'vitest';
import {
  linkedTaskIdRange,
  newLinkedTaskId,
  parseLinkedTaskLine,
  parseLinkedTaskLines,
  removeLinkedTaskId,
  rewriteLinkedTaskLine,
  withoutLinkedTaskLines,
} from '../src/services/linkedTaskLines';

describe('parsing linked task lines', () => {
  it('recognizes ID, title and done state', () => {
    expect(parseLinkedTaskLine('  - [x] Angebot schicken ^t-7f3a9k')).toEqual({
      id: 't-7f3a9k',
      title: 'Angebot schicken',
      done: true,
    });
    expect(parseLinkedTaskLine('- [ ] Offen ^t-000001')?.done).toBe(false);
    expect(parseLinkedTaskLine('> - [X] Im Zitat ^t-abcdef')?.done).toBe(true);
  });

  it('ignores lines that are not linked', () => {
    expect(parseLinkedTaskLine('- [ ] Angebot schicken')).toBeNull();
    expect(parseLinkedTaskLine('- Angebot ^t-7f3a9k')).toBeNull();
    expect(parseLinkedTaskLine('- [ ] Angebot ^t-7F3A9K')).toBeNull();
    expect(parseLinkedTaskLine('- [ ] Angebot ^t-7f3a9')).toBeNull();
  });

  it('skips fenced code and reports line numbers', () => {
    const text = '# Plan\n- [ ] Eins ^t-aaaaaa\n```\n- [ ] Beispiel ^t-000000\n```\n- [x] Zwei ^t-bbbbbb';
    expect(parseLinkedTaskLines(text)).toEqual([
      { id: 't-aaaaaa', title: 'Eins', done: false, line: 1 },
      { id: 't-bbbbbb', title: 'Zwei', done: true, line: 5 },
    ]);
  });

  it('reports an empty title as empty', () => {
    expect(parseLinkedTaskLine('- [ ]  ^t-7f3a9k')).toEqual({ id: 't-7f3a9k', title: '', done: false });
  });
});

describe('rewriting linked task lines', () => {
  it('changes the done state and title while keeping prefix and ID', () => {
    expect(rewriteLinkedTaskLine('  - [ ] Angebot ^t-7f3a9k', { done: true })).toBe('  - [x] Angebot ^t-7f3a9k');
    expect(rewriteLinkedTaskLine('> * [x] Alt ^t-7f3a9k', { title: 'Neu', done: false })).toBe(
      '> * [ ] Neu ^t-7f3a9k'
    );
  });

  it('removes the ID and finds its range', () => {
    expect(removeLinkedTaskId('- [ ] Angebot ^t-7f3a9k')).toBe('- [ ] Angebot');
    expect(linkedTaskIdRange('- [ ] Angebot ^t-7f3a9k')).toEqual({ from: 13, to: 23 });
    expect(linkedTaskIdRange('- [ ] Angebot')).toBeNull();
  });

  it('removes linked lines for AI extraction', () => {
    expect(withoutLinkedTaskLines('Text\n- [ ] Angebot ^t-7f3a9k\nMehr')).toBe('Text\nMehr');
  });
});

describe('new IDs', () => {
  it('has the expected format', () => {
    expect(newLinkedTaskId()).toMatch(/^t-[a-z0-9]{6}$/);
  });

  it('avoids IDs that already occur in the text', () => {
    const values = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    let i = 0;
    expect(newLinkedTaskId('- [ ] X ^t-000000', () => values[i++])).toBe('t-iiiiii');
  });
});
