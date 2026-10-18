import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CompanionManager } from '../src/companion/companionManager';
import {
  NotesTreeDataProvider,
  AllTasksTreeItem,
  FolderTasksTreeItem,
  FolderTreeItem,
  NoteTreeItem,
  CompanionTreeItem,
} from '../src/ui/notesTreeDataProvider';
import { __setConfigStore } from './__mocks__/vscode';

describe('NotesTreeDataProvider', () => {
  let companionManager: CompanionManager;
  let provider: NotesTreeDataProvider;
  const mockWorkspaceUri = vscode.Uri.file('/workspace/project');

  beforeEach(() => {
    companionManager = new CompanionManager();
    provider = new NotesTreeDataProvider(companionManager);
    __setConfigStore({});
    (vscode.workspace as any).workspaceFolders = [
      { uri: mockWorkspaceUri, name: 'project', index: 0 },
    ];
  });

  it('returns empty array if no notesRoot exists', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const items = await provider.getChildren();
    expect(items).toEqual([]);
  });

  it('returns empty array when workspace is not initialized', async () => {
    __setConfigStore({
      'janus.notesRoot': 'notes',
      'janus.initialized': false,
    });
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
      ['meeting.md', vscode.FileType.File],
    ]);

    const items = await provider.getChildren();
    expect(items).toEqual([]);
  });

  it('displays pinned AllTasksTreeItem at root and filters directory items under notesRoot', async () => {
    __setConfigStore({
      'janus.notesRoot': 'notes',
      'janus.initialized': true,
    });

    const notesRootUri = vscode.Uri.file('/workspace/project/notes');
    const mockEntries: [string, vscode.FileType][] = [
      ['.hidden', vscode.FileType.Directory],
      ['.git', vscode.FileType.Directory],
      ['subfolder', vscode.FileType.Directory],
      ['meeting.md', vscode.FileType.File],
      ['meeting.tasks.json', vscode.FileType.File],
      ['meeting.chart.json', vscode.FileType.File],
      ['script.py', vscode.FileType.File],
      ['readme.txt', vscode.FileType.File],
      ['architecture.markdown', vscode.FileType.File],
    ];

    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
      if (uri.fsPath === notesRootUri.fsPath) {
        return mockEntries;
      }
      if (uri.fsPath === '/workspace/project/notes/subfolder') {
        return [['tasks.json', vscode.FileType.File]];
      }
      return [];
    });

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
      if (uri.fsPath.endsWith('subfolder/tasks.json')) {
        return Buffer.from(
          JSON.stringify({
            version: 1,
            tasks: [
              { id: '1', title: 'Task 1', completed: false },
              { id: '2', title: 'Task 2', completed: false },
              { id: '3', title: 'Task 3', completed: true },
            ],
          }),
          'utf-8'
        );
      }
      return Buffer.from('{}', 'utf-8');
    });

    // Mock companion stat to say meeting.chart.json exists
    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
      if (uri.fsPath.endsWith('meeting.chart.json')) {
        return {} as any;
      }
      throw new Error('Not found');
    });

    const items = await provider.getChildren();

    // Should contain: AllTasksTreeItem, subfolder (FolderTreeItem), architecture.markdown (NoteTreeItem), meeting.md (NoteTreeItem)
    expect(items.length).toBe(4);

    const allTasksItem = items[0] as AllTasksTreeItem;
    expect(allTasksItem instanceof AllTasksTreeItem).toBe(true);
    expect(allTasksItem.label).toBe('Alle Aufgaben');
    expect(allTasksItem.description).toBe('(2 offen)');
    expect(allTasksItem.command?.command).toBe('janus.openAllTasks');

    const folderItem = items[1] as FolderTreeItem;
    expect(folderItem instanceof FolderTreeItem).toBe(true);
    expect(folderItem.label).toBe('subfolder');
    expect(folderItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);

    const note1 = items[2] as NoteTreeItem;
    expect(note1 instanceof NoteTreeItem).toBe(true);
    expect(note1.label).toBe('architecture.markdown');
    expect(note1.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    expect(note1.command?.command).toBe('vscode.openWith');
    expect(note1.command?.arguments).toEqual([note1.uri, 'janus.markdownEditor']);

    const note2 = items[3] as NoteTreeItem;
    expect(note2 instanceof NoteTreeItem).toBe(true);
    expect(note2.label).toBe('meeting.md');
    expect(note2.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    expect(note2.description).toBe('Diagram');
  });

  it('displays FolderTasksTreeItem inside a folder that contains tasks.json', async () => {
    const folderUri = vscode.Uri.file('/workspace/project/notes/projekt-alpha');

    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
      if (uri.fsPath === folderUri.fsPath) {
        return [
          ['tasks.json', vscode.FileType.File],
          ['architektur.md', vscode.FileType.File],
        ];
      }
      return [];
    });

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
      if (uri.fsPath.endsWith('projekt-alpha/tasks.json')) {
        return Buffer.from(
          JSON.stringify({
            version: 1,
            tasks: [
              { id: '1', title: 'Open task 1', completed: false },
              { id: '2', title: 'Open task 2', completed: false },
              { id: '3', title: 'Open task 3', completed: false },
            ],
          }),
          'utf-8'
        );
      }
      return Buffer.from('{}', 'utf-8');
    });

    vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('Not found'));

    const folderItem = new FolderTreeItem(folderUri);
    const children = await provider.getChildren(folderItem);

    expect(children.length).toBe(2);
    const tasksChild = children[0] as FolderTasksTreeItem;
    expect(tasksChild instanceof FolderTasksTreeItem).toBe(true);
    expect(tasksChild.label).toBe('Aufgaben');
    expect(tasksChild.description).toBe('(3 offen)');
    expect(tasksChild.command?.command).toBe('janus.openFolderTasks');
    expect(tasksChild.command?.arguments).toEqual([folderUri]);
  });

  it('resolves diagram companion children for a NoteTreeItem (tasks are strictly per folder)', async () => {
    const noteUri = vscode.Uri.file('/workspace/project/notes/meeting.md');

    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
      if (uri.fsPath.endsWith('meeting.tasks.json') || uri.fsPath.endsWith('meeting.chart.json')) {
        return {} as any;
      }
      throw new Error('Not found');
    });

    const noteItem = new NoteTreeItem(noteUri);
    const children = await provider.getChildren(noteItem);

    expect(children.length).toBe(1);
    expect(children[0] instanceof CompanionTreeItem).toBe(true);
    expect((children[0] as CompanionTreeItem).companionType).toBe('chart');
    expect((children[0] as CompanionTreeItem).label).toBe('Diagram View');
  });

  it('returns empty children for CompanionTreeItem', async () => {
    const companion = new CompanionTreeItem(
      'tasks',
      vscode.Uri.file('/workspace/project/notes/meeting.tasks.json'),
      vscode.Uri.file('/workspace/project/notes/meeting.md')
    );

    const children = await provider.getChildren(companion);
    expect(children).toEqual([]);
  });

  it('fires onDidChangeTreeData when refresh() is called', () => {
    let fired = false;
    provider.onDidChangeTreeData(() => {
      fired = true;
    });

    provider.refresh();
    expect(fired).toBe(true);
  });

  it('renders localized labels for default root folders (meetings, projects, knowledge) based on vscode.env.language', () => {
    (vscode.env as any).language = 'de';
    expect(new FolderTreeItem(vscode.Uri.file('/workspace/notes/meetings'), true).label).toBe(
      'Allgemeine Meetings'
    );
    expect(new FolderTreeItem(vscode.Uri.file('/workspace/notes/projects'), true).label).toBe(
      'Projekte'
    );
    expect(new FolderTreeItem(vscode.Uri.file('/workspace/notes/knowledge'), true).label).toBe(
      'Wissensbasis'
    );

    (vscode.env as any).language = 'en';
    expect(new FolderTreeItem(vscode.Uri.file('/workspace/notes/meetings'), true).label).toBe(
      'General Meetings'
    );
    expect(new FolderTreeItem(vscode.Uri.file('/workspace/notes/projects'), true).label).toBe(
      'Projects'
    );
    expect(new FolderTreeItem(vscode.Uri.file('/workspace/notes/knowledge'), true).label).toBe(
      'Knowledge Base'
    );
    (vscode.env as any).language = 'de';
  });
});
