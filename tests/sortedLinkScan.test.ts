import { describe, it, expect } from 'vitest';
import { findSortedLinks } from '../src/services/sortedLinkScan';

describe('findSortedLinks', () => {
  it('finds link lines with the heading of their block', () => {
    const text = [
      '# Donnerstag',
      '',
      '## Call mit Anna',
      'Sentry meldet doppelte Events.',
      '',
      '-> [[projects/App-Launch/app-launch]]',
      '',
      '## Idee',
      'Dunkelmodus',
      '-> [[ projects/Website-Relaunch/design-system ]]',
    ].join('\n');

    expect(findSortedLinks(text)).toEqual([
      {
        line: 5,
        target: 'projects/App-Launch/app-launch',
        heading: 'Call mit Anna',
        headingLine: 2,
        anchorText: 'Sentry meldet doppelte Events.',
      },
      {
        line: 9,
        target: 'projects/Website-Relaunch/design-system',
        heading: 'Idee',
        headingLine: 7,
        anchorText: 'Dunkelmodus',
      },
    ]);
  });

  it('has no heading for paragraph blocks', () => {
    const [link] = findSortedLinks('# Titel\n\nErster Gedanke\n\n-> [[knowledge/erster]]\n');
    expect(link).toEqual({ line: 4, target: 'knowledge/erster', heading: undefined, headingLine: undefined, anchorText: 'Erster Gedanke' });
  });

  it('ignores link lines in fenced code and lines with more text', () => {
    expect(findSortedLinks('## A\n```\n-> [[x]]\n```\nSiehe -> [[y]]\n')).toEqual([]);
  });

  it('handles CRLF line endings', () => {
    expect(findSortedLinks('## A\r\ntext\r\n-> [[k/a]]\r\n').map((l) => l.line)).toEqual([2]);
  });
});
