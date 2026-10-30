import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { createTagAutocompleteSource } from '../src/webviews/markdown/extensions/tagAutocomplete';

const tags = [
  { tag: 'backend', count: 3 },
  { tag: 'budget', count: 1 },
  { tag: 'projekt/alpha', count: 2 },
];
const source = createTagAutocompleteSource(() => tags);

function complete(doc: string, pos = doc.length) {
  const state = EditorState.create({ doc, extensions: [markdown()] });
  ensureSyntaxTree(state, state.doc.length, 1000);
  return source(new CompletionContext(state, pos, false));
}

describe('tag autocomplete', () => {
  it('suggests existing tags after # and a character, most used first', () => {
    const result = complete('Thema #b');
    expect(result?.from).toBe(6);
    expect(result?.options.map((o) => [o.label, o.detail])).toEqual([
      ['#backend', '3 Notizen'],
      ['#budget', '1 Notiz'],
      ['#projekt/alpha', '2 Notizen'],
    ]);
    expect(result!.options[0].boost!).toBeGreaterThan(result!.options[1].boost!);
  });

  it('opens right after a lone #, but not for headings or # inside a word', () => {
    expect(complete('#')?.options).toHaveLength(3);
    expect(complete('Text #')?.from).toBe(5);
    expect(complete('# ')).toBeNull();
    expect(complete('##')).toBeNull();
    expect(complete('plan.md#b')).toBeNull();
  });

  it('does not suggest in code or frontmatter', () => {
    expect(complete('Code `#b')).toBeNull();
    expect(complete('```\n#b')).toBeNull();
    expect(complete('---\ntags: #b\n---\nText', 12)).toBeNull();
  });

  it('leaves out the tag that is already typed completely', () => {
    expect(complete('#budget')?.options.map((o) => o.label)).not.toContain('#budget');
  });
});
