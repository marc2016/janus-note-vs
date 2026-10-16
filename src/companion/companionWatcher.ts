import * as vscode from 'vscode';
import { CompanionCodeLensProvider } from './companionCodeLensProvider';

export class CompanionWatcher implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];
  private _onDidChangeCompanion: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChangeCompanion: vscode.Event<vscode.Uri> = this._onDidChangeCompanion.event;

  constructor(private codeLensProvider: CompanionCodeLensProvider) {
    this.initWatcher();
  }

  private initWatcher(): void {
    // Watch for tasks, chart companion files and markdown notes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{tasks.json,chart.json,md}');

    const handleChange = (uri: vscode.Uri) => {
      this.codeLensProvider.refresh();
      this._onDidChangeCompanion.fire(uri);
    };

    this._disposables.push(
      watcher,
      watcher.onDidCreate(handleChange),
      watcher.onDidChange(handleChange),
      watcher.onDidDelete(handleChange)
    );
  }

  dispose(): void {
    this._onDidChangeCompanion.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}
