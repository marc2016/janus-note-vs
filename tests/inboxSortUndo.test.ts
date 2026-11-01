import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { AiModelService } from '../src/services/aiModelService';
import { AiInboxSorterService } from '../src/services/aiInboxSorterService';
import { CompanionManager } from '../src/companion/companionManager';
import { runUndoInboxSort, showInboxSortResult } from '../src/editors/markdownEditorProvider';
import { __resetSortUndo } from '../src/services/inboxSortUndo';
import { __setConfigStore, MockQuickPick } from './__mocks__/vscode';

describe('undo inbox sort', () => {
  let fsMap: Map<string, string>;
  let dirs: Set<string>;
  let aiModelService: AiModelService;
  let sorter: AiInboxSorterService;
  const inboxUri = vscode.Uri.file('/workspace/inbox.md');

  const respond = (...items: Array<[number, string]>) =>
    vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
      JSON.stringify({
        items: items.map(([block, target]) => ({ block, title: `Titel ${block}`, action: 'append', targetRelativePath: target })),
      })
    );

  /** Sorts like the command does: the result message remembers the run. */
  const sortInbox = async () => {
    const result = await sorter.sortInbox(inboxUri);
    showInboxSortResult(result);
    return result;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    __resetSortUndo();
    __setConfigStore({ 'janus.ai.inboxSortConfirm': false });
    fsMap = new Map();
    dirs = new Set(['/workspace']);
    (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }];

    const isDir = (p: string) => dirs.has(p) || [...fsMap.keys()].some((k) => k.startsWith(`${p}/`));
    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: vscode.Uri) => {
      if (fsMap.has(uri.fsPath)) {
        return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 1 };
      }
      if (isDir(uri.fsPath)) {
        return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
      }
      throw new Error(`not found: ${uri.fsPath}`);
    });
    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: vscode.Uri) => {
      const content = fsMap.get(uri.fsPath);
      if (content === undefined) {
        throw new Error(`not found: ${uri.fsPath}`);
      }
      return Buffer.from(content, 'utf-8');
    });
    vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(async (uri: vscode.Uri, content: Uint8Array) => {
      fsMap.set(uri.fsPath, Buffer.from(content).toString('utf-8'));
    });
    vi.spyOn(vscode.workspace.fs, 'createDirectory').mockImplementation(async (uri: vscode.Uri) => {
      let p = uri.fsPath;
      while (p !== '/' && !dirs.has(p)) {
        dirs.add(p);
        p = p.slice(0, p.lastIndexOf('/')) || '/';
      }
    });
    vi.spyOn(vscode.workspace.fs, 'delete').mockImplementation(async (uri: vscode.Uri) => {
      fsMap.delete(uri.fsPath);
      dirs.delete(uri.fsPath);
    });
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) => {
      const prefix = `${uri.fsPath}/`;
      const entries = new Map<string, vscode.FileType>();
      for (const key of [...fsMap.keys(), ...dirs]) {
        if (key.startsWith(prefix)) {
          const [first, ...rest] = key.slice(prefix.length).split('/');
          entries.set(first, rest.length > 0 || dirs.has(`${prefix}${first}`) ? vscode.FileType.Directory : vscode.FileType.File);
        }
      }
      return [...entries];
    });

    aiModelService = new AiModelService({
      extensionUri: vscode.Uri.file('/ext'),
      secrets: { get: vi.fn(async () => undefined), store: vi.fn(), delete: vi.fn() },
    } as any);
    sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
  });

  it('restores inbox, appended and created notes exactly', async () => {
    const inbox = '# Inbox\n\n## A\nalpha\n\n## B\nbeta\n';
    fsMap.set(inboxUri.fsPath, inbox);
    fsMap.set('/workspace/projects/app.md', '# App\n\nInhalt\n');
    respond([1, 'projects/app.md'], [2, 'knowledge/neu.md']);

    await sortInbox();
    expect(fsMap.get(inboxUri.fsPath)).toBe('# Inbox\n\n');
    const report = await runUndoInboxSort();

    expect(report).toEqual({ undone: 2, keptNotes: [] });
    expect(fsMap.get('/workspace/projects/app.md')).toBe('# App\n\nInhalt\n');
    expect(fsMap.has('/workspace/knowledge/neu.md')).toBe(false);
    expect(dirs.has('/workspace/knowledge')).toBe(false);
    expect(fsMap.get(inboxUri.fsPath)).toBe(inbox);
  });

  it('undoes two sections appended to the same note', async () => {
    fsMap.set(inboxUri.fsPath, '# Inbox\n\nEins.\n\nZwei.\n');
    fsMap.set('/workspace/projects/app.md', '# App\n');
    respond([1, 'projects/app.md'], [2, 'projects/app.md']);

    await sortInbox();
    fsMap.set('/workspace/projects/app.md', `Oben\n${fsMap.get('/workspace/projects/app.md')}`);
    await runUndoInboxSort();

    expect(fsMap.get('/workspace/projects/app.md')).toBe('Oben\n# App\n');
  });

  it('removes the link lines from a daily note', async () => {
    __setConfigStore({ 'janus.ai.inboxSortConfirm': false });
    const dailyUri = vscode.Uri.file('/workspace/journal/2026-10-27.md');
    const daily = '# Dienstag\n\n## Call mit Anna\nBackend auf Postgres umstellen\n';
    fsMap.set(dailyUri.fsPath, daily);
    fsMap.set('/workspace/projects/App-Launch/architektur.md', '# Architektur\n');
    respond([1, 'projects/App-Launch/architektur.md']);

    showInboxSortResult(await sorter.sortDailyNote(dailyUri));
    expect(fsMap.get(dailyUri.fsPath)).toContain('-> [[projects/App-Launch/architektur]]');
    await runUndoInboxSort();

    expect(fsMap.get(dailyUri.fsPath)).toBe(daily);
    expect(fsMap.get('/workspace/projects/App-Launch/architektur.md')).toBe('# Architektur\n');
  });

  it('removes link lines from a daily note edited after the sort', async () => {
    const dailyUri = vscode.Uri.file('/workspace/journal/2026-10-27.md');
    fsMap.set(dailyUri.fsPath, '# Dienstag\n\n## Call\nText\n');
    respond([1, 'knowledge/call.md']);

    showInboxSortResult(await sorter.sortDailyNote(dailyUri));
    fsMap.set(dailyUri.fsPath, `${fsMap.get(dailyUri.fsPath)}\n## Später\nNeu\n`);
    await runUndoInboxSort();

    expect(fsMap.get(dailyUri.fsPath)).toBe('# Dienstag\n\n## Call\nText\n\n## Später\nNeu\n');
  });

  it('removes folders the sort created once they are empty', async () => {
    fsMap.set(inboxUri.fsPath, '# Inbox\n\nFeedback\n');
    fsMap.set('/workspace/projects/app.md', '# App\n');
    respond([1, 'projects/Beta/feedback.md']);

    await sortInbox();
    expect(dirs.has('/workspace/projects/Beta')).toBe(true);
    await runUndoInboxSort();

    expect(fsMap.has('/workspace/projects/Beta/feedback.md')).toBe(false);
    expect(dirs.has('/workspace/projects/Beta')).toBe(false);
    expect(fsMap.has('/workspace/projects/app.md')).toBe(true);
  });

  it('offers undo in the result message and runs it only once', async () => {
    fsMap.set(inboxUri.fsPath, '# Inbox\n\nEins.\n');
    respond([1, 'knowledge/eins.md']);
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);

    await sortInbox();
    expect(infoSpy).toHaveBeenCalledWith(expect.any(String), 'Notiz öffnen', 'Rückgängig');
    expect(await runUndoInboxSort()).toBeDefined();
    const inboxAfterUndo = fsMap.get(inboxUri.fsPath);

    expect(await runUndoInboxSort()).toBeUndefined();
    expect(infoSpy).toHaveBeenLastCalledWith('Keine Sortierung zum Rückgängigmachen vorhanden.');
    expect(fsMap.get(inboxUri.fsPath)).toBe(inboxAfterUndo);
  });

  it('keeps the previous run when a later sort is cancelled', async () => {
    fsMap.set(inboxUri.fsPath, '# Inbox\n\nEins.\n\nZwei.\n');
    respond([1, 'knowledge/eins.md']);
    await sortInbox();

    __setConfigStore({ 'janus.ai.inboxSortConfirm': true });
    respond([1, 'knowledge/zwei.md']);
    vi.spyOn(vscode.window, 'createQuickPick').mockImplementation(() => {
      const qp = new MockQuickPick<any>();
      qp.onShow = (q) => q.hide();
      return qp as any;
    });
    const cancelled = await sortInbox();
    expect(cancelled.cancelled).toBe(true);
    await runUndoInboxSort();

    expect(fsMap.has('/workspace/knowledge/eins.md')).toBe(false);
    expect(fsMap.get(inboxUri.fsPath)).toBe('# Inbox\n\nEins.\n\nZwei.\n');
  });

  it('keeps text added above an appended section', async () => {
    fsMap.set(inboxUri.fsPath, '# Inbox\n\nEins.\n');
    fsMap.set('/workspace/projects/app.md', '# App\n\nInhalt\n');
    respond([1, 'projects/app.md']);

    await sortInbox();
    fsMap.set('/workspace/projects/app.md', fsMap.get('/workspace/projects/app.md')!.replace('# App\n', '# App\nNeu oben\n'));
    await runUndoInboxSort();

    expect(fsMap.get('/workspace/projects/app.md')).toBe('# App\nNeu oben\n\nInhalt\n');
  });

  it('keeps a created note that was edited and reports it', async () => {
    fsMap.set(inboxUri.fsPath, '# Inbox\n\nEins.\n');
    respond([1, 'knowledge/neu.md']);
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);

    await sortInbox();
    fsMap.set('/workspace/knowledge/neu.md', `${fsMap.get('/workspace/knowledge/neu.md')}Mehr\n`);
    const report = await runUndoInboxSort();

    expect(report?.keptNotes).toEqual(['knowledge/neu.md']);
    expect(fsMap.get('/workspace/knowledge/neu.md')).toBe('# neu\n\nEins.\nMehr\n');
    expect(infoSpy).toHaveBeenLastCalledWith(
      'Sortierung rückgängig gemacht. Unverändert gelassen (seitdem bearbeitet): knowledge/neu.md.'
    );
  });

  it('adds the blocks back at the end of an inbox edited after the sort', async () => {
    fsMap.set(inboxUri.fsPath, '# Inbox\n\n## A\nalpha\n\n## B\nbeta\n');
    respond([1, 'knowledge/a.md'], [2, 'knowledge/b.md']);

    await sortInbox();
    fsMap.set(inboxUri.fsPath, '# Inbox\n\n## C\nneu\n');
    await runUndoInboxSort();

    expect(fsMap.get(inboxUri.fsPath)).toBe('# Inbox\n\n## C\nneu\n\n## A\nalpha\n\n## B\nbeta\n');
    expect(fsMap.has('/workspace/knowledge/a.md')).toBe(false);
  });

  it('leaves a note with an edited appended section unchanged but restores its block', async () => {
    fsMap.set(inboxUri.fsPath, '# Inbox\n\nEins zwei.\n');
    fsMap.set('/workspace/projects/app.md', '# App\n');
    respond([1, 'projects/app.md']);

    await sortInbox();
    const edited = fsMap.get('/workspace/projects/app.md')!.replace('Eins zwei.', 'Eins drei.');
    fsMap.set('/workspace/projects/app.md', edited);
    const report = await runUndoInboxSort();

    expect(fsMap.get('/workspace/projects/app.md')).toBe(edited);
    expect(report?.keptNotes).toEqual(['projects/app.md']);
    expect(fsMap.get(inboxUri.fsPath)).toBe('# Inbox\n\nEins zwei.\n');
  });
});
