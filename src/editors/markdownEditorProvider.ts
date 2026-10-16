import * as vscode from 'vscode';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'janus.markdownEditor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MarkdownEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(MarkdownEditorProvider.viewType, provider, {
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
        webviewPanel.webview.postMessage({
          type: 'init',
          content: text,
        });
      } catch (err: any) {
        webviewPanel.webview.postMessage({
          type: 'error',
          message: 'Error loading markdown: ' + (err?.message || String(err)),
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
      if (message.type === 'updateContent') {
        try {
          const newText = message.content;
          if (typeof newText !== 'string' || newText === document.getText()) {
            return;
          }
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          );

          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, fullRange, newText);
          await vscode.workspace.applyEdit(edit);
        } catch (error: any) {
          vscode.window.showErrorMessage('Failed to update markdown file: ' + error.message);
        }
      }
    });

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        const text = e.document.getText();
        webviewPanel.webview.postMessage({
          type: 'update',
          content: text,
        });
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    updateWebview();
  }

  private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'markdown.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );
    const nonce = getNonce();

    const initialContent = document.getText() || '';
    const initialJson = JSON.stringify({ content: initialContent }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Janus Markdown Editor</title>
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
