import * as vscode from 'vscode';
import * as path from 'path';
import { parseTasksCompanion, TasksCompanion, TaskItem } from '../models/tasks';
import { MarkdownEditorProvider } from './markdownEditorProvider';

export class TasksEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'janus.tasksEditor';
  private readonly _onDidChangeActiveCustomEditor = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChangeActiveCustomEditor = this._onDidChangeActiveCustomEditor.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(
    context: vscode.ExtensionContext,
    onActiveChange?: (uri: vscode.Uri) => void
  ): vscode.Disposable {
    const provider = new TasksEditorProvider(context);
    if (onActiveChange) {
      provider.onDidChangeActiveCustomEditor(onActiveChange);
    }
    return vscode.window.registerCustomEditorProvider(TasksEditorProvider.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  private getDefaultTitle(document: vscode.TextDocument): string {
    const fileName = path.basename(document.uri.fsPath);
    const folderName = path.basename(path.dirname(document.uri.fsPath));
    if (fileName === 'tasks.json' && folderName) {
      return `Aufgaben: ${folderName}`;
    }
    return 'Janus Task List';
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

    const updateWebview = () => {
      try {
        const text = document.getText();
        const data = parseTasksCompanion(text || '{}');
        if (!data.title || data.title === 'Task Board') {
          data.title = this.getDefaultTitle(document);
        }
        webviewPanel.webview.postMessage({
          type: 'init',
          data,
        });
      } catch (err: any) {
        webviewPanel.webview.postMessage({
          type: 'error',
          message: 'Malformed tasks JSON: ' + (err?.message || String(err)),
        });
      }
    };

    // Listen for changes from webview
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'ready') {
        updateWebview();
        return;
      }

      if (message.type === 'openNote' && typeof message.note === 'string') {
        const folderDir = path.dirname(document.uri.fsPath);
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
        return;
      }

      if (message.type === 'updateTasks') {
        const newTasks: TaskItem[] = message.tasks;
        try {
          const currentText = document.getText();
          let currentData: TasksCompanion;
          try {
            currentData = parseTasksCompanion(currentText || '{}');
          } catch {
            currentData = {
              version: 1,
              title: this.getDefaultTitle(document),
              tasks: [],
            };
          }

          currentData.tasks = newTasks;

          const updatedJson = JSON.stringify(currentData, null, 2);
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          );

          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, fullRange, updatedJson);
          await vscode.workspace.applyEdit(edit);
          // Persist immediately so disk-based consumers (calendar, sidebar, global list) see the change.
          await document.save();
        } catch (error: any) {
          vscode.window.showErrorMessage('Failed to update tasks: ' + error.message);
        }
      }
    });

    // Sync external or undo/redo changes back to webview
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    const viewStateSubscription = webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        this._onDidChangeActiveCustomEditor.fire(document.uri);
      }
    });

    if (webviewPanel.active) {
      this._onDidChangeActiveCustomEditor.fire(document.uri);
    }

    webviewPanel.onDidDispose(() => {
      viewStateSubscription.dispose();
      changeDocumentSubscription.dispose();
    });

    // Initial render
    updateWebview();
  }

  private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'tasks.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );

    const nonce = getNonce();

    const defaultTitle = this.getDefaultTitle(document);
    let initialData: TasksCompanion = { version: 1, title: defaultTitle, tasks: [] };
    try {
      const parsed = parseTasksCompanion(document.getText() || '{}');
      initialData = {
        ...initialData,
        ...parsed,
        title: parsed.title && parsed.title !== 'Task Board' ? parsed.title : defaultTitle,
      };
    } catch {}

    const initialJson = JSON.stringify({ mode: 'folder', ...initialData }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${defaultTitle}</title>
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
