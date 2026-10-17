import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { GlobalTasksViewProvider } from '../src/editors/globalTasksViewProvider';
import { FolderTasksService } from '../src/services/folderTasksService';

describe('GlobalTasksViewProvider', () => {
  const notesRootUri = vscode.Uri.file('/workspace/notes');
  const mockContext = {
    extensionUri: vscode.Uri.file('/extension'),
  } as unknown as vscode.ExtensionContext;

  let folderTasksService: FolderTasksService;
  let mutatedCount: number;
  let provider: GlobalTasksViewProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    folderTasksService = new FolderTasksService();
    mutatedCount = 0;
    provider = new GlobalTasksViewProvider(mockContext, folderTasksService, () => {
      mutatedCount++;
    });
  });

  it('opens webview panel with aggregated folder groups without creating a root file', async () => {
    const writeSpy = vi.spyOn(vscode.workspace.fs, 'writeFile');
    vi.spyOn(folderTasksService, 'loadAllTasks').mockResolvedValue([
      {
        folder: 'project-a',
        uri: vscode.Uri.file('/workspace/notes/project-a/tasks.json'),
        tasks: [
          {
            id: 't1',
            title: 'Draft specification',
            completed: false,
            status: 'todo',
            priority: 'high',
            createdAt: '2026-01-01T00:00:00.000Z',
            folder: 'project-a',
            folderUri: 'file:///workspace/notes/project-a/tasks.json',
          },
        ],
      },
    ]);

    const panelSpy = vi.spyOn(vscode.window, 'createWebviewPanel');
    await provider.open(notesRootUri);

    expect(panelSpy).toHaveBeenCalledWith(
      'janus.globalTasksView',
      'Alle Aufgaben (Workspace)',
      vscode.ViewColumn.One,
      expect.any(Object)
    );
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('writes task toggle mutations back to the corresponding folder tasks.json on disk', async () => {
    const folderTasksUri = vscode.Uri.file('/workspace/notes/project-a/tasks.json');
    vi.spyOn(folderTasksService, 'loadFolderTasks').mockResolvedValue([
      {
        id: 't1',
        title: 'Draft specification',
        completed: false,
        status: 'todo',
        priority: 'high',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const updateSpy = vi
      .spyOn(folderTasksService, 'updateTaskInFolder')
      .mockResolvedValue(undefined);

    await provider.handleMessage({
      type: 'toggleTask',
      folderUri: folderTasksUri.toString(),
      taskId: 't1',
      completed: true,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/workspace/notes/project-a/tasks.json' }),
      expect.objectContaining({
        id: 't1',
        completed: true,
        status: 'done',
      })
    );
    expect(mutatedCount).toBe(1);
  });

  it('supports creating and deleting tasks in specific folders and opening linked notes', async () => {
    const folderTasksUri = vscode.Uri.file('/workspace/notes/project-a/tasks.json');
    const addSpy = vi.spyOn(folderTasksService, 'addTaskToFolder').mockResolvedValue({
      id: 't2',
      title: 'New task',
      completed: false,
      status: 'todo',
      priority: 'medium',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const deleteSpy = vi
      .spyOn(folderTasksService, 'deleteTaskInFolder')
      .mockResolvedValue(undefined);
    const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    await provider.handleMessage({
      type: 'createTask',
      folderUri: folderTasksUri.toString(),
      task: { title: 'New task', priority: 'medium' },
    });
    expect(addSpy).toHaveBeenCalled();

    await provider.handleMessage({
      type: 'deleteTask',
      folderUri: folderTasksUri.toString(),
      taskId: 't2',
    });
    expect(deleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/workspace/notes/project-a/tasks.json' }),
      't2'
    );

    await provider.handleMessage({
      type: 'openNote',
      folderUri: folderTasksUri.toString(),
      note: 'architektur.md',
    });
    expect(execSpy).toHaveBeenCalledWith(
      'vscode.openWith',
      expect.objectContaining({ path: '/workspace/notes/project-a/architektur.md' }),
      'janus.markdownEditor'
    );
  });
});

