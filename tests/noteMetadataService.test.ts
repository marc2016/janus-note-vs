import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  buildAliasIndex,
  clearNoteMetadataCache,
  getNotesMetadata,
  parseFrontmatter,
} from '../src/services/noteMetadataService';

describe('parseFrontmatter', () => {
  it('reads the title and reports where the body starts', () => {
    const text = '---\ntitle: REST-Schnittstelle\n---\n# Body';
    const fm = parseFrontmatter(text);
    expect(fm.title).toBe('REST-Schnittstelle');
    expect(text.slice(fm.bodyStart)).toBe('# Body');
  });

  it('accepts a byte order mark, CRLF line endings and a `...` closing line', () => {
    const fm = parseFrontmatter('﻿---\r\ntitle: "Titel"\r\n...\r\nText');
    expect(fm.title).toBe('Titel');
  });

  it('ignores a horizontal rule later in the note', () => {
    expect(parseFrontmatter('# Überschrift\n\n---\ntitle: X\n---')).toEqual({ aliases: [], tags: [], bodyStart: 0 });
  });

  it('ignores an unclosed block', () => {
    expect(parseFrontmatter('---\ntitle: X\nText')).toEqual({ aliases: [], tags: [], bodyStart: 0 });
  });

  it('reads inline lists with quotes', () => {
    const fm = parseFrontmatter('---\naliases: [API, "REST API", \'a, b\']\ntags: [projekt, backend]\n---');
    expect(fm.aliases).toEqual(['API', 'REST API', 'a, b']);
    expect(fm.tags).toEqual(['projekt', 'backend']);
  });

  it('reads block lists', () => {
    const fm = parseFrontmatter('---\naliases:\n  - API\n  - "Schnittstelle"\ntitle: T\n---');
    expect(fm.aliases).toEqual(['API', 'Schnittstelle']);
    expect(fm.title).toBe('T');
  });

  it('reads single values and singular keys, splitting tag strings', () => {
    const fm = parseFrontmatter('---\nalias: API\ntag: "#projekt, backend"\n---');
    expect(fm.aliases).toEqual(['API']);
    expect(fm.tags).toEqual(['projekt', 'backend']);
  });

  it('splits unquoted tag strings at whitespace and drops #', () => {
    // Unlike strict YAML, a leading # is a tag marker here, not a comment
    expect(parseFrontmatter('---\ntags: #a b,c\n---').tags).toEqual(['a', 'b', 'c']);
    expect(parseFrontmatter('---\ntags: a b,#c\n---').tags).toEqual(['a', 'b', 'c']);
  });

  it('matches keys case-insensitively and ignores other keys, comments and empty values', () => {
    const fm = parseFrontmatter(
      '---\nTitle: Groß\ndate: 2026-10-24\n# Kommentar\nstatus: offen\naliases: []\ntags:\n---'
    );
    expect(fm).toMatchObject({ title: 'Groß', aliases: [], tags: [] });
  });

  it('drops trailing comments on unquoted values', () => {
    expect(parseFrontmatter('---\ntitle: Plan # Entwurf\n---').title).toBe('Plan');
    expect(parseFrontmatter('---\ntitle: "Plan # 2"\n---').title).toBe('Plan # 2');
  });
});

describe('getNotesMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearNoteMetadataCache();
  });

  it('re-reads only notes whose modification time changed', async () => {
    const mtimes: Record<string, number> = { '/n/a.md': 1, '/n/b.md': 1 };
    const texts: Record<string, string> = {
      '/n/a.md': '---\naliases: [A]\n---',
      '/n/b.md': '---\naliases: [B]\n---',
    };
    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: any) => ({ mtime: mtimes[uri.fsPath] }) as any);
    const readSpy = vi
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockImplementation(async (uri: any) => Buffer.from(texts[uri.fsPath]));
    const uris = [vscode.Uri.file('/n/a.md'), vscode.Uri.file('/n/b.md')];

    await getNotesMetadata(uris);
    expect(readSpy).toHaveBeenCalledTimes(2);

    mtimes['/n/b.md'] = 2;
    texts['/n/b.md'] = '---\naliases: [B2]\n---';
    const entries = await getNotesMetadata(uris);

    expect(readSpy).toHaveBeenCalledTimes(3);
    expect(entries.map((e) => e.metadata.aliases)).toEqual([['A'], ['B2']]);
  });

  it('skips notes that no longer exist', async () => {
    vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('Not found'));
    expect(await getNotesMetadata([vscode.Uri.file('/n/gone.md')])).toEqual([]);
  });
});

describe('buildAliasIndex', () => {
  it('maps lower-cased aliases to the first note listing them', () => {
    const a = vscode.Uri.file('/n/a.md');
    const b = vscode.Uri.file('/n/b.md');
    const index = buildAliasIndex([
      { uri: a, metadata: { aliases: ['API'], tags: [] } },
      { uri: b, metadata: { aliases: ['api', 'Rest'], tags: [] } },
    ]);
    expect(index.get('api')).toBe(a);
    expect(index.get('rest')).toBe(b);
  });
});
