import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { resolveOutgoingLink } from '../src/services/noteLinkService';

const root = vscode.Uri.file('/workspace/notes');
const source = vscode.Uri.file('/workspace/notes/project-plan.md');
let files: Set<string>;
let dirs: Set<string>;

beforeEach(() => {
  vi.restoreAllMocks();
  (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }];
  files = new Set();
  dirs = new Set(['/workspace/notes/projects/App-Launch', '/workspace/notes/projects/Website-Relaunch']);
  vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: any) => {
    if (dirs.has(uri.fsPath)) return { type: vscode.FileType.Directory } as any;
    if (files.has(uri.fsPath)) return { type: vscode.FileType.File } as any;
    throw new Error('Not found');
  });
});

const link = (target: string, type: 'wiki' | 'markdown' = 'wiki', label = target) => ({ raw: target, target, label, type });

describe('folder links', () => {
  it('resolves a trailing slash to the folder relative to the root', async () => {
    const item = await resolveOutgoingLink(link('projects/App-Launch/'), source, root, []);
    expect(item).toMatchObject({
      kind: 'folder',
      exists: true,
      title: 'App-Launch',
      relativePath: 'projects/App-Launch/',
      uri: vscode.Uri.file('/workspace/notes/projects/App-Launch').toString(),
    });
  });

  it('resolves a trailing slash relative to the note first', async () => {
    dirs.add('/workspace/notes/meetings/Protokolle');
    const fromMeeting = vscode.Uri.file('/workspace/notes/meetings/review.md');
    const item = await resolveOutgoingLink(link('Protokolle/'), fromMeeting, root, []);
    expect(item).toMatchObject({ kind: 'folder', exists: true, relativePath: 'meetings/Protokolle/' });
  });

  it('prefers a note when there is no trailing slash', async () => {
    files.add('/workspace/notes/projects/App-Launch.md');
    const item = await resolveOutgoingLink(link('projects/App-Launch'), source, root, []);
    expect(item.kind).toBeUndefined();
    expect(item.uri).toBe(vscode.Uri.file('/workspace/notes/projects/App-Launch.md').toString());
  });

  it('falls back to the folder when no note matches', async () => {
    const item = await resolveOutgoingLink(link('projects/Website-Relaunch', 'markdown', 'Website'), source, root, []);
    expect(item).toMatchObject({ kind: 'folder', exists: true, title: 'Website', relativePath: 'projects/Website-Relaunch/' });
  });

  it('reports a missing folder for a trailing slash', async () => {
    const item = await resolveOutgoingLink(link('projects/Gibt-es-nicht/'), source, root, []);
    expect(item).toMatchObject({ kind: 'folder', exists: false });
  });

  it('keeps unresolved note links as notes', async () => {
    const item = await resolveOutgoingLink(link('neue-notiz'), source, root, []);
    expect(item.kind).toBeUndefined();
    expect(item.exists).toBe(false);
  });
});

import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import { CompanionManager } from '../src/companion/companionManager';
import { __setConfigStore } from './__mocks__/vscode';

describe('opening folder links', () => {
  const setup = () => {
    __setConfigStore({ 'janus.notesRoot': 'notes' });
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any, new CompanionManager());
    const doc = { uri: source, getText: () => '' } as any;
    return { provider, doc, panel: { webview: { postMessage: vi.fn() } } as any };
  };

  it('opens the Folder Overview and reveals the folder', async () => {
    const { provider, doc, panel } = setup();
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    await provider.handleWebviewMessage({ type: 'openLink', targetUri: 'projects/App-Launch/', linkType: 'wiki' }, doc, panel);
    const folder = expect.objectContaining({ fsPath: '/workspace/notes/projects/App-Launch' });
    expect(exec).toHaveBeenCalledWith('janus.openFolderOverview', folder);
    expect(exec).toHaveBeenCalledWith('janus.revealInNotesTree', folder);
  });

  it('shows a message for a missing folder and creates no note', async () => {
    const { provider, doc, panel } = setup();
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const info = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
    const write = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();
    await provider.handleWebviewMessage({ type: 'openLink', targetUri: 'projects/Gibt-es-nicht/', linkType: 'wiki' }, doc, panel);
    expect(info).toHaveBeenCalledWith(expect.stringContaining('existiert nicht'));
    expect(info.mock.calls[0]).toHaveLength(1);
    expect(write).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalledWith('janus.openFolderOverview', expect.anything());
  });
});

import { findLinkCandidatesInRoot } from '../src/companion/noteLinking';
import { createLinkAutocompleteSource } from '../src/webviews/markdown/extensions/linkAutocomplete';

describe('folder suggestions', () => {
  it('offers folders with a trailing slash, but not dot folders or assets', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
      if (uri.fsPath === '/workspace/notes') {
        return [
          ['projects', vscode.FileType.Directory],
          ['.templates', vscode.FileType.Directory],
          ['plan.md', vscode.FileType.File],
        ] as any;
      }
      if (uri.fsPath === '/workspace/notes/projects') {
        return [
          ['App-Launch', vscode.FileType.Directory],
          ['assets', vscode.FileType.Directory],
        ] as any;
      }
      return [];
    });
    const candidates = await findLinkCandidatesInRoot(root);
    const folders = candidates.filter((c) => c.fileType === 'folder');
    expect(folders.map((c) => [c.label, c.insertText])).toEqual([
      ['App-Launch/', 'projects/App-Launch/'],
      ['projects/', 'projects/'],
    ]);
  });

  it('shows folders with a folder icon and inserts the trailing slash', () => {
    const source = createLinkAutocompleteSource(() => [
      { label: 'App-Launch/', insertText: 'projects/App-Launch/', relPath: 'projects/App-Launch/', fileType: 'folder' },
    ]);
    const result = source({ matchBefore: () => ({ from: 0, to: 5, text: '[[App' }) } as any)!;
    expect(result.options[0].displayLabel).toBe('📁 App-Launch/');
    expect(result.options[0].detail).toBe('projects/App-Launch/');
  });
});

describe('footer click on a folder', () => {
  it('opens the Folder Overview for a folder URI', async () => {
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any, new CompanionManager());
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const folderUri = vscode.Uri.file('/workspace/notes/projects/App-Launch');
    await provider.handleWebviewMessage(
      { type: 'openLink', targetUri: folderUri.toString(), viewType: 'janus.markdownEditor' },
      { uri: source, getText: () => '' } as any,
      { webview: { postMessage: vi.fn() } } as any
    );
    expect(exec).toHaveBeenCalledWith('janus.openFolderOverview', expect.objectContaining({ fsPath: folderUri.fsPath }));
    expect(exec).not.toHaveBeenCalledWith('vscode.openWith', expect.anything(), expect.anything());
  });
});
