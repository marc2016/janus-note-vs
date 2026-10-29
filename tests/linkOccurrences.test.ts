import { describe, it, expect } from 'vitest';
import { findLinkOccurrences } from '../src/services/noteLinkService';

const paths = (text: string, options?: { includeImages?: boolean }) =>
  findLinkOccurrences(text, options).map((o) => o.path);

describe('findLinkOccurrences', () => {
  it('returns the path part of wiki-links with alias, anchor and line suffixes', () => {
    const text = '[[plan]] [[plan|b]] [[plan#L3]] [[plan:3]] [[ plan ]]';
    const occurrences = findLinkOccurrences(text);

    expect(occurrences.map((o) => o.path)).toEqual(['plan', 'plan', 'plan', 'plan', 'plan']);
    expect(occurrences[1].alias).toBe('b');
    for (const o of occurrences) {
      expect(text.slice(o.pathStart, o.pathEnd)).toBe('plan');
      expect(o.type).toBe('wiki');
    }
  });

  it('returns the path part of Markdown links with anchor, title and ./ prefix', () => {
    const text = '[t](a.md#x) [u](./b.md) [v](c.md "Titel") [w](d.md:12)';
    const occurrences = findLinkOccurrences(text);

    expect(occurrences.map((o) => o.path)).toEqual(['a.md', './b.md', 'c.md', 'd.md']);
    expect(occurrences.map((o) => o.label)).toEqual(['t', 'u', 'v', 'w']);
    for (const o of occurrences) {
      expect(text.slice(o.pathStart, o.pathEnd)).toBe(o.path);
      expect(o.type).toBe('markdown');
    }
  });

  it('returns repeated links and their 1-based lines', () => {
    const text = 'erste [[a]]\nzweite [[a]]\n\n[x](a.md)';
    const occurrences = findLinkOccurrences(text);

    expect(occurrences.map((o) => [o.path, o.line])).toEqual([
      ['a', 1],
      ['a', 2],
      ['a.md', 4],
    ]);
  });

  it('ignores external, anchor-only and image targets by default', () => {
    const text = '[w](https://example.com) [m](mailto:a@b.de) [o](#oben) ![Bild](bild.png) [[#x]]';
    expect(paths(text)).toEqual([]);
  });

  it('includes images when requested', () => {
    const text = '![Skizze](assets/skizze.png) ![](leer.png "Titel") [l](a.md)';
    const occurrences = findLinkOccurrences(text, { includeImages: true });

    expect(occurrences.map((o) => [o.type, o.path, o.label])).toEqual([
      ['image', 'assets/skizze.png', 'Skizze'],
      ['image', 'leer.png', ''],
      ['markdown', 'a.md', 'l'],
    ]);
  });

  it('skips links in fenced code blocks and inline code spans', () => {
    const text = [
      'Absatz [[kickoff]]',
      '```md',
      '[[kickoff]]',
      '```',
      '~~~',
      '[k](kickoff.md)',
      '~~~',
      'Inline `[[kickoff]]` und ``[k](kickoff.md)`` danach [[kickoff]]',
    ].join('\n');

    expect(findLinkOccurrences(text).map((o) => [o.path, o.line])).toEqual([
      ['kickoff', 1],
      ['kickoff', 8],
    ]);
  });

  it('treats an unclosed fence as code until the end', () => {
    expect(paths('[[a]]\n```\n[[b]]')).toEqual(['a']);
  });
});
