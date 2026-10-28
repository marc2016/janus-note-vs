import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import { checkNotesRootStatus } from '../commands/notesRootCommands';
import { buildNoteGraph } from '../services/noteGraphService';
import { MarkdownEditorProvider } from './markdownEditorProvider';

const REBUILD_DEBOUNCE_MS = 500;

export class NoteGraphViewProvider {
  public static readonly viewType = 'janus.noteGraph';

  private panel: vscode.WebviewPanel | undefined;
  private panelDisposables: vscode.Disposable[] = [];
  private rebuildTimer: ReturnType<typeof setTimeout> | undefined;
  /** Incremented per build so a slow build cannot overwrite fresher data. */
  private buildGeneration = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly companionManager: CompanionManager
  ) {}

  public getActivePanel(): vscode.WebviewPanel | undefined {
    return this.panel;
  }

  public async open(): Promise<void> {
    const status = await checkNotesRootStatus(this.companionManager);
    if (!status.isInitialized || !status.notesRootUri) {
      vscode.window.showInformationMessage(
        'Bitte richte zuerst einen Notizen-Ordner ein, um das Notiz-Netzwerk anzuzeigen.'
      );
      return;
    }

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.createPanel();
  }

  public async handleMessage(message: any): Promise<void> {
    switch (message?.type) {
      case 'ready':
        await this.postGraph();
        break;

      case 'openNote':
        if (typeof message.uri === 'string') {
          await vscode.commands.executeCommand(
            'vscode.openWith',
            vscode.Uri.parse(message.uri),
            MarkdownEditorProvider.viewType
          );
        }
        break;
    }
  }

  /** Coalesces bursts of file or configuration changes into one rebuild. */
  public scheduleRebuild(): void {
    if (!this.panel) return;
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = undefined;
      void this.postGraph();
    }, REBUILD_DEBOUNCE_MS);
  }

  private async postGraph(): Promise<void> {
    if (!this.panel) return;
    const generation = ++this.buildGeneration;
    const roots = this.companionManager.getAllNotesRoots();
    const data = await buildNoteGraph(roots, this.companionManager.getNotesRootUri());
    if (!this.panel || generation !== this.buildGeneration) return;
    await this.panel.webview.postMessage({ type: 'graphData', data });
  }

  private isUnderNotesRoots(uri: vscode.Uri): boolean {
    return this.companionManager.getAllNotesRoots().some((root) => {
      const rel = path.relative(root.fsPath, uri.fsPath);
      return !rel.startsWith('..') && !path.isAbsolute(rel);
    });
  }

  private createPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      NoteGraphViewProvider.viewType,
      'Notiz-Netzwerk',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
      }
    );

    this.panel.iconPath = new vscode.ThemeIcon('type-hierarchy');
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    const onNoteChange = (uri: vscode.Uri) => {
      if (this.isUnderNotesRoots(uri)) this.scheduleRebuild();
    };
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');

    this.panelDisposables.push(
      this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message)),
      watcher,
      watcher.onDidCreate(onNoteChange),
      watcher.onDidChange(onNoteChange),
      watcher.onDidDelete(onNoteChange),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('janus.notesRoot') || e.affectsConfiguration('janus.includeFolders')) {
          this.scheduleRebuild();
        }
      })
    );

    this.panel.onDidDispose(() => {
      if (this.rebuildTimer) {
        clearTimeout(this.rebuildTimer);
        this.rebuildTimer = undefined;
      }
      for (const d of this.panelDisposables) d.dispose();
      this.panelDisposables = [];
      this.panel = undefined;
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'noteGraph.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notiz-Netzwerk</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body class="bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] antialiased m-0 p-0">
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
