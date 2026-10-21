import * as vscode from 'vscode';
import * as path from 'path';
import { FolderTasksService } from '../services/folderTasksService';
import { MarkdownEditorProvider } from './markdownEditorProvider';

export class GlobalTasksViewProvider {
  public static readonly viewType = 'janus.globalTasksView';
  private panel: vscode.WebviewPanel | undefined;
  private currentNotesRootUri: vscode.Uri | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly folderTasksService: FolderTasksService = new FolderTasksService(),
    private readonly onDidMutate?: () => void,
    private readonly onActiveChange?: () => void
  ) {}

  async open(notesRootUri: vscode.Uri): Promise<void> {
    this.currentNotesRootUri = notesRootUri;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.onActiveChange?.();
      await this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      GlobalTasksViewProvider.viewType,
      'Alle Aufgaben (Workspace)',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
      }
    );

    const groups = await this.folderTasksService.loadAllTasks(notesRootUri);
    const serializedGroups = groups.map((g) => ({
      folder: g.folder,
      uri: g.uri.toString(),
      tasks: g.tasks,
    }));

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview, serializedGroups);

    this.panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    this.panel.onDidChangeViewState?.((e) => {
      if (e.webviewPanel.active) {
        this.onActiveChange?.();
      }
    });

    this.onActiveChange?.();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  async refresh(): Promise<void> {
    if (!this.panel || !this.currentNotesRootUri) {
      return;
    }

    const groups = await this.folderTasksService.loadAllTasks(this.currentNotesRootUri);
    const serializedGroups = groups.map((g) => ({
      folder: g.folder,
      uri: g.uri.toString(),
      tasks: g.tasks,
    }));

    void this.panel.webview.postMessage({
      type: 'initGlobalTasks',
      title: 'Alle Aufgaben (Workspace)',
      groups: serializedGroups,
    });
  }

  async handleMessage(message: any): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    if (message.type === 'ready') {
      await this.refresh();
      return;
    }

    if (message.type === 'toggleTask' && message.folderUri && message.taskId) {
      const tasksUri = this.resolveTasksUri(message.folderUri);
      const tasks = await this.folderTasksService.loadFolderTasks(tasksUri);
      const target = tasks.find((t) => t.id === message.taskId);
      if (target) {
        const completed =
          typeof message.completed === 'boolean' ? message.completed : !target.completed;
        await this.folderTasksService.updateTaskInFolder(tasksUri, {
          ...target,
          completed,
          status: completed ? 'done' : 'todo',
        });
        this.onDidMutate?.();
      }
      return;
    }

    if (message.type === 'updateTask' && message.folderUri && message.task) {
      const tasksUri = this.resolveTasksUri(message.folderUri);
      await this.folderTasksService.updateTaskInFolder(tasksUri, message.task);
      this.onDidMutate?.();
      return;
    }

    if (message.type === 'createTask' && message.folderUri && message.task) {
      const tasksUri = this.resolveTasksUri(message.folderUri);
      await this.folderTasksService.addTaskToFolder(tasksUri, message.task);
      this.onDidMutate?.();
      await this.refresh();
      return;
    }

    if (message.type === 'deleteTask' && message.folderUri && message.taskId) {
      const tasksUri = this.resolveTasksUri(message.folderUri);
      await this.folderTasksService.deleteTaskInFolder(tasksUri, message.taskId);
      this.onDidMutate?.();
      return;
    }

    if (message.type === 'openNote' && typeof message.note === 'string') {
      let folderDir = this.currentNotesRootUri?.fsPath || '';
      if (message.folderUri) {
        const tasksUri = this.resolveTasksUri(message.folderUri);
        folderDir = path.dirname(tasksUri.fsPath);
      }
      const noteUri = vscode.Uri.file(path.join(folderDir, message.note));
      try {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          noteUri,
          MarkdownEditorProvider.viewType
        );
      } catch {
        vscode.window.showErrorMessage(`Notiz konnte nicht geöffnet werden: ${message.note}`);
      }
    }
  }

  private resolveTasksUri(rawUri: string): vscode.Uri {
    if (rawUri.includes('://')) {
      return vscode.Uri.parse(rawUri);
    }
    return vscode.Uri.file(rawUri);
  }

  private getHtmlForWebview(
    webview: vscode.Webview,
    groups: { folder: string; uri: string; tasks: any[] }[]
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'tasks.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );

    const nonce = getNonce();
    const initialJson = JSON.stringify({
      mode: 'global',
      title: 'Alle Aufgaben (Workspace)',
      groups,
    }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alle Aufgaben (Workspace)</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body class="bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] antialiased m-0 p-0">
  <script id="initial-data" type="application/json">${initialJson}</script>
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

