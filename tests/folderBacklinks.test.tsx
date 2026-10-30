import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as vscode from 'vscode';
import { findFolderBacklinks } from '../src/services/noteLinkService';
import { FolderBacklinksSection } from '../src/webviews/folderOverview/FolderOverviewApp';
import { FolderOverviewViewProvider } from '../src/editors/folderOverviewViewProvider';

const root = vscode.Uri.file('/workspace/notes');
const notes: Record<string, string> = {
  '/workspace/notes/project-plan.md': '# Plan\n\nSiehe [[projects/App-Launch/]]\n',
  '/workspace/notes/meetings/sprint-review.md': '# Review\n\n\n[App](../projects/App-Launch)\n',
  '/workspace/notes/knowledge/ki.md': 'Kein Link, nur [[projects/Website-Relaunch/]]',
};
const dirs = new Set([
  '/workspace/notes/projects/App-Launch',
  '/workspace/notes/projects/Website-Relaunch',
  '/workspace/notes/meetings',
  '/workspace/notes/knowledge',
  '/workspace/notes/projects',
]);

beforeEach(() => {
  vi.restoreAllMocks();
  (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }];
  vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: any) => {
    if (dirs.has(uri.fsPath)) return { type: vscode.FileType.Directory } as any;
    if (notes[uri.fsPath] !== undefined) return { type: vscode.FileType.File } as any;
    throw new Error('Not found');
  });
  vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: any) => {
    if (notes[uri.fsPath] === undefined) throw new Error('Not found');
    return Buffer.from(notes[uri.fsPath]);
  });
  vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
    const children = new Map<string, vscode.FileType>();
    for (const p of [...Object.keys(notes), ...dirs]) {
      if (p.startsWith(`${uri.fsPath}/`)) {
        const name = p.slice(uri.fsPath.length + 1).split('/')[0];
        const isDir = p.slice(uri.fsPath.length + 1).includes('/') || dirs.has(p);
        children.set(name, isDir ? vscode.FileType.Directory : vscode.FileType.File);
      }
    }
    return [...children.entries()] as any;
  });
});

describe('notes linking to a folder', () => {
  it('finds every note with a link to the folder and its line', async () => {
    const backlinks = await findFolderBacklinks(vscode.Uri.file('/workspace/notes/projects/App-Launch'), root, root);
    expect(backlinks.map((b) => [b.relativePath, b.line]).sort()).toEqual([
      ['meetings/sprint-review.md', 4],
      ['project-plan.md', 3],
    ]);
  });

  it('opens a linking note at the line of the link', async () => {
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const provider = new FolderOverviewViewProvider({} as any, {} as any, undefined, undefined, () => root);
    await provider.handleMessage({ type: 'openNote', noteUri: 'file:///workspace/notes/project-plan.md', line: 3 });
    expect(exec).toHaveBeenCalledWith('janus.openNoteAtLine', expect.objectContaining({ fsPath: '/workspace/notes/project-plan.md' }), 3);
  });

  it('renders the section only when there are backlinks', () => {
    const markup = renderToStaticMarkup(
      <FolderBacklinksSection
        backlinks={[{ title: 'project-plan', uri: 'file:///workspace/notes/project-plan.md', relativePath: 'project-plan.md', line: 14 }]}
        onOpen={() => {}}
      />
    );
    expect(markup).toContain('Verlinkt von (1)');
    expect(markup).toContain('project-plan');
    expect(markup).toContain(':14');
    expect(renderToStaticMarkup(<FolderBacklinksSection backlinks={[]} onOpen={() => {}} />)).toBe('');
  });
});
