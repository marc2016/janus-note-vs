import * as vscode from 'vscode';
import { CompanionManager } from './companionManager';
import { isMarkdownNote } from './companionPaths';

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

    // 1. Tasks CodeLens
    if (status.tasksExist && status.tasks) {
      const total = status.tasks.tasks.length;
      const open = status.tasks.tasks.filter((t) => !t.completed && t.status !== 'done').length;
      const title = `$(checklist) Tasks: ${open}/${total} open`;

      lenses.push(
        new vscode.CodeLens(topRange, {
          title,
          tooltip: 'Open Janus Task Board for this note',
          command: 'vscode.openWith',
          arguments: [status.tasksUri, 'janus.tasksEditor'],
        })
      );
    } else {
      lenses.push(
        new vscode.CodeLens(topRange, {
          title: '$(add) Add Tasks Companion',
          tooltip: 'Create a *.tasks.json companion file for this note',
          command: 'janus.createTasksCompanion',
          arguments: [document.uri],
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
