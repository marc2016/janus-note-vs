import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { buildNoteGraph } from '../src/services/noteGraphService';

/** Virtual file system: absolute path -> file content. Directories are derived from the paths. */
function mockFileSystem(files: Record<string, string>) {
  const paths = Object.keys(files);

  vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
    const prefix = uri.fsPath.replace(/\/$/, '') + '/';
    const entries = new Map<string, vscode.FileType>();
    for (const p of paths) {
      if (!p.startsWith(prefix)) continue;
      const [name, ...rest] = p.slice(prefix.length).split('/');
      entries.set(name, rest.length > 0 ? vscode.FileType.Directory : vscode.FileType.File);
    }
    return [...entries.entries()];
  });

  vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
    if (!(uri.fsPath in files)) throw new Error(`ENOENT ${uri.fsPath}`);
    return Buffer.from(files[uri.fsPath], 'utf-8');
  });

  vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
    if (!(uri.fsPath in files)) throw new Error(`ENOENT ${uri.fsPath}`);
    return {} as any;
  });
}

const root = vscode.Uri.file('/workspace/notes');
const id = (p: string) => vscode.Uri.file(p).toString();

describe('noteGraphService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (vscode.workspace as any).workspaceFolders = [
      { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 },
    ];
  });

  it('creates one node per note and collapses duplicate links into one edge', async () => {
    mockFileSystem({
      '/workspace/notes/projects/plan.md': 'Siehe [[architektur]] und nochmal [Architektur](architektur.md).',
      '/workspace/notes/projects/architektur.md': '# Architektur',
      '/workspace/notes/inbox.md': '',
    });

    const graph = await buildNoteGraph([root], root);

    expect(graph.nodes.map((n) => n.title).sort()).toEqual(['architektur', 'inbox', 'plan']);
    expect(graph.edges).toEqual([
      {
        source: id('/workspace/notes/projects/plan.md'),
        target: id('/workspace/notes/projects/architektur.md'),
        bidirectional: false,
      },
    ]);
  });

  it('merges mutual links into one bidirectional edge and ignores self-links', async () => {
    mockFileSystem({
      '/workspace/notes/a.md': '[[b]] und [[a]]',
      '/workspace/notes/b.md': '[[a]]',
    });

    const graph = await buildNoteGraph([root], root);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].bidirectional).toBe(true);
  });

  it('ignores links to code files and external URLs', async () => {
    mockFileSystem({
      '/workspace/notes/a.md': 'Code: [App](../src/app.ts:42), [[missing.ts]], Web: [Docs](https://example.com)',
      '/workspace/src/app.ts': 'export {}',
    });

    const graph = await buildNoteGraph([root], root);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });

  it('turns missing targets into one shared ghost node', async () => {
    mockFileSystem({
      '/workspace/notes/a.md': '[[Noch nicht geschrieben]]',
      '/workspace/notes/b.md': '[[noch nicht geschrieben]]',
    });

    const graph = await buildNoteGraph([root], root);

    const ghosts = graph.nodes.filter((n) => n.ghost);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].title).toBe('Noch nicht geschrieben');
    expect(graph.edges.filter((e) => e.target === ghosts[0].id)).toHaveLength(2);
    // Ghost links do not count toward node size
    expect(graph.nodes.find((n) => n.title === 'a')!.degree).toBe(0);
  });

  it('links notes from included folders with notes in the notes root', async () => {
    const docsRoot = vscode.Uri.file('/workspace/docs');
    mockFileSystem({
      '/workspace/docs/api.md': 'Siehe [REST](notes/knowledge/rest.md)',
      '/workspace/notes/knowledge/rest.md': '# REST',
    });

    const graph = await buildNoteGraph([root, docsRoot], root);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toEqual([
      {
        source: id('/workspace/docs/api.md'),
        target: id('/workspace/notes/knowledge/rest.md'),
        bidirectional: false,
      },
    ]);
  });

  it('derives group from the top-level folder and degree from distinct linked notes', async () => {
    mockFileSystem({
      '/workspace/notes/index.md': '[[kickoff]] [[retro]] [[plan]]',
      '/workspace/notes/meetings/kickoff.md': '[[index]]',
      '/workspace/notes/meetings/retro.md': '',
      '/workspace/notes/projects/plan.md': '',
    });

    const graph = await buildNoteGraph([root], root);
    const byTitle = Object.fromEntries(graph.nodes.map((n) => [n.title, n]));

    expect(byTitle.index.group).toBe('notes');
    expect(byTitle.kickoff.group).toBe('meetings');
    expect(byTitle.retro.group).toBe('meetings');
    expect(byTitle.plan.group).toBe('projects');
    expect(byTitle.kickoff.relativePath).toBe('meetings/kickoff.md');
    expect(byTitle.index.degree).toBe(3);
    expect(byTitle.kickoff.degree).toBe(1);
  });
});
