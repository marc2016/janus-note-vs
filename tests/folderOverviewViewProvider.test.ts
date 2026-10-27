import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FolderOverviewViewProvider } from '../src/editors/folderOverviewViewProvider';
import { AiFolderSummaryService } from '../src/services/aiFolderSummaryService';
import { FolderTasksService } from '../src/services/folderTasksService';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';

describe('FolderOverviewViewProvider', () => {
  const folderUri = vscode.Uri.file('/workspace/notes/projects');
  const mockContext = {
    extensionUri: vscode.Uri.file('/extension'),
  } as unknown as vscode.ExtensionContext;

  let aiFolderSummaryService: AiFolderSummaryService;
  let folderTasksService: FolderTasksService;
  let provider: FolderOverviewViewProvider;
  let fsMap: Map<string, string>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fsMap = new Map();

    aiFolderSummaryService = {
      extractTitle: vi.fn((content: string, name: string) => {
        if (content.startsWith('# ')) {
          return content.split('\n')[0].replace('# ', '').trim();
        }
        return name.replace(/\.md$/i, '');
      }),
      extractSnippet: vi.fn(() => 'Vorschau der Notiz...'),
      generateFolderSummary: vi.fn().mockResolvedValue('### Zusammenfassung\nAlles läuft nach Plan.'),
    } as unknown as AiFolderSummaryService;

    folderTasksService = new FolderTasksService();
    provider = new FolderOverviewViewProvider(mockContext, aiFolderSummaryService, folderTasksService);

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: vscode.Uri) => {
      const content = fsMap.get(uri.fsPath);
      if (content === undefined) {
        throw new Error(`File not found: ${uri.fsPath}`);
      }
      return Buffer.from(content, 'utf-8');
    });

    vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(
      async (uri: vscode.Uri, content: Uint8Array) => {
        fsMap.set(uri.fsPath, Buffer.from(content).toString('utf-8'));
      }
    );

    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: vscode.Uri) => {
      if (fsMap.has(uri.fsPath)) {
        return { type: vscode.FileType.File, ctime: 100, mtime: 200, size: 50 };
      }
      throw new Error(`File not found: ${uri.fsPath}`);
    });
  });

  it('creates webview panel with title and dashboard icon', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
    const panelSpy = vi.spyOn(vscode.window, 'createWebviewPanel');

    await provider.open(folderUri);

    expect(panelSpy).toHaveBeenCalledWith(
      'janus.folderOverview',
      'Übersicht: projects',
      vscode.ViewColumn.One,
      expect.any(Object)
    );
  });

  it('reveals existing panel and updates title when switching folders', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
    await provider.open(folderUri);

    const activePanel = provider.getActivePanel();
    expect(activePanel).toBeDefined();

    const secondFolderUri = vscode.Uri.file('/workspace/notes/meetings');
    await provider.open(secondFolderUri);

    expect(activePanel?.title).toBe('Übersicht: meetings');
    expect(provider.getCurrentFolderUri()?.fsPath).toBe(secondFolderUri.fsPath);
  });

  it('collects folder overview data including notes, chart companion status, and tasks', async () => {
    const noteUri = vscode.Uri.file('/workspace/notes/projects/plan.md');
    fsMap.set(noteUri.fsPath, '# Projektplan\nErste Phase bis Freitag.');

    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
      ['plan.md', vscode.FileType.File],
      ['plan.chart.json', vscode.FileType.File],
      ['subfolder', vscode.FileType.Directory],
      ['tasks.json', vscode.FileType.File],
    ]);

    vi.spyOn(folderTasksService, 'readFolderCompanion').mockResolvedValue({
      version: 1,
      tasks: [
        { id: '1', title: 'Task 1', completed: false, status: 'todo', priority: 'high', dueDate: '2026-11-05', scheduledDate: '2026-11-02', createdAt: '2026-01-01' },
        { id: '2', title: 'Task 2', completed: true, status: 'done', priority: 'medium', createdAt: '2026-01-01' },
      ],
    });

    const data = await provider.getFolderOverviewData(folderUri);

    expect(data.folderName).toBe('projects');
    expect(data.subfolderCount).toBe(1);
    expect(data.notes.length).toBe(1);
    expect(data.notes[0].title).toBe('Projektplan');
    expect(data.notes[0].hasChart).toBe(true);
    expect(data.tasks.exists).toBe(true);
    expect(data.tasks.openCount).toBe(1);
    expect(data.tasks.completedCount).toBe(1);
    expect(data.tasks.recentTasks[0]).toMatchObject({ dueDate: '2026-11-05', scheduledDate: '2026-11-02' });
    expect(data.tasks.recentTasks[1].dueDate).toBeUndefined();
  });

  it('handles saveSummaryAsNote by writing summary.md and opening in editor', async () => {
    const openSpy = vi.spyOn(vscode.commands, 'executeCommand');
    await provider.open(folderUri);

    await provider.handleMessage({
      type: 'saveSummaryAsNote',
      folderUri: folderUri.toString(),
      summaryContent: '### Zusammenfassung\nErgebnisse hier.',
    });

    const targetPath = '/workspace/notes/projects/summary.md';
    expect(fsMap.has(targetPath)).toBe(true);
    expect(fsMap.get(targetPath)).toContain('Zusammenfassung: projects');
    expect(fsMap.get(targetPath)).toContain('Ergebnisse hier.');
    expect(openSpy).toHaveBeenCalledWith(
      'vscode.openWith',
      expect.objectContaining({ fsPath: targetPath }),
      MarkdownEditorProvider.viewType
    );
  });

  it('handles openFolderTasks and openNote messages', async () => {
    const executeSpy = vi.spyOn(vscode.commands, 'executeCommand');
    await provider.open(folderUri);

    await provider.handleMessage({
      type: 'openFolderTasks',
      folderUri: folderUri.toString(),
    });
    expect(executeSpy).toHaveBeenCalledWith('janus.openFolderTasks', folderUri);

    const noteUri = vscode.Uri.file('/workspace/notes/projects/note.md');
    await provider.handleMessage({
      type: 'openNote',
      noteUri: noteUri.toString(),
    });
    expect(executeSpy).toHaveBeenCalledWith('vscode.openWith', noteUri, MarkdownEditorProvider.viewType);
  });

  it('handles copyToClipboard message', async () => {
    const clipboardSpy = vi.spyOn(vscode.env.clipboard, 'writeText');
    const toastSpy = vi.spyOn(vscode.window, 'showInformationMessage');

    await provider.handleMessage({
      type: 'copyToClipboard',
      text: 'Text zum Kopieren',
    });

    expect(clipboardSpy).toHaveBeenCalledWith('Text zum Kopieren');
    expect(toastSpy).toHaveBeenCalledWith('Zusammenfassung in die Zwischenablage kopiert.');
  });

  it('routes FolderTreeItem and LinkedFolderTreeItem correctly', async () => {
    const { FolderTreeItem, LinkedFolderTreeItem } = await import('../src/ui/notesTreeDataProvider');
    const folderTreeItem = new FolderTreeItem(folderUri);
    expect(folderTreeItem.contextValue).toBe('janusFolder');

    const linkedUri = vscode.Uri.file('/external/shared-notes');
    const linkedTreeItem = new LinkedFolderTreeItem(linkedUri);
    expect(linkedTreeItem.contextValue).toBe('linkedFolder');
  });

  it('handles multi-item selection via openSelection and aggregates data across folders', async () => {
    const note1Uri = vscode.Uri.file('/workspace/notes/meetings/meet.md');
    const note2Uri = vscode.Uri.file('/workspace/notes/projects/proj.md');
    fsMap.set(note1Uri.fsPath, '# Meeting\nNotizen zum Team.');
    fsMap.set(note2Uri.fsPath, '# Projekt\nFeatures besprochen.');

    const panelSpy = vi.spyOn(vscode.window, 'createWebviewPanel');
    const rootUri = vscode.Uri.file('/workspace/notes');

    await provider.openSelection(
      [note1Uri, note2Uri],
      rootUri
    );

    expect(provider.getCurrentMode()).toBe('multi');
    expect(panelSpy).toHaveBeenCalledWith(
      'janus.folderOverview',
      'Übersicht: Auswahl (2 Elemente)',
      vscode.ViewColumn.One,
      expect.any(Object)
    );

    const data = await provider.getSelectionOverviewData(
      [
        { uri: note1Uri, isFolder: false },
        { uri: note2Uri, isFolder: false },
      ],
      rootUri
    );

    expect(data.mode).toBe('multi');
    expect(data.selectedCount).toBe(2);
    expect(data.notes.length).toBe(2);
    expect(data.folderUri).toBe(rootUri.toString());
  });

  it('resolves common folder as save location when all selected notes are in the same folder', async () => {
    const note1Uri = vscode.Uri.file('/workspace/notes/projects/a.md');
    const note2Uri = vscode.Uri.file('/workspace/notes/projects/b.md');
    fsMap.set(note1Uri.fsPath, '# Note A\nText');
    fsMap.set(note2Uri.fsPath, '# Note B\nText');

    const rootUri = vscode.Uri.file('/workspace/notes');
    const data = await provider.getSelectionOverviewData(
      [
        { uri: note1Uri, isFolder: false },
        { uri: note2Uri, isFolder: false },
      ],
      rootUri
    );

    expect(data.defaultSaveLocation).toBe('file:///workspace/notes/projects');
  });
});
