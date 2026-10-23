import * as vscode from 'vscode';
import * as path from 'path';
import { PdfExportService, CompendiumNoteInput } from '../services/pdfExportService';
import { ExportCompendiumInitData, ExportCompendiumItem } from '../webviews/exportCompendium/ExportCompendiumApp';

export class ExportCompendiumViewProvider {
  public static readonly viewType = 'janus.exportCompendiumView';

  private panel: vscode.WebviewPanel | undefined;
  private currentInitData: ExportCompendiumInitData | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly pdfExportService: PdfExportService = new PdfExportService()
  ) {}

  public async open(
    defaultTitle: string,
    noteUris: vscode.Uri[],
    notesRootUri?: vscode.Uri
  ): Promise<void> {
    if (noteUris.length === 0) {
      vscode.window.showWarningMessage('Keine Notizen zum Exportieren ausgewählt.');
      return;
    }

    const items: ExportCompendiumItem[] = [];
    for (const uri of noteUris) {
      let title = path.basename(uri.fsPath, path.extname(uri.fsPath));
      let relativePath = notesRootUri ? path.relative(notesRootUri.fsPath, uri.fsPath) : path.basename(uri.fsPath);

      try {
        const rawBytes = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(rawBytes).toString('utf-8');
        const match = text.match(/^#\s+(.+)$/m);
        if (match && match[1].trim()) {
          title = match[1].trim();
        }
      } catch {}

      items.push({
        uri: uri.toString(),
        title,
        relativePath,
      });
    }

    this.currentInitData = {
      title: defaultTitle,
      notes: items,
      includeToc: true,
    };

    const windowTitle = `Sammel-PDF Export: ${defaultTitle}`;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.title = windowTitle;
      this.sendInitData();
      return;
    }

    this.createPanel(windowTitle);
  }

  private createPanel(title: string): void {
    this.panel = vscode.window.createWebviewPanel(
      ExportCompendiumViewProvider.viewType,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
      }
    );

    this.panel.iconPath = new vscode.ThemeIcon('file-pdf');
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.sendInitData();
  }

  private sendInitData(): void {
    if (this.panel && this.currentInitData) {
      void this.panel.webview.postMessage({
        type: 'init',
        data: this.currentInitData,
      });
    }
  }

  public async handleMessage(message: any): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    if (message.type === 'ready') {
      this.sendInitData();
      return;
    }

    if (message.type === 'cancel') {
      this.panel?.dispose();
      return;
    }

    if (message.type === 'confirmExport') {
      await this.executeExport(message);
    }
  }

  private async executeExport(message: {
    title: string;
    notes: ExportCompendiumItem[];
    includeToc: boolean;
  }): Promise<void> {
    const rawNotes = message.notes || [];
    if (rawNotes.length === 0) {
      vscode.window.showErrorMessage('Bitte wählen Sie mindestens eine Notiz für den Export aus.');
      this.panel?.webview.postMessage({ type: 'exportStatus', isExporting: false });
      return;
    }

    const sanitizedTitle = (message.title || 'Janus Note Kompendium').replace(/[/\\?%*:|"<>]/g, '-');
    const defaultFileName = `${sanitizedTitle}.pdf`;

    let defaultUri: vscode.Uri | undefined;
    const firstNoteUri = vscode.Uri.parse(rawNotes[0].uri);
    defaultUri = vscode.Uri.joinPath(firstNoteUri, '..', defaultFileName);

    const destinationUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'PDF Dokument': ['pdf'] },
      saveLabel: 'Sammel-PDF exportieren',
      title: 'Sammel-PDF exportieren',
    });

    if (!destinationUri) {
      this.panel?.webview.postMessage({ type: 'exportStatus', isExporting: false });
      return;
    }

    const config = vscode.workspace.getConfiguration('janus.export');
    const customBrowser = config.get<string>('browserPath');

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Janus Note: Sammel-PDF wird generiert (${rawNotes.length} Notizen)...`,
          cancellable: false,
        },
        async () => {
          const compendiumNotes: CompendiumNoteInput[] = [];

          for (const item of rawNotes) {
            const uri = vscode.Uri.parse(item.uri);
            const rawBytes = await vscode.workspace.fs.readFile(uri);
            const markdown = Buffer.from(rawBytes).toString('utf-8');
            compendiumNotes.push({
              title: item.title,
              filePath: uri.fsPath,
              markdown,
            });
          }

          const service = this.pdfExportService || new PdfExportService(customBrowser);
          await service.exportCompendiumToPdf({
            notes: compendiumNotes,
            outputPath: destinationUri.fsPath,
            title: message.title,
            includeToc: message.includeToc,
            browserPath: customBrowser,
          });
        }
      );

      this.panel?.dispose();

      const action = await vscode.window.showInformationMessage(
        `Sammel-PDF erfolgreich exportiert: ${path.basename(destinationUri.fsPath)}`,
        'Öffnen',
        'Im Dateimanager anzeigen'
      );

      if (action === 'Öffnen') {
        await vscode.env.openExternal(destinationUri);
      } else if (action === 'Im Dateimanager anzeigen') {
        await vscode.commands.executeCommand('revealFileInOS', destinationUri);
      }
    } catch (err: any) {
      this.panel?.webview.postMessage({ type: 'exportStatus', isExporting: false });
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes('janus.export.browserPath')) {
        const opt = await vscode.window.showErrorMessage(errorMsg, 'Einstellungen öffnen');
        if (opt === 'Einstellungen öffnen') {
          await vscode.commands.executeCommand('workbench.action.openSettings', 'janus.export.browserPath');
        }
      } else {
        vscode.window.showErrorMessage(`Fehler beim Sammel-PDF-Export: ${errorMsg}`);
      }
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'exportCompendium.js')
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
  <title>Sammel-PDF Export</title>
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

