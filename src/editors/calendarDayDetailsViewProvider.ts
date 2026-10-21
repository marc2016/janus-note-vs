import * as vscode from 'vscode';
import * as path from 'path';
import { CalendarService, CalendarEntry } from '../services/calendarService';
import { FolderTasksService } from '../services/folderTasksService';
import { MarkdownEditorProvider } from './markdownEditorProvider';

export class CalendarDayDetailsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'janus.calendarDayDetailsView';
  private view?: vscode.WebviewView;
  private currentNotesRootUri?: vscode.Uri;
  private selectedDate?: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly calendarService: CalendarService = new CalendarService(),
    private readonly folderTasksService: FolderTasksService = new FolderTasksService(),
    private readonly onDidMutate?: () => void
  ) {
    const today = new Date();
    this.selectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
  }

  setNotesRootUri(uri?: vscode.Uri): void {
    this.currentNotesRootUri = uri;
    void this.refresh();
  }

  async setSelectedDate(date: string, showView: boolean = true): Promise<void> {
    this.selectedDate = date;
    if (showView && this.view) {
      this.view.show(true);
    }
    await this.refresh();
  }

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
    };

    let events: CalendarEntry[] = [];
    if (this.currentNotesRootUri) {
      events = await this.calendarService.loadAllCalendarEntries(this.currentNotesRootUri);
    }

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, events);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
  }

  async refresh(): Promise<void> {
    if (!this.view) return;

    let events: CalendarEntry[] = [];
    if (this.currentNotesRootUri) {
      events = await this.calendarService.loadAllCalendarEntries(this.currentNotesRootUri);
    }

    if (this.selectedDate) {
      this.view.title = `Tagesdetails: ${this.selectedDate}`;
    }

    void this.view.webview.postMessage({
      type: 'updateDayDetails',
      date: this.selectedDate,
      events,
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

    if (message.type === 'openNote' && typeof message.note === 'string') {
      let targetUri: vscode.Uri;
      if (message.note.includes('://')) {
        targetUri = vscode.Uri.parse(message.note);
      } else if (path.isAbsolute(message.note)) {
        targetUri = vscode.Uri.file(message.note);
      } else if (this.currentNotesRootUri) {
        targetUri = vscode.Uri.file(path.join(this.currentNotesRootUri.fsPath, message.note));
      } else {
        targetUri = vscode.Uri.file(message.note);
      }

      try {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          targetUri,
          MarkdownEditorProvider.viewType
        );
      } catch {
        vscode.window.showErrorMessage(`Notiz konnte nicht geöffnet werden: ${message.note}`);
      }
      return;
    }

    if (message.type === 'toggleTask' && message.folderUri && message.taskId) {
      const tasksUri = message.folderUri.includes('://')
        ? vscode.Uri.parse(message.folderUri)
        : vscode.Uri.file(message.folderUri);

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
        await this.refresh();
      }
    }
  }

  private getHtmlForWebview(webview: vscode.Webview, events: CalendarEntry[]): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'calendar.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );

    const nonce = getNonce();
    const initialJson = JSON.stringify({
      mode: 'day-details',
      selectedDate: this.selectedDate,
      events,
    }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tagesdetails</title>
  <link rel="stylesheet" href="${styleUri}">
  <style>
    html, body {
      height: 100% !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
    }
  </style>
</head>
<body class="bg-[var(--vscode-sideBar-background,#252526)] text-[var(--vscode-sideBar-foreground,#cccccc)] antialiased m-0 p-0 !overflow-y-auto !overflow-x-hidden">
  <script id="initial-data" type="application/json">${initialJson}</script>
  <div id="root" class="min-h-full"></div>
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

