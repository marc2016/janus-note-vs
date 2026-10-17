import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from './companionManager';
import { isMarkdownNote } from './companionPaths';
import { parseTasksCompanion } from '../models/tasks';

export class CompanionCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor(private companionManager: CompanionManager) {}

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (!isMarkdownNote(document.uri.fsPath)) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    const topRange = new vscode.Range(0, 0, 0, 0);

    const status = await this.companionManager.getCompanionStatus(document.uri);
    const folderUri = vscode.Uri.file(path.dirname(document.uri.fsPath));
    const folderTasksUri = vscode.Uri.joinPath(folderUri, 'tasks.json');

    // 1. Folder Tasks CodeLens (pro Ordner, nicht pro Notiz)
    try {
      const rawBytes = await vscode.workspace.fs.readFile(folderTasksUri);
      const folderTasks = parseTasksCompanion(Buffer.from(rawBytes).toString('utf-8'));
      const total = folderTasks.tasks.length;
      const open = folderTasks.tasks.filter((t) => !t.completed && t.status !== 'done').length;
      lenses.push(
        new vscode.CodeLens(topRange, {
          title: `$(checklist) Ordner-Aufgaben: ${open}/${total} offen`,
          tooltip: 'Ordner-Aufgabenliste (tasks.json) öffnen',
          command: 'janus.openFolderTasks',
          arguments: [folderUri],
        })
      );
    } catch {
      lenses.push(
        new vscode.CodeLens(topRange, {
          title: '$(checklist) Ordner-Aufgaben',
          tooltip: 'Ordner-Aufgabenliste (tasks.json) öffnen oder anlegen',
          command: 'janus.openFolderTasks',
          arguments: [folderUri],
        })
      );
    }

    // 2. Chart CodeLens
    if (status.chartExist && status.chart) {
      const type = status.chart.chartType || 'mermaid';
      const title = `$(graph) Diagram (${type})`;

      lenses.push(
        new vscode.CodeLens(topRange, {
          title,
          tooltip: 'Open Janus Diagram for this note',
          command: 'vscode.openWith',
          arguments: [status.chartUri, 'janus.chartEditor'],
        })
      );
    } else {
      lenses.push(
        new vscode.CodeLens(topRange, {
          title: '$(add) Add Diagram Companion',
          tooltip: 'Create a *.chart.json companion file for this note',
          command: 'janus.createChartCompanion',
          arguments: [document.uri],
        })
      );
    }

    // 3. Rich Markdown Editor CodeLens
    lenses.push(
      new vscode.CodeLens(topRange, {
        title: '$(edit) Rich Editor',
        tooltip: 'Open in Janus Live Preview Markdown Editor',
        command: 'vscode.openWith',
        arguments: [document.uri, 'janus.markdownEditor'],
      })
    );

    return lenses;
  }
}
