import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { resolveSortedLinks } from '../src/services/sortedLinkService';

describe('resolveSortedLinks', () => {
  const root = vscode.Uri.file('/workspace/notes');
  let files: Map<string, string>;

  beforeEach(() => {
    vi.restoreAllMocks();
    files = new Map();
    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: any) => {
      const text = files.get(uri.fsPath);
      if (text === undefined) throw new Error('Not found');
      return Buffer.from(text);
    });
  });

  it('uses the frontmatter title and finds the copied section by heading and date', async () => {
    files.set(
      '/workspace/notes/projects/App-Launch/architektur.md',
      '---\ntitle: App-Launch Architektur\n---\n# System-Architektur\n\n## Call mit Anna (2026-10-28)\n\nAlt\n\n## Call mit Anna (2026-10-29)\n\nText\n'
    );
    const links = await resolveSortedLinks(
      '## Call mit Anna\nText\n\n-> [[projects/App-Launch/architektur]]\n',
      root,
      '2026-10-29'
    );
    expect(links).toEqual([
      {
        target: 'projects/App-Launch/architektur',
        title: 'App-Launch Architektur',
        folder: 'projects / App-Launch',
        exists: true,
        line: 10,
      },
    ]);
  });

  it('falls back to the first heading and to the anchor text', async () => {
    files.set('/workspace/notes/knowledge/erster.md', '# Erster Gedanke\n\nErster Gedanke heute\n');
    const [link] = await resolveSortedLinks('Erster Gedanke heute\n\n-> [[knowledge/erster]]\n', root, '2026-10-29');
    expect(link).toMatchObject({ title: 'Erster Gedanke', folder: 'knowledge', exists: true, line: 3 });
  });

  it('falls back to the file name and to the top of the note', async () => {
    files.set('/workspace/notes/knowledge/ohne-titel.md', 'Nur Text\n');
    const [link] = await resolveSortedLinks('## X\nanders\n-> [[knowledge/ohne-titel]]\n', root, '2026-10-29');
    expect(link).toMatchObject({ title: 'ohne-titel', exists: true });
    expect(link.line).toBeUndefined();
  });

  it('marks a missing target', async () => {
    const [link] = await resolveSortedLinks('## X\ny\n-> [[knowledge/weg]]\n', root, '2026-10-29');
    expect(link).toEqual({ target: 'knowledge/weg', title: 'weg', folder: 'knowledge', exists: false });
  });
});
