import * as vscode from 'vscode';
import * as path from 'path';
import { getCompanionPaths, getNotePathFromCompanion } from './companionPaths';
import { createInitialTasksCompanion, parseTasksCompanion, TasksCompanion } from '../models/tasks';
import { createInitialChartCompanion, parseChartCompanion, ChartCompanion } from '../models/chart';

export interface CompanionStatus {
  noteUri: vscode.Uri;
  tasksUri: vscode.Uri;
  chartUri: vscode.Uri;
  tasksExist: boolean;
  chartExist: boolean;
  tasks?: TasksCompanion;
  chart?: ChartCompanion;
}

export class CompanionManager {
  /**
   * Discovers companion files for a given markdown note URI.
   */
  async getCompanionStatus(noteUri: vscode.Uri): Promise<CompanionStatus> {
    const paths = getCompanionPaths(noteUri.fsPath);
    const tasksUri = vscode.Uri.file(paths.tasksPath);
    const chartUri = vscode.Uri.file(paths.chartPath);

    let tasksExist = false;
    let chartExist = false;
    let tasks: TasksCompanion | undefined;
    let chart: ChartCompanion | undefined;

    try {
      await vscode.workspace.fs.stat(tasksUri);
      tasksExist = true;
      tasks = await this.readTasksCompanion(tasksUri);
    } catch {
      tasksExist = false;
    }

    try {
      await vscode.workspace.fs.stat(chartUri);
      chartExist = true;
      chart = await this.readChartCompanion(chartUri);
    } catch {
      chartExist = false;
    }

    return {
      noteUri,
      tasksUri,
      chartUri,
      tasksExist,
      chartExist,
      tasks,
      chart,
    };
  }

  /**
   * Creates an initial tasks companion file for a note.
   */
  async createTasksCompanion(noteUri: vscode.Uri, title?: string): Promise<vscode.Uri> {
    const paths = getCompanionPaths(noteUri.fsPath);
    const tasksUri = vscode.Uri.file(paths.tasksPath);

    const initial = createInitialTasksCompanion(title || noteUri.path.split('/').pop());
    initial.notePath = noteUri.fsPath;

    const content = Buffer.from(JSON.stringify(initial, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(tasksUri, content);
    return tasksUri;
  }

  /**
   * Creates an initial chart companion file for a note.
   */
  async createChartCompanion(noteUri: vscode.Uri, title?: string): Promise<vscode.Uri> {
    const paths = getCompanionPaths(noteUri.fsPath);
    const chartUri = vscode.Uri.file(paths.chartPath);

    const initial = createInitialChartCompanion(title || noteUri.path.split('/').pop());
    initial.notePath = noteUri.fsPath;

    const content = Buffer.from(JSON.stringify(initial, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(chartUri, content);
    return chartUri;
  }

  /**
   * Reads and parses a tasks companion file.
   */
  async readTasksCompanion(tasksUri: vscode.Uri): Promise<TasksCompanion> {
    const data = await vscode.workspace.fs.readFile(tasksUri);
    const text = Buffer.from(data).toString('utf-8');
    return parseTasksCompanion(text);
  }

  /**
   * Reads and parses a chart companion file.
   */
  async readChartCompanion(chartUri: vscode.Uri): Promise<ChartCompanion> {
    const data = await vscode.workspace.fs.readFile(chartUri);
    const text = Buffer.from(data).toString('utf-8');
    return parseChartCompanion(text);
  }

  /**
   * Finds corresponding note URI given a companion file URI.
   */
  getNoteUriFromCompanion(companionUri: vscode.Uri): vscode.Uri | null {
    const notePath = getNotePathFromCompanion(companionUri.fsPath);
    return notePath ? vscode.Uri.file(notePath) : null;
  }

  /**
   * Resolves the configured notes root directory as a Uri.
   * Defaults to workspace folder root if unset or empty.
   */
  getNotesRootUri(scopeUri?: vscode.Uri): vscode.Uri | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }

    const folder = (scopeUri ? vscode.workspace.getWorkspaceFolder(scopeUri) : undefined) || folders[0];
    const config = vscode.workspace.getConfiguration('janus', folder.uri);
    const notesRoot = (config.get<string>('notesRoot') || '').trim();

    if (!notesRoot) {
      return folder.uri;
    }

    const normalizedRelPath = notesRoot.replace(/^(\.\/|\/)+/, '');
    return vscode.Uri.joinPath(folder.uri, normalizedRelPath);
  }

  /**
   * Resolves the configured additional linked folders (janus.includeFolders) as Uris.
   */
  getIncludedFolderUris(scopeUri?: vscode.Uri): vscode.Uri[] {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return [];
    }

    const folder = (scopeUri ? vscode.workspace.getWorkspaceFolder(scopeUri) : undefined) || folders[0];
    const config = vscode.workspace.getConfiguration('janus', folder.uri);
    const includeFolders = config.get<string[]>('includeFolders', []) || [];

    const uris: vscode.Uri[] = [];
    const seenPaths = new Set<string>();

    for (const rel of includeFolders) {
      if (!rel || typeof rel !== 'string') continue;
      const normalized = rel.replace(/^(\.\/|\/)+/, '').replace(/[\/\\]+$/, '').trim();
      if (!normalized) continue;
      const uri = vscode.Uri.joinPath(folder.uri, normalized);
      if (!seenPaths.has(uri.fsPath)) {
        seenPaths.add(uri.fsPath);
        uris.push(uri);
      }
    }

    return uris;
  }

  /**
   * Returns a deduplicated array of all active roots:
   * [notesRootUri (if resolved), ...getIncludedFolderUris()]
   */
  getAllNotesRoots(scopeUri?: vscode.Uri): vscode.Uri[] {
    const roots: vscode.Uri[] = [];
    const seenPaths = new Set<string>();

    const primaryRoot = this.getNotesRootUri(scopeUri);
    if (primaryRoot) {
      seenPaths.add(primaryRoot.fsPath);
      roots.push(primaryRoot);
    }

    const included = this.getIncludedFolderUris(scopeUri);
    for (const inc of included) {
      if (!seenPaths.has(inc.fsPath)) {
        seenPaths.add(inc.fsPath);
        roots.push(inc);
      }
    }

    return roots;
  }

  /**
   * Checks whether the given URI is located within the active notes root
   * or any of the configured included folders.
   */
  isUnderNotesRoot(uri: vscode.Uri): boolean {
    const allRoots = this.getAllNotesRoots(uri);
    if (allRoots.length === 0) {
      return false;
    }

    for (const root of allRoots) {
      const rel = path.relative(root.fsPath, uri.fsPath);
      if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolves a relative path to a full URI under the configured notes root.
   */
  resolveRelativeNotesPath(relPath: string, scopeUri?: vscode.Uri): vscode.Uri | undefined {
    const root = this.getNotesRootUri(scopeUri);
    if (!root) {
      return undefined;
    }

    const normalized = relPath.replace(/^(\.\/|\/)+/, '');
    return vscode.Uri.joinPath(root, normalized);
  }
}
