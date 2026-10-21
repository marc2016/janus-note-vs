import * as vscode from 'vscode';
import { parseChartCompanion, ChartCompanion } from '../models/chart';

export class ChartEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'janus.chartEditor';
  private readonly _onDidChangeActiveCustomEditor = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChangeActiveCustomEditor = this._onDidChangeActiveCustomEditor.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(
    context: vscode.ExtensionContext,
    onActiveChange?: (uri: vscode.Uri) => void
  ): vscode.Disposable {
    const provider = new ChartEditorProvider(context);
    if (onActiveChange) {
      provider.onDidChangeActiveCustomEditor(onActiveChange);
    }
    return vscode.window.registerCustomEditorProvider(ChartEditorProvider.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    });
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
        const data = parseChartCompanion(text || '{}');
        webviewPanel.webview.postMessage({
          type: 'init',
          data,
        });
      } catch (err: any) {
        webviewPanel.webview.postMessage({
          type: 'error',
          message: 'Malformed *.chart.json: ' + (err?.message || String(err)),
        });
      }
    };

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'ready') {
        updateWebview();
        return;
      }
      if (message.type === 'openSource') {
        await vscode.window.showTextDocument(document, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false,
        });
        return;
      }
      if (message.type === 'updateChart') {
        try {
          const { code, chartType, title, data, nodes, links, options } = message.data || {};
          const currentText = document.getText();
          let currentData: ChartCompanion;
          try {
            currentData = parseChartCompanion(currentText || '{}');
          } catch {
            currentData = { version: 1, chartType: chartType || 'mermaid' };
          }

          if (code !== undefined) currentData.code = code;
          if (chartType !== undefined) currentData.chartType = chartType;
          if (title !== undefined) currentData.title = title;
          if (data !== undefined) currentData.data = data;
          if (nodes !== undefined) currentData.nodes = nodes;
          if (links !== undefined) currentData.links = links;
          if (options !== undefined) currentData.options = options;

          const outputData: Record<string, any> = { ...currentData };
          if (typeof outputData.code === 'string' && outputData.code.includes('\n')) {
            outputData.code = outputData.code.split('\n');
          }
          const updatedJson = JSON.stringify(outputData, null, 2);
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          );

          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, fullRange, updatedJson);
          await vscode.workspace.applyEdit(edit);
        } catch (error: any) {
          vscode.window.showErrorMessage('Failed to update chart: ' + error.message);
        }
      }
    });

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

    updateWebview();
  }

  private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'chart.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );
    const nonce = getNonce();

    let initialData = {
      version: 1,
      chartType: 'mermaid',
      code: 'graph TD\n    A[Start] --> B[Finish]',
      title: 'Architecture Diagram',
    };
    try {
      const parsed = parseChartCompanion(document.getText() || '{}');
      initialData = { ...initialData, ...parsed };
    } catch {}

    const initialJson = JSON.stringify(initialData).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Janus Diagram View</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body class="bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] antialiased m-0 p-0 overflow-hidden">
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
