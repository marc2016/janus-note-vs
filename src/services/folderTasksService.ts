import * as vscode from 'vscode';
import * as path from 'path';
import {
  parseTasksCompanion,
  TaskItem,
  TaskItemSchema,
  TasksCompanion,
} from '../models/tasks';

export interface FolderTasksGroup {
  folder: string;
  uri: vscode.Uri;
  tasks: TaskItem[];
}

function stripVirtualFields(task: TaskItem): Omit<TaskItem, 'folder' | 'folderUri'> {
  const { folder: _folder, folderUri: _folderUri, ...rest } = task;
  return rest;
}

export class FolderTasksService {
  /**
   * Recursively scans `notesRootUri` for all `tasks.json` files.
   */
  async findFolderTasksFiles(notesRootUri: vscode.Uri): Promise<vscode.Uri[]> {
    const results: vscode.Uri[] = [];

    const scanDir = async (dirUri: vscode.Uri) => {
      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(dirUri);
      } catch {
        return;
      }

      // Sort entries deterministically
      entries.sort((a, b) => a[0].localeCompare(b[0]));

      for (const [name, fileType] of entries) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'dist') {
          continue;
        }

        const entryUri = vscode.Uri.joinPath(dirUri, name);
        if (fileType === vscode.FileType.Directory) {
          await scanDir(entryUri);
        } else if (fileType === vscode.FileType.File && name === 'tasks.json') {
          results.push(entryUri);
        }
      }
    };

    await scanDir(notesRootUri);
    return results;
  }

  /**
   * Reads and parses a folder's `tasks.json` file, returning its task items.
   */
  async loadFolderTasks(tasksUri: vscode.Uri): Promise<TaskItem[]> {
    const companion = await this.readFolderCompanion(tasksUri);
    return companion.tasks;
  }

  /**
   * Reads the full `TasksCompanion` structure from `tasksUri`.
   */
  async readFolderCompanion(tasksUri: vscode.Uri): Promise<TasksCompanion> {
    try {
      const rawBytes = await vscode.workspace.fs.readFile(tasksUri);
      const rawText = Buffer.from(rawBytes).toString('utf-8');
      return parseTasksCompanion(rawText);
    } catch {
      const folderName = path.basename(path.dirname(tasksUri.fsPath));
      return {
        version: 1,
        title: folderName ? `Aufgaben: ${folderName}` : 'Aufgaben',
        tasks: [],
      };
    }
  }

  /**
   * Writes the `TasksCompanion` structure to `tasksUri` on disk.
   */
  async writeFolderCompanion(
    tasksUri: vscode.Uri,
    companion: { version?: number; title?: string; tasks: TaskItem[] }
  ): Promise<void> {
    const cleanCompanion = {
      version: companion.version ?? 1,
      ...(companion.title ? { title: companion.title } : {}),
      tasks: companion.tasks.map(stripVirtualFields),
    };
    const jsonString = JSON.stringify(cleanCompanion, null, 2) + '\n';
    await vscode.workspace.fs.writeFile(tasksUri, Buffer.from(jsonString, 'utf-8'));
  }

  /**
   * Aggregates all `tasks.json` files across `notesRootUri`, grouped by folder.
   */
  async loadAllTasks(notesRootUri: vscode.Uri): Promise<FolderTasksGroup[]> {
    const files = await this.findFolderTasksFiles(notesRootUri);
    const groups: FolderTasksGroup[] = [];

    for (const fileUri of files) {
      const dirPath = path.dirname(fileUri.fsPath);
      const relFolder = path
        .relative(notesRootUri.fsPath, dirPath)
        .replace(/\\/g, '/');
      const folderName = relFolder || path.basename(notesRootUri.fsPath) || 'root';

      const rawTasks = await this.loadFolderTasks(fileUri);
      const tasks = rawTasks.map((t) => ({
        ...t,
        folder: folderName,
        folderUri: fileUri.toString(),
      }));

      groups.push({
        folder: folderName,
        uri: fileUri,
        tasks,
      });
    }

    return groups;
  }

  /**
   * Updates an existing task inside `tasksUri` on disk.
   */
  async updateTaskInFolder(tasksUri: vscode.Uri, updatedTask: TaskItem): Promise<void> {
    const companion = await this.readFolderCompanion(tasksUri);
    const parsedTask = TaskItemSchema.parse(updatedTask);
    const idx = companion.tasks.findIndex((t) => t.id === parsedTask.id);
    if (idx !== -1) {
      companion.tasks[idx] = parsedTask;
    } else {
      companion.tasks.push(parsedTask);
    }
    await this.writeFolderCompanion(tasksUri, companion);
  }

  /**
   * Appends a new task to `tasksUri` on disk and returns the created `TaskItem`.
   */
  async addTaskToFolder(tasksUri: vscode.Uri, task: Partial<TaskItem>): Promise<TaskItem> {
    const companion = await this.readFolderCompanion(tasksUri);
    const newTask = TaskItemSchema.parse({
      id: task.id || `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: task.title || 'Neue Aufgabe',
      completed: task.completed ?? false,
      status: task.completed ? 'done' : task.status || 'todo',
      priority: task.priority || 'medium',
      note: task.note,
      dueDate: task.dueDate,
      scheduledDate: task.scheduledDate,
      createdAt: task.createdAt || new Date().toISOString(),
    });
    companion.tasks.push(newTask);
    await this.writeFolderCompanion(tasksUri, companion);
    return newTask;
  }

  /**
   * Removes a task by ID from `tasksUri` on disk.
   */
  async deleteTaskInFolder(tasksUri: vscode.Uri, taskId: string): Promise<void> {
    const companion = await this.readFolderCompanion(tasksUri);
    companion.tasks = companion.tasks.filter((t) => t.id !== taskId);
    await this.writeFolderCompanion(tasksUri, companion);
  }

  /**
   * Counts open (`!completed`) tasks in a single `tasks.json` file.
   */
  async countOpenTasksInFile(tasksUri: vscode.Uri): Promise<number> {
    const tasks = await this.loadFolderTasks(tasksUri);
    return tasks.filter((t) => !t.completed).length;
  }

  /**
   * Counts total open (`!completed`) tasks across all `tasks.json` files in `notesRootUri`.
   */
  async countTotalOpenTasks(notesRootUri: vscode.Uri): Promise<number> {
    const groups = await this.loadAllTasks(notesRootUri);
    let count = 0;
    for (const group of groups) {
      count += group.tasks.filter((t) => !t.completed).length;
    }
    return count;
  }
}
