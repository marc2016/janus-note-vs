import { describe, it, expect } from 'vitest';
import { rewriteRelativePaths } from '../src/services/aiInboxSorterService';

const ROOT = '/notes';
const existing = new Set(['/notes/assets/skizze.png', '/notes/knowledge/plan.md']);
const exists = async (p: string) => existing.has(p);
const rewrite = (text: string, toDir: string) => rewriteRelativePaths(text, ROOT, toDir, exists);

describe('rewriteRelativePaths', () => {
  it('rewrites an image moved two levels deeper', async () => {
    expect(await rewrite('![Skizze](assets/skizze.png)', '/notes/projects/app')).toBe(
      '![Skizze](../../assets/skizze.png)'
    );
  });

  it('keeps anchor and title of a link', async () => {
    expect(await rewrite('[Abschnitt](knowledge/plan.md#ziele "Ziele")', '/notes/knowledge')).toBe(
      '[Abschnitt](plan.md#ziele "Ziele")'
    );
  });

  it('keeps line suffixes', async () => {
    expect(await rewrite('[Plan](knowledge/plan.md#L4) [Plan](knowledge/plan.md:7)', '/notes/meetings')).toBe(
      '[Plan](../knowledge/plan.md#L4) [Plan](../knowledge/plan.md:7)'
    );
  });

  it('drops the ./ prefix when the path leaves the folder', async () => {
    expect(await rewrite('[Plan](./knowledge/plan.md)', '/notes/meetings')).toBe('[Plan](../knowledge/plan.md)');
  });

  it('leaves wiki-links, external and anchor-only links unchanged', async () => {
    const text = '[[plan]] [[knowledge/plan]] [Docs](https://example.com/docs) [Oben](#oben)';
    expect(await rewrite(text, '/notes/projects/app')).toBe(text);
  });

  it('leaves unresolved and absolute paths unchanged', async () => {
    const text = '[Später](ideen/später.md) [Abs](/notes/knowledge/plan.md)';
    expect(await rewrite(text, '/notes/projects/app')).toBe(text);
  });

  it('leaves links in code unchanged', async () => {
    const text = '```md\n[Plan](knowledge/plan.md)\n```\nInline `[Plan](knowledge/plan.md)` hier';
    expect(await rewrite(text, '/notes/projects/app')).toBe(text);
  });

  it('returns the text unchanged for a target in the notes root', async () => {
    const text = '[Plan](knowledge/plan.md)';
    expect(await rewrite(text, '/notes')).toBe(text);
  });

  it('changes nothing outside the rewritten path ranges', async () => {
    const text = [
      '## Sync: [Plan](knowledge/plan.md)',
      'Text mit   Leerzeichen und **fett**.',
      '- Liste ![Skizze](assets/skizze.png "Titel")',
      '```js',
      'const a = "[x](knowledge/plan.md)";',
      '```',
      '1. [[plan]] und [Docs](https://example.com)',
    ].join('\n');
    const expected = text
      .replace('](knowledge/plan.md)', '](../../knowledge/plan.md)')
      .replace('](assets/skizze.png', '](../../assets/skizze.png');

    expect(await rewrite(text, '/notes/projects/app')).toBe(expected);
  });
});
