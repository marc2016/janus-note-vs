import * as vscode from 'vscode';
import * as path from 'path';
import { CalendarService, CalendarEntry } from '../services/calendarService';
import { FolderTasksService } from '../services/folderTasksService';
import { CalendarDayDetailsViewProvider } from './calendarDayDetailsViewProvider';
import { MarkdownEditorProvider } from './markdownEditorProvider';
import { followDayChange, todayIso } from '../services/calendarToday';

export class CalendarViewProvider {
  public static readonly monthViewType = 'janus.calendarView';
  public static readonly dayDetailsViewType = 'janus.calendarDayDetailsView';

  private monthPanel: vscode.WebviewPanel | undefined;
  private dayDetailsPanel: vscode.WebviewPanel | undefined;
  private currentNotesRootUri: vscode.Uri | undefined;
  private selectedDate: string | undefined;
  /** The day the calendar currently treats as today; re-determined by `checkDayChange`. */
  private currentToday: string = todayIso(new Date());

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly calendarService: CalendarService = new CalendarService(),
    private readonly folderTasksService: FolderTasksService = new FolderTasksService(),
    private readonly onDidMutate?: () => void,
    private readonly dayDetailsViewProvider?: CalendarDayDetailsViewProvider,
    private readonly onActiveChange?: () => void
  ) {}

  /**
   * Opens or reveals the Calendar Month View in ViewColumn.One.
   */
  async open(notesRootUri: vscode.Uri): Promise<void> {
    this.currentNotesRootUri = notesRootUri;
    this.dayDetailsViewProvider?.setNotesRootUri(notesRootUri);

    await this.checkDayChange();

    if (this.monthPanel) {
      this.monthPanel.reveal(vscode.ViewColumn.One);
      this.onActiveChange?.();
      await this.refresh();
      return;
    }

    this.monthPanel = vscode.window.createWebviewPanel(
      CalendarViewProvider.monthViewType,
      'Kalender (Janus Note)',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
      }
    );

    const events = await this.calendarService.loadAllCalendarEntries(notesRootUri);
    const today = new Date();
    this.selectedDate = this.selectedDate || this.currentToday;

    this.monthPanel.webview.html = this.getHtmlForWebview(this.monthPanel.webview, {
      mode: 'month',
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      selectedDate: this.selectedDate,
      today: this.currentToday,
      events,
    });

    this.monthPanel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    this.monthPanel.onDidChangeViewState?.((e) => {
      if (e.webviewPanel.active) {
        this.onActiveChange?.();
      }
      if (e.webviewPanel.visible) {
        void this.checkDayChange();
      }
    });

    this.onActiveChange?.();

    this.monthPanel.onDidDispose(() => {
      this.monthPanel = undefined;
    });
  }

  /**
   * Opens or reveals the synchronized Day Details panel in ViewColumn.Beside.
   */
  async openDayDetails(date: string): Promise<void> {
    this.selectedDate = date;

    if (!this.currentNotesRootUri) {
      return;
    }

    const events = await this.calendarService.loadAllCalendarEntries(this.currentNotesRootUri);

    if (this.dayDetailsPanel) {
      this.dayDetailsPanel.reveal(vscode.ViewColumn.Beside, true);
      this.dayDetailsPanel.title = `Tagesdetails: ${date}`;
      void this.dayDetailsPanel.webview.postMessage({
        type: 'updateDayDetails',
        date,
        events,
      });
      return;
    }

    this.dayDetailsPanel = vscode.window.createWebviewPanel(
      CalendarViewProvider.dayDetailsViewType,
      `Tagesdetails: ${date}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
      }
    );

    this.dayDetailsPanel.webview.html = this.getHtmlForWebview(this.dayDetailsPanel.webview, {
      mode: 'day-details',
      selectedDate: date,
      events,
    });

    this.dayDetailsPanel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    this.dayDetailsPanel.onDidDispose(() => {
      this.dayDetailsPanel = undefined;
    });
  }

  /**
   * Re-determines today. When the day changed, a selection that was the previous today follows to
   * the new day (any other selection stays) and the open calendar views are updated.
   */
  async checkDayChange(now: Date = new Date()): Promise<void> {
    const today = todayIso(now);
    if (today === this.currentToday) {
      return;
    }
    const previousToday = this.currentToday;
    this.currentToday = today;

    const selected = this.dayDetailsViewProvider?.getSelectedDate() ?? this.selectedDate;
    const nextSelected = followDayChange(selected, previousToday, today);
    const selectionFollowed = nextSelected !== selected;
    if (this.selectedDate || selectionFollowed) {
      this.selectedDate = nextSelected;
    }
    if (selectionFollowed) {
      await this.dayDetailsViewProvider?.setSelectedDate(nextSelected, false);
    }

    // The shown month only follows together with the selection
    await this.refresh(selectionFollowed ? previousToday : undefined);
  }

  /**
   * Re-scans calendar events and broadcasts live updates to open panels.
   * `previousToday` is set right after a day change in which the selection followed to the new day.
   */
  async refresh(previousToday?: string): Promise<void> {
    if (!this.currentNotesRootUri) {
      return;
    }

    const events = await this.calendarService.loadAllCalendarEntries(this.currentNotesRootUri);

    if (this.monthPanel) {
      void this.monthPanel.webview.postMessage({
        type: 'updateEvents',
        events,
        selectedDate: this.selectedDate,
        today: this.currentToday,
        previousToday,
      });
    }

    if (this.dayDetailsPanel) {
      void this.dayDetailsPanel.webview.postMessage({
        type: 'updateDayDetails',
        date: this.selectedDate,
        events,
      });
    }

    if (this.dayDetailsViewProvider) {
      await this.dayDetailsViewProvider.refresh();
    }
  }

  /**
   * Handles incoming webview messages from either monthPanel or dayDetailsPanel.
   */
  async handleMessage(message: any): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    if (message.type === 'ready') {
      await this.refresh();
      return;
    }

    if (message.type === 'selectDay' && typeof message.date === 'string') {
      // Remember the selection so refreshes and day changes work with the day the user picked
      this.selectedDate = message.date;
      if (this.dayDetailsViewProvider) {
        await this.dayDetailsViewProvider.setSelectedDate(message.date, true);
      }
      // Also update split panel if it was opened
      if (this.dayDetailsPanel) {
        await this.openDayDetails(message.date);
      }
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
        // Journal entries open at their heading; other entries open the note as before
        if (message.revealLine === true && typeof message.line === 'number' && message.line > 0) {
          await vscode.commands.executeCommand('janus.openNoteAtLine', targetUri, message.line);
          return;
        }
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

  private getHtmlForWebview(
    webview: vscode.Webview,
    initialData: {
      mode: 'month' | 'day-details';
      year?: number;
      month?: number;
      selectedDate?: string;
      today?: string;
      events: CalendarEntry[];
    }
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'calendar.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );

    const nonce = getNonce();
    const initialJson = JSON.stringify(initialData).replace(/</g, '\\u003c');
    const title = initialData.mode === 'day-details' ? 'Tagesdetails' : 'Kalender (Janus Note)';

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="${styleUri}">
  <style>
    html, body {
      height: 100% !important;
      overflow-y: auto !important;
    }
  </style>
</head>
<body class="bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] antialiased m-0 p-0 !overflow-y-auto">
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

