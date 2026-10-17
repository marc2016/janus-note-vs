import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FolderTasksService } from '../src/services/folderTasksService';

describe('FolderTasksService', () => {
  let service: FolderTasksService;
  const notesRootUri = vscode.Uri.file('/workspace/notes');

  beforeEach(() => {
    service = new FolderTasksService();
    vi.restoreAllMocks();
  });

  it('discovers all tasks.json files across subdirectories ignoring hidden folders', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
      if (uri.fsPath === '/workspace/notes') {
        return [
          ['.git', vscode.FileType.Directory],
          ['projekt-alpha', vscode.FileType.Directory],
          ['sprint-42', vscode.FileType.Directory],
          ['inbox.md', vscode.FileType.File],
        ];
      }
      if (uri.fsPath === '/workspace/notes/projekt-alpha') {
        return [
          ['tasks.json', vscode.FileType.File],
          ['architektur.md', vscode.FileType.File],
        ];
      }
      if (uri.fsPath === '/workspace/notes/sprint-42') {
        return [
          ['tasks.json', vscode.FileType.File],
        ];
      }
      return [];
    });

    const files = await service.findFolderTasksFiles(notesRootUri);
    expect(files.map((f) => f.fsPath)).toEqual([
      '/workspace/notes/projekt-alpha/tasks.json',
      '/workspace/notes/sprint-42/tasks.json',
    ]);
  });

  it('aggregates tasks across folders and calculates total open tasks', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
      if (uri.fsPath === '/workspace/notes') {
        return [
          ['projekt-alpha', vscode.FileType.Directory],
          ['sprint-42', vscode.FileType.Directory],
        ];
      }
      if (uri.fsPath === '/workspace/notes/projekt-alpha') {
        return [['tasks.json', vscode.FileType.File]];
      }
      if (uri.fsPath === '/workspace/notes/sprint-42') {
        return [['tasks.json', vscode.FileType.File]];
      }
      return [];
    });

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
      if (uri.fsPath.includes('projekt-alpha')) {
        return Buffer.from(
          JSON.stringify({
            version: 1,
            tasks: [
              { id: '1', title: 'Task A1', completed: false, priority: 'high', note: 'architektur.md' },
              { id: '2', title: 'Task A2', completed: true, priority: 'low' },
            ],
          }),
          'utf-8'
        );
      }
      return Buffer.from(
        JSON.stringify({
          version: 1,
          tasks: [
            { id: '3', title: 'Task S1', completed: false, priority: 'medium' },
          ],
        }),
        'utf-8'
      );
    });

    const groups = await service.loadAllTasks(notesRootUri);
    expect(groups).toHaveLength(2);
    expect(groups[0].folder).toBe('projekt-alpha');
    expect(groups[0].tasks[0].folder).toBe('projekt-alpha');
    expect(groups[0].tasks[0].note).toBe('architektur.md');
    expect(groups[1].folder).toBe('sprint-42');

    const totalOpen = await service.countTotalOpenTasks(notesRootUri);
    expect(totalOpen).toBe(2);
  });

  it('adds, updates, and deletes tasks in a folder tasks.json without persisting virtual fields', async () => {
    const fileMap = new Map<string, string>();
    const tasksUri = vscode.Uri.file('/workspace/notes/projekt-alpha/tasks.json');

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
      const content = fileMap.get(uri.fsPath);
      if (!content) throw new Error('File not found');
      return Buffer.from(content, 'utf-8');
    });

    vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(async (uri, content) => {
      fileMap.set(uri.fsPath, Buffer.from(content).toString('utf-8'));
    });

    // Add task
    const added = await service.addTaskToFolder(tasksUri, {
      id: 'task-1',
      title: 'Write spec',
      priority: 'high',
      note: 'spec.md',
    });
    expect(added.id).toBe('task-1');
    expect(added.completed).toBe(false);

    // Update task (with virtual fields attached, verifying they are stripped on disk)
    await service.updateTaskInFolder(tasksUri, {
      ...added,
      completed: true,
      status: 'done',
      folder: 'projekt-alpha',
      folderUri: tasksUri.toString(),
    });

    const savedJson = JSON.parse(fileMap.get(tasksUri.fsPath)!);
    expect(savedJson.tasks).toHaveLength(1);
    expect(savedJson.tasks[0].completed).toBe(true);
    expect(savedJson.tasks[0].status).toBe('done');
    expect(savedJson.tasks[0].folder).toBeUndefined();
    expect(savedJson.tasks[0].folderUri).toBeUndefined();

    // Delete task
    await service.deleteTaskInFolder(tasksUri, 'task-1');
    const afterDelete = JSON.parse(fileMap.get(tasksUri.fsPath)!);
    expect(afterDelete.tasks).toHaveLength(0);
  });
});

