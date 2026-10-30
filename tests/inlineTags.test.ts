import { describe, it, expect } from 'vitest';
import { findInlineTags, frontmatterEnd } from '../src/services/markdownScan';
import { parseFrontmatter } from '../src/services/noteMetadataService';

const tags = (text: string) => findInlineTags(text, { bodyStart: parseFrontmatter(text).bodyStart }).map((t) => t.tag);

describe('findInlineTags', () => {
  it('finds tags in text, including nested ones', () => {
    expect(tags('Besprechung zu #backend und #projekt/alpha.')).toEqual(['backend', 'projekt/alpha']);
  });

  it('finds a tag at the start of a line with its range', () => {
    const [tag] = findInlineTags('Text\n#idee danach');
    expect(tag).toEqual({ tag: 'idee', start: 5, end: 10 });
  });

  it('ignores headings, numbers, link anchors, URLs, entities and inline code', () => {
    const text = [
      '# Überschrift',
      '## Zweite Ebene',
      'Issue #42',
      '[Abschnitt](plan.md#ziele)',
      '[[plan#L3]]',
      'https://example.com/#anker',
      'Farbe&#35;',
      '`#code`',
      '[Link mit #tag im Label](plan.md)',
    ].join('\n');
    expect(tags(text)).toEqual([]);
  });

  it('ignores tags in fenced code blocks and the frontmatter block', () => {
    const text = '---\ntitle: Plan\n# Kommentar #intern\n---\n\n```\n#backend\n```\nText';
    expect(tags(text)).toEqual([]);
  });

  it('accepts umlauts and drops trailing punctuation', () => {
    expect(tags('#Übergabe, #ideen- und #2026-planung')).toEqual(['Übergabe', 'ideen', '2026-planung']);
  });

  it('detects the frontmatter end like parseFrontmatter when no bodyStart is given', () => {
    for (const text of ['---\ntags: [a]\n---\n#b', '---\nx: 1\n...\n#b', '---\nunclosed\n#b', 'Kein Frontmatter #b']) {
      expect(frontmatterEnd(text)).toBe(parseFrontmatter(text).bodyStart);
    }
    expect(findInlineTags('---\n# Kommentar #intern\n---\n#b').map((t) => t.tag)).toEqual(['b']);
  });
});

