import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { buildNoteGraph } from '../src/services/noteGraphService';
import { filterGraph, DEFAULT_GRAPH_FILTER } from '../src/webviews/noteGraph/graphFilter';
import { NoteGraphViewProvider } from '../src/editors/noteGraphViewProvider';

const root = vscode.Uri.file('/workspace/notes');

function mockFileSystem(files: Record<string, string>) {
  const paths = Object.keys(files);
  const dirs = new Set<string>();
  for (const p of paths) {
    let dir = p.slice(0, p.lastIndexOf('/'));
    while (dir.length > 1) {
      dirs.add(dir);
      dir = dir.slice(0, dir.lastIndexOf('/'));
    }
  }
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
    if (dirs.has(uri.fsPath)) return { type: vscode.FileType.Directory } as any;
    if (uri.fsPath in files) return { type: vscode.FileType.File } as any;
    throw new Error(`ENOENT ${uri.fsPath}`);
  });
}

describe('folder nodes in the graph', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }];
  });

  it('adds a node for a linked folder with edges from the linking notes', async () => {
    mockFileSystem({
      '/workspace/notes/project-plan.md': '[[projects/App-Launch/]]',
      '/workspace/notes/projects/Website-Relaunch/kickoff.md': '[App](../App-Launch)',
      '/workspace/notes/projects/App-Launch/app.md': '# App',
      '/workspace/notes/knowledge/ki.md': '# KI',
    });
    const graph = await buildNoteGraph([root], root);
    const folderId = `folder:${vscode.Uri.file('/workspace/notes/projects/App-Launch').toString()}`;
    const folder = graph.nodes.find((n) => n.id === folderId);
    expect(folder).toMatchObject({ kind: 'folder', title: 'App-Launch', relativePath: 'projects/App-Launch/', degree: 2 });
    expect(graph.edges.filter((e) => e.target === folderId)).toHaveLength(2);
    // Unlinked folders stay hidden, and folders get no edges to the notes they contain
    expect(graph.nodes.some((n) => n.kind === 'folder' && n.title === 'knowledge')).toBe(false);
    expect(graph.edges.some((e) => e.source === folderId)).toBe(false);
  });

  it('leaves missing folders out', async () => {
    mockFileSystem({ '/workspace/notes/plan.md': '[[projects/Gibt-es-nicht/]]' });
    const graph = await buildNoteGraph([root], root);
    expect(graph.nodes.map((n) => n.title)).toEqual(['plan']);
  });

  it('finds folders in the graph search', () => {
    const data = {
      nodes: [
        { id: 'folder:x', title: 'App-Launch', relativePath: 'projects/App-Launch/', group: 'projects', degree: 1, kind: 'folder' as const },
        { id: 'n', title: 'plan', relativePath: 'plan.md', group: 'notes', degree: 1 },
      ],
      edges: [],
    };
    expect(filterGraph(data, { ...DEFAULT_GRAPH_FILTER, search: 'App-Launch' }).nodes.map((n) => n.id)).toEqual(['folder:x']);
  });

  it('opens the Folder Overview for a folder node', async () => {
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const provider = new NoteGraphViewProvider({ extensionUri: vscode.Uri.file('/ext') } as any, {} as any);
    const folder = vscode.Uri.file('/workspace/notes/projects/App-Launch');
    await provider.handleMessage({ type: 'openFolder', uri: folder.toString() });
    expect(exec).toHaveBeenCalledWith('janus.openFolderOverview', expect.objectContaining({ fsPath: folder.fsPath }));
  });
});
