import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import {
  findMarkdownNotesInRoot,
  getNoteLinksData,
} from '../services/noteLinkService';
import { AiModelService } from '../services/aiModelService';
import { AiTaskGeneratorService } from '../services/aiTaskGeneratorService';
import { AiInboxSorterService } from '../services/aiInboxSorterService';
import { TasksEditorProvider } from './tasksEditorProvider';
import { ChartEditorProvider } from './chartEditorProvider';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'janus.markdownEditor';
  private readonly aiModelService: AiModelService;
  private readonly aiTaskGeneratorService: AiTaskGeneratorService;
  private readonly aiInboxSorterService: AiInboxSorterService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly companionManager: CompanionManager = new CompanionManager(),
    aiModelService?: AiModelService,
    aiTaskGeneratorService?: AiTaskGeneratorService,
    aiInboxSorterService?: AiInboxSorterService
  ) {
    this.aiModelService = aiModelService || new AiModelService(context);
    this.aiTaskGeneratorService =
      aiTaskGeneratorService || new AiTaskGeneratorService(this.aiModelService);
    this.aiInboxSorterService =
      aiInboxSorterService ||
      new AiInboxSorterService(this.aiModelService, this.companionManager);
  }

  public static register(
    context: vscode.ExtensionContext,
    companionManager?: CompanionManager,
    aiModelService?: AiModelService,
    aiTaskGeneratorService?: AiTaskGeneratorService,
    aiInboxSorterService?: AiInboxSorterService
  ): vscode.Disposable {
    const provider = new MarkdownEditorProvider(
      context,
      companionManager,
      aiModelService,
      aiTaskGeneratorService,
      aiInboxSorterService
    );
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
        void webviewPanel.webview.postMessage({
          type: 'init',
          content: text,
        });
      } catch (err: any) {
        void webviewPanel.webview.postMessage({
          type: 'error',
          message: 'Error loading markdown: ' + (err?.message || String(err)),
        });
      }
    };

    const sendLinksUpdate = async () => {
      try {
        const [linksData, aiModel] = await Promise.all([
          getNoteLinksData(document.uri, document.getText(), this.companionManager),
          this.aiModelService.getActiveModelInfo(),
        ]);
        linksData.aiModel = aiModel;
        void webviewPanel.webview.postMessage({
          type: 'updateLinks',
          linksData,
        });
      } catch (err) {
        console.warn('Failed to compute note links data:', err);
      }
    };

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      await this.handleWebviewMessage(message, document, webviewPanel, updateWebview, sendLinksUpdate);
    });

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        const text = e.document.getText();
        void webviewPanel.webview.postMessage({
          type: 'update',
          content: text,
        });
        void sendLinksUpdate();
      }
    });

    const aiModelChangeSubscription = this.aiModelService.onDidChangeModel(() => {
      void sendLinksUpdate();
    });

    const configChangeSubscription = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('janus.ai')) {
        void sendLinksUpdate();
      }
    });

    const companionWatcher = vscode.workspace.createFileSystemWatcher(
      '**/{tasks.json,*.tasks.json,*.chart.json,*.md}'
    );
    const refreshLinksOnFs = () => {
      void sendLinksUpdate();
    };
    const subCreate = companionWatcher.onDidCreate(refreshLinksOnFs);
    const subChange = companionWatcher.onDidChange(refreshLinksOnFs);
    const subDelete = companionWatcher.onDidDelete(refreshLinksOnFs);

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      aiModelChangeSubscription.dispose();
      configChangeSubscription.dispose();
      subCreate.dispose();
      subChange.dispose();
      subDelete.dispose();
      companionWatcher.dispose();
    });

    updateWebview();
    void sendLinksUpdate();
  }

  public async handleWebviewMessage(
    message: any,
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    updateWebview?: () => void,
    sendLinksUpdate?: () => Promise<void>
  ): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    if (message.type === 'ready') {
      updateWebview?.();
      if (sendLinksUpdate) {
        void sendLinksUpdate();
      } else {
        const [linksData, aiModel] = await Promise.all([
          getNoteLinksData(document.uri, document.getText(), this.companionManager),
          this.aiModelService.getActiveModelInfo(),
        ]);
        linksData.aiModel = aiModel;
        void webviewPanel.webview.postMessage({
          type: 'updateLinks',
          linksData,
        });
      }
      return;
    }

    if (message.type === 'selectAiModel') {
      await this.aiModelService.selectModelInteractive();
      if (sendLinksUpdate) {
        void sendLinksUpdate();
      }
      return;
    }

    if (message.type === 'generateAiTasks') {
      void webviewPanel.webview.postMessage({
        type: 'aiTasksGenerating',
        isGenerating: true,
      });
      try {
        const result = await this.aiTaskGeneratorService.generateTasksForNote(
          document.uri,
          document.getText()
        );
        void webviewPanel.webview.postMessage({
          type: 'aiTasksGenerating',
          isGenerating: false,
        });
        if (sendLinksUpdate) {
          void sendLinksUpdate();
        }
        if (result.addedTasks.length > 0) {
          void vscode.window
            .showInformationMessage(
              `${result.addedTasks.length} neue Aufgabe(n) wurden zum Ordner hinzugefügt.`,
              'Aufgaben öffnen'
            )
            .then((action) => {
              if (action === 'Aufgaben öffnen') {
                void vscode.commands.executeCommand(
                  'vscode.openWith',
                  result.tasksUri,
                  TasksEditorProvider.viewType
                );
              }
            });
        } else {
          void vscode.window.showInformationMessage(
            'Keine neuen Aufgaben in dieser Notiz gefunden (oder bereits im Ordner vorhanden).'
          );
        }
      } catch (err: any) {
        void webviewPanel.webview.postMessage({
          type: 'aiTasksGenerating',
          isGenerating: false,
        });
        if (sendLinksUpdate) {
          void sendLinksUpdate();
        }
        const msg = err?.message || String(err);
        void vscode.window
          .showErrorMessage(
            `KI-Aufgaben-Generierung fehlgeschlagen: ${msg}`,
            'KI-Modell konfigurieren'
          )
          .then((choice) => {
            if (choice === 'KI-Modell konfigurieren') {
              void this.aiModelService.selectModelInteractive().then(() => {
                if (sendLinksUpdate) {
                  void sendLinksUpdate();
                }
              });
            }
          });
      }
      return;
    }

    if (message.type === 'sortAiInbox') {
      void webviewPanel.webview.postMessage({
        type: 'aiInboxSorting',
        isSorting: true,
      });
      try {
        const result = await this.aiInboxSorterService.sortInbox(document.uri, document);
        void webviewPanel.webview.postMessage({
          type: 'aiInboxSorting',
          isSorting: false,
        });
        updateWebview?.();
        if (sendLinksUpdate) {
          void sendLinksUpdate();
        }
        if (result.cancelled) {
          return;
        }
        if (result.skippedEmpty) {
          void vscode.window.showInformationMessage(
            'Die Inbox (inbox.md) ist leer – es gibt keine Einträge zum Einsortieren.'
          );
        } else if (result.sortedItems.length > 0) {
          const firstTarget = result.sortedItems[0];
          void vscode.window
            .showInformationMessage(
              `${result.sortedItems.length} Abschnitt(e) aus der Inbox einsortiert.`,
              'Notiz öffnen'
            )
            .then((action) => {
              if (action === 'Notiz öffnen' && firstTarget) {
                void vscode.commands.executeCommand(
                  'vscode.openWith',
                  firstTarget.targetUri,
                  MarkdownEditorProvider.viewType
                );
              }
            });
        } else {
          void vscode.window.showInformationMessage(
            'Keine sortierbaren Abschnitte in der Inbox erkannt.'
          );
        }
      } catch (err: any) {
        void webviewPanel.webview.postMessage({
          type: 'aiInboxSorting',
          isSorting: false,
        });
        if (sendLinksUpdate) {
          void sendLinksUpdate();
        }
        const msg = err?.message || String(err);
        void vscode.window
          .showErrorMessage(
            `KI-Inbox-Sortierung fehlgeschlagen: ${msg}`,
            'KI-Modell konfigurieren'
          )
          .then((choice) => {
            if (choice === 'KI-Modell konfigurieren') {
              void this.aiModelService.selectModelInteractive().then(() => {
                if (sendLinksUpdate) {
                  void sendLinksUpdate();
                }
              });
            }
          });
      }
      return;
    }

    if (message.type === 'openSource') {
      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      });
      return;
    }

    if (message.type === 'openLink' && typeof message.targetUri === 'string') {
      const targetUri = message.targetUri.includes('://')
        ? vscode.Uri.parse(message.targetUri)
        : vscode.Uri.file(message.targetUri);

      let viewType = message.viewType as string | undefined;
      if (!viewType) {
        if (targetUri.fsPath.endsWith('tasks.json')) {
          viewType = TasksEditorProvider.viewType;
        } else if (targetUri.fsPath.endsWith('.chart.json')) {
          viewType = ChartEditorProvider.viewType;
        } else {
          viewType = MarkdownEditorProvider.viewType;
        }
      }

      // If target is a missing markdown note, create it on click so broken wiki-links work seamlessly
      if (viewType === MarkdownEditorProvider.viewType) {
        try {
          await vscode.workspace.fs.stat(targetUri);
        } catch {
          const baseTitle = path.basename(targetUri.fsPath).replace(/\.(md|markdown)$/i, '');
          await vscode.workspace.fs.writeFile(
            targetUri,
            Buffer.from(`# ${baseTitle}\n\n`, 'utf-8')
          );
        }
      }

      await vscode.commands.executeCommand('vscode.openWith', targetUri, viewType);
      return;
    }

    if (message.type === 'createCompanion' && typeof message.companionType === 'string') {
      if (message.companionType === 'tasks') {
        const folderUri = vscode.Uri.file(path.dirname(document.uri.fsPath));
        await vscode.commands.executeCommand('janus.openFolderTasks', folderUri);
      } else if (message.companionType === 'chart') {
        await vscode.commands.executeCommand('janus.createChartCompanion', document.uri);
      }
      if (sendLinksUpdate) {
        void sendLinksUpdate();
      }
      return;
    }

    if (message.type === 'addLink') {
      const notesRootUri = this.companionManager.getNotesRootUri(document.uri);
      if (!notesRootUri) {
        return;
      }

      const allNotes = await findMarkdownNotesInRoot(notesRootUri);
      const candidates = allNotes.filter((u) => u.fsPath !== document.uri.fsPath);

      const items: (vscode.QuickPickItem & { noteName: string })[] = candidates.map((u) => {
        const baseName = path.basename(u.fsPath).replace(/\.(md|markdown)$/i, '');
        const relPath = path.relative(notesRootUri.fsPath, u.fsPath).replace(/\\/g, '/');
        return {
          label: baseName,
          description: relPath,
          noteName: baseName,
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Notiz zum Verknüpfen auswählen...',
      });

      if (!selected) {
        return;
      }

      const currentText = document.getText();
      const prefix = currentText.length === 0 || currentText.endsWith('\n') ? '' : '\n';
      const updatedText = `${currentText}${prefix}[[${selected.noteName}]]\n`;

      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(currentText.length)
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, fullRange, updatedText);
      await vscode.workspace.applyEdit(edit);

      if (sendLinksUpdate) {
        await sendLinksUpdate();
      }
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

        if (sendLinksUpdate) {
          await sendLinksUpdate();
        }
      } catch (error: any) {
        vscode.window.showErrorMessage('Failed to update markdown file: ' + error.message);
      }
    }
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
