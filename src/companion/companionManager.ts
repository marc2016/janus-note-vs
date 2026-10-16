import * as vscode from 'vscode';
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
}
