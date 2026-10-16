import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CompanionManager } from '../src/companion/companionManager';
import {
  NotesTreeDataProvider,
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

  it('reads directory items under notesRoot filtering only folders and markdown notes', async () => {
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
      return [];
    });

    // Mock companion stat to say meeting.tasks.json exists
    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
      if (uri.fsPath.endsWith('meeting.tasks.json')) {
        return {} as any;
      }
      throw new Error('Not found');
    });

    const items = await provider.getChildren();

    // Should contain: subfolder (FolderTreeItem), architecture.markdown (NoteTreeItem), meeting.md (NoteTreeItem)
    expect(items.length).toBe(3);

    const folderItem = items[0] as FolderTreeItem;
    expect(folderItem instanceof FolderTreeItem).toBe(true);
    expect(folderItem.label).toBe('subfolder');
    expect(folderItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);

    const note1 = items[1] as NoteTreeItem;
    expect(note1 instanceof NoteTreeItem).toBe(true);
    expect(note1.label).toBe('architecture.markdown');
    expect(note1.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    expect(note1.command?.command).toBe('vscode.openWith');
    expect(note1.command?.arguments).toEqual([note1.uri, 'janus.markdownEditor']);

    const note2 = items[2] as NoteTreeItem;
    expect(note2 instanceof NoteTreeItem).toBe(true);
    expect(note2.label).toBe('meeting.md');
    expect(note2.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    expect(note2.description).toBe('Tasks');
  });

  it('resolves companion children for a NoteTreeItem', async () => {
    const noteUri = vscode.Uri.file('/workspace/project/notes/meeting.md');

    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
      if (uri.fsPath.endsWith('meeting.tasks.json') || uri.fsPath.endsWith('meeting.chart.json')) {
        return {} as any;
      }
      throw new Error('Not found');
    });

    const noteItem = new NoteTreeItem(noteUri);
    const children = await provider.getChildren(noteItem);

    expect(children.length).toBe(2);
    expect(children[0] instanceof CompanionTreeItem).toBe(true);
    expect((children[0] as CompanionTreeItem).companionType).toBe('tasks');
    expect((children[0] as CompanionTreeItem).label).toBe('Task Board');

    expect(children[1] instanceof CompanionTreeItem).toBe(true);
    expect((children[1] as CompanionTreeItem).companionType).toBe('chart');
    expect((children[1] as CompanionTreeItem).label).toBe('Diagram View');
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
});
