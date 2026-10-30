import * as vscode from 'vscode';
import * as path from 'path';
import { AiFolderSummaryService, SelectionItem } from '../services/aiFolderSummaryService';
import { FolderTasksService } from '../services/folderTasksService';
import { MarkdownEditorProvider } from './markdownEditorProvider';
import { FolderBacklink, findFolderBacklinks } from '../services/noteLinkService';
import { isMarkdownNote } from '../companion/companionPaths';
import { TaskItem } from '../models/tasks';

export interface FolderNoteCard {
  uri: string;
  name: string;
  title: string;
  snippet: string;
  mtime: number;
  relativePath: string;
  hasChart: boolean;
}

export interface FolderTaskSummary {
  exists: boolean;
  tasksUri?: string;
  openCount: number;
  completedCount: number;
  totalCount: number;
  recentTasks: FolderTaskPreview[];
}

export type FolderTaskPreview = Pick<TaskItem, 'id' | 'title' | 'priority' | 'dueDate' | 'scheduledDate'> & {
  completed: boolean;
};

function toTaskPreviews(tasks: TaskItem[]): FolderTaskPreview[] {
  return tasks.slice(0, 8).map((t) => ({
    id: t.id,
    title: t.title,
    completed: !!t.completed,
    priority: t.priority,
    dueDate: t.dueDate,
    scheduledDate: t.scheduledDate,
  }));
}

export interface FolderOverviewData {
  mode: 'folder' | 'multi';
  folderUri: string;
  folderPath: string;
  folderName: string;
  notes: FolderNoteCard[];
  tasks: FolderTaskSummary;
  subfolderCount: number;
  selectedCount?: number;
  canIncludeSubfolders?: boolean;
  /** True when a folder-mode overview shows the configured notes root. */
  isNotesRoot?: boolean;
  /** Notes linking to this folder (folder mode only). */
  folderBacklinks?: FolderBacklink[];
  defaultSaveLocation?: string;
  selectionItems?: Array<{ uri: string; isFolder: boolean }>;
}

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.vscode',
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
]);

export function extractSelectionItem(item: any): SelectionItem | undefined {
  if (!item) return undefined;
  if (item instanceof vscode.Uri) {
    return { uri: item, isFolder: !isMarkdownNote(item.fsPath) };
  }
  const rawUri = item.uri || item.resourceUri;
  if (rawUri instanceof vscode.Uri) {
    const isFolder =
      item.contextValue === 'janusFolder' ||
      item.contextValue === 'linkedFolder' ||
      !isMarkdownNote(rawUri.fsPath);
    return { uri: rawUri, isFolder };
  }
  return undefined;
}

export class FolderOverviewViewProvider {
  public static readonly viewType = 'janus.folderOverview';
  private panel: vscode.WebviewPanel | undefined;
  private currentFolderUri: vscode.Uri | undefined;
  private currentSelection: SelectionItem[] | undefined;
  private currentMode: 'folder' | 'multi' = 'folder';
  private currentNotesRootUri: vscode.Uri | undefined;
  private currentCts: vscode.CancellationTokenSource | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly aiFolderSummaryService: AiFolderSummaryService,
    private readonly folderTasksService: FolderTasksService = new FolderTasksService(),
    private readonly onDidMutate?: () => void,
    private readonly getNotesRootUri?: () => vscode.Uri | undefined
  ) {}

  public getActivePanel(): vscode.WebviewPanel | undefined {
    return this.panel;
  }

  public getCurrentFolderUri(): vscode.Uri | undefined {
    return this.currentFolderUri;
  }

  public getCurrentSelection(): SelectionItem[] | undefined {
    return this.currentSelection;
  }

  public getCurrentMode(): 'folder' | 'multi' {
    return this.currentMode;
  }

  public async open(folderUri: vscode.Uri): Promise<void> {
    this.currentMode = 'folder';
    this.currentFolderUri = folderUri;
    this.currentSelection = undefined;
    const folderName = path.basename(folderUri.fsPath) || 'Ordner';

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.title = `Übersicht: ${folderName}`;
      await this.sendFolderData(folderUri);
      return;
    }

    this.createPanel(`Übersicht: ${folderName}`);
    await this.sendFolderData(folderUri);
  }

  public async openSelection(rawItems: any[], notesRootUri?: vscode.Uri): Promise<void> {
    const items: SelectionItem[] = [];
    const seen = new Set<string>();

    for (const raw of rawItems) {
      const extracted = extractSelectionItem(raw);
      if (extracted && !seen.has(extracted.uri.fsPath)) {
        seen.add(extracted.uri.fsPath);
        items.push(extracted);
      }
    }

    if (items.length === 0) {
      return;
    }

    if (items.length === 1 && items[0].isFolder) {
      await this.open(items[0].uri);
      return;
    }

    this.currentMode = 'multi';
    this.currentSelection = items;
    this.currentNotesRootUri = notesRootUri;
    this.currentFolderUri = undefined;

    const title = `Übersicht: Auswahl (${items.length} Elemente)`;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.title = title;
      await this.sendSelectionData(items, notesRootUri);
      return;
    }

    this.createPanel(title);
    await this.sendSelectionData(items, notesRootUri);
  }

  private createPanel(title: string): void {
    this.panel = vscode.window.createWebviewPanel(
      FolderOverviewViewProvider.viewType,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
      }
    );

    this.panel.iconPath = new vscode.ThemeIcon('dashboard');
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    this.panel.onDidDispose(() => {
      if (this.currentCts) {
        this.currentCts.cancel();
        this.currentCts.dispose();
        this.currentCts = undefined;
      }
      this.panel = undefined;
    });
  }

  public async getFolderOverviewData(folderUri: vscode.Uri): Promise<FolderOverviewData> {
    const folderName = path.basename(folderUri.fsPath) || 'Ordner';
    let entries: [string, vscode.FileType][] = [];
    try {
      entries = await vscode.workspace.fs.readDirectory(folderUri);
    } catch {
      entries = [];
    }

    entries.sort((a, b) => a[0].localeCompare(b[0]));

    const notes: FolderNoteCard[] = [];
    let subfolderCount = 0;

    for (const [name, fileType] of entries) {
      if (name.startsWith('.')) {
        continue;
      }

      if (fileType === vscode.FileType.Directory) {
        if (!IGNORED_DIRECTORIES.has(name)) {
          subfolderCount++;
        }
      } else if (fileType === vscode.FileType.File && isMarkdownNote(name)) {
        const noteUri = vscode.Uri.joinPath(folderUri, name);
        let mtime = 0;
        let title = name.replace(/\.md$/i, '');
        let snippet = '';

        try {
          const stat = await vscode.workspace.fs.stat(noteUri);
          mtime = stat.mtime;
          const rawBytes = await vscode.workspace.fs.readFile(noteUri);
          const content = Buffer.from(rawBytes).toString('utf-8');
          title = this.aiFolderSummaryService.extractTitle(content, name);
          snippet = this.aiFolderSummaryService.extractSnippet(content, 140);
        } catch {}

        const chartCompanionName = name.replace(/\.md$/i, '.chart.json');
        const hasChart = entries.some(([eName]) => eName === chartCompanionName);

        notes.push({
          uri: noteUri.toString(),
          name,
          title,
          snippet,
          mtime,
          relativePath: name,
          hasChart,
        });
      }
    }

    notes.sort((a, b) => b.mtime - a.mtime);

    let tasksSummary: FolderTaskSummary = {
      exists: false,
      openCount: 0,
      completedCount: 0,
      totalCount: 0,
      recentTasks: [],
    };

    try {
      const tasksUri = vscode.Uri.joinPath(folderUri, 'tasks.json');
      const companion = await this.folderTasksService.readFolderCompanion(tasksUri);
      const allTasks = companion.tasks || [];
      const openTasks = allTasks.filter((t) => !t.completed);
      const completedTasks = allTasks.filter((t) => t.completed);

      tasksSummary = {
        exists: true,
        tasksUri: tasksUri.toString(),
        openCount: openTasks.length,
        completedCount: completedTasks.length,
        totalCount: allTasks.length,
        recentTasks: toTaskPreviews(allTasks),
      };
    } catch {}

    const notesRoot = this.getNotesRootUri?.();
    let folderBacklinks: FolderBacklink[] = [];
    if (notesRoot) {
      try {
        folderBacklinks = await findFolderBacklinks(folderUri, notesRoot, notesRoot);
      } catch {
        folderBacklinks = [];
      }
    }

    return {
      mode: 'folder',
      folderUri: folderUri.toString(),
      folderPath: folderUri.fsPath,
      folderName,
      notes,
      tasks: tasksSummary,
      subfolderCount,
      canIncludeSubfolders: subfolderCount > 0,
      isNotesRoot: notesRoot?.fsPath === folderUri.fsPath,
      folderBacklinks,
    };
  }

  public async getSelectionOverviewData(
    items: SelectionItem[],
    notesRootUri?: vscode.Uri
  ): Promise<FolderOverviewData> {
    const notesMap = new Map<string, FolderNoteCard>();
    let subfolderCount = 0;
    const foldersToCheckTasks = new Set<string>();
    const parentDirs = new Set<string>();

    for (const item of items) {
      if (item.isFolder) {
        foldersToCheckTasks.add(item.uri.fsPath);
        parentDirs.add(item.uri.fsPath);

        let entries: [string, vscode.FileType][] = [];
        try {
          entries = await vscode.workspace.fs.readDirectory(item.uri);
        } catch {
          entries = [];
        }

        for (const [name, fileType] of entries) {
          if (name.startsWith('.')) continue;

          if (fileType === vscode.FileType.Directory) {
            if (!IGNORED_DIRECTORIES.has(name)) {
              subfolderCount++;
            }
          } else if (fileType === vscode.FileType.File && isMarkdownNote(name)) {
            const noteUri = vscode.Uri.joinPath(item.uri, name);
            if (!notesMap.has(noteUri.fsPath)) {
              let mtime = 0;
              let title = name.replace(/\.md$/i, '');
              let snippet = '';

              try {
                const stat = await vscode.workspace.fs.stat(noteUri);
                mtime = stat.mtime;
                const rawBytes = await vscode.workspace.fs.readFile(noteUri);
                const content = Buffer.from(rawBytes).toString('utf-8');
                title = this.aiFolderSummaryService.extractTitle(content, name);
                snippet = this.aiFolderSummaryService.extractSnippet(content, 140);
              } catch {}

              const chartCompanionName = name.replace(/\.md$/i, '.chart.json');
              const hasChart = entries.some(([eName]) => eName === chartCompanionName);

              notesMap.set(noteUri.fsPath, {
                uri: noteUri.toString(),
                name,
                title,
                snippet,
                mtime,
                relativePath: `${path.basename(item.uri.fsPath)}/${name}`,
                hasChart,
              });
            }
          }
        }
      } else if (isMarkdownNote(item.uri.fsPath)) {
        parentDirs.add(path.dirname(item.uri.fsPath));
        foldersToCheckTasks.add(path.dirname(item.uri.fsPath));

        if (!notesMap.has(item.uri.fsPath)) {
          let mtime = 0;
          const name = path.basename(item.uri.fsPath);
          let title = name.replace(/\.md$/i, '');
          let snippet = '';

          try {
            const stat = await vscode.workspace.fs.stat(item.uri);
            mtime = stat.mtime;
            const rawBytes = await vscode.workspace.fs.readFile(item.uri);
            const content = Buffer.from(rawBytes).toString('utf-8');
            title = this.aiFolderSummaryService.extractTitle(content, name);
            snippet = this.aiFolderSummaryService.extractSnippet(content, 140);
          } catch {}

          const chartCompanionUri = vscode.Uri.file(item.uri.fsPath.replace(/\.md$/i, '.chart.json'));
          let hasChart = false;
          try {
            await vscode.workspace.fs.stat(chartCompanionUri);
            hasChart = true;
          } catch {}

          notesMap.set(item.uri.fsPath, {
            uri: item.uri.toString(),
            name,
            title,
            snippet,
            mtime,
            relativePath: name,
            hasChart,
          });
        }
      }
    }

    const notes = Array.from(notesMap.values()).sort((a, b) => b.mtime - a.mtime);

    let defaultSaveLocationUri: vscode.Uri;
    if (parentDirs.size === 1) {
      defaultSaveLocationUri = vscode.Uri.file(Array.from(parentDirs)[0]);
    } else if (notesRootUri) {
      defaultSaveLocationUri = notesRootUri;
    } else if (items.length > 0) {
      defaultSaveLocationUri = items[0].isFolder
        ? items[0].uri
        : vscode.Uri.file(path.dirname(items[0].uri.fsPath));
    } else {
      defaultSaveLocationUri = vscode.Uri.file('/');
    }

    const allTasks: TaskItem[] = [];
    for (const folderPath of foldersToCheckTasks) {
      try {
        const tasksUri = vscode.Uri.joinPath(vscode.Uri.file(folderPath), 'tasks.json');
        const companion = await this.folderTasksService.readFolderCompanion(tasksUri);
        if (companion.tasks) {
          allTasks.push(...companion.tasks);
        }
      } catch {}
    }

    const openTasks = allTasks.filter((t) => !t.completed);
    const completedTasks = allTasks.filter((t) => t.completed);

    const tasksSummary: FolderTaskSummary = {
      exists: allTasks.length > 0,
      tasksUri: defaultSaveLocationUri
        ? vscode.Uri.joinPath(defaultSaveLocationUri, 'tasks.json').toString()
        : undefined,
      openCount: openTasks.length,
      completedCount: completedTasks.length,
      totalCount: allTasks.length,
      recentTasks: toTaskPreviews(allTasks),
    };

    return {
      mode: 'multi',
      folderUri: defaultSaveLocationUri.toString(),
      folderPath: defaultSaveLocationUri.fsPath,
      folderName: `Auswahl (${items.length} Elemente)`,
      notes,
      tasks: tasksSummary,
      subfolderCount,
      selectedCount: items.length,
      canIncludeSubfolders: items.some((i) => i.isFolder),
      defaultSaveLocation: defaultSaveLocationUri.toString(),
      selectionItems: items.map((i) => ({ uri: i.uri.toString(), isFolder: i.isFolder })),
    };
  }

  public async sendFolderData(folderUri: vscode.Uri): Promise<void> {
    if (!this.panel) return;
    const data = await this.getFolderOverviewData(folderUri);
    void this.panel.webview.postMessage({
      type: 'updateFolder',
      data,
    });
  }

  public async sendSelectionData(
    items: SelectionItem[],
    notesRootUri?: vscode.Uri
  ): Promise<void> {
    if (!this.panel) return;
    const data = await this.getSelectionOverviewData(items, notesRootUri);
    void this.panel.webview.postMessage({
      type: 'updateFolder',
      data,
    });
  }

  public async handleMessage(message: any): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    const folderUri = message.folderUri
      ? this.resolveUri(message.folderUri)
      : this.currentFolderUri;

    switch (message.type) {
      case 'ready': {
        if (this.currentMode === 'multi' && this.currentSelection) {
          await this.sendSelectionData(this.currentSelection, this.currentNotesRootUri);
        } else if (this.currentFolderUri) {
          await this.sendFolderData(this.currentFolderUri);
        }
        break;
      }

      case 'openNote': {
        if (message.noteUri) {
          const targetUri = this.resolveUri(message.noteUri);
          if (typeof message.line === 'number') {
            await vscode.commands.executeCommand('janus.openNoteAtLine', targetUri, message.line);
          } else {
            await vscode.commands.executeCommand('vscode.openWith', targetUri, MarkdownEditorProvider.viewType);
          }
        }
        break;
      }

      case 'openNoteGraph': {
        await vscode.commands.executeCommand('janus.openNoteGraph');
        break;
      }

      case 'openFolderTasks': {
        if (folderUri) {
          await vscode.commands.executeCommand('janus.openFolderTasks', folderUri);
        }
        break;
      }

      case 'createNote': {
        if (!folderUri) return;
        const titleInput = await vscode.window.showInputBox({
          prompt: 'Titel der neuen Notiz:',
          placeHolder: 'z.B. Projekt-Kickoff oder Recherche',
        });
        if (!titleInput || !titleInput.trim()) return;

        const rawTitle = titleInput.trim();
        const baseFileName = rawTitle
          .toLowerCase()
          .replace(/[\\/:\*\?"<>\|]/g, '-')
          .replace(/\s+/g, '-');
        let noteUri = vscode.Uri.joinPath(folderUri, `${baseFileName}.md`);

        let counter = 1;
        while (true) {
          try {
            await vscode.workspace.fs.stat(noteUri);
            noteUri = vscode.Uri.joinPath(folderUri, `${baseFileName}-${counter}.md`);
            counter++;
          } catch {
            break;
          }
        }

        const initialContent = `# ${rawTitle}\n\n`;
        await vscode.workspace.fs.writeFile(noteUri, Buffer.from(initialContent, 'utf-8'));
        this.onDidMutate?.();
        if (this.currentMode === 'multi' && this.currentSelection) {
          await this.sendSelectionData(this.currentSelection, this.currentNotesRootUri);
        } else if (folderUri) {
          await this.sendFolderData(folderUri);
        }
        await vscode.commands.executeCommand('vscode.openWith', noteUri, MarkdownEditorProvider.viewType);
        break;
      }

      case 'generateSummary': {
        if (this.currentCts) {
          this.currentCts.cancel();
          this.currentCts.dispose();
        }
        this.currentCts = new vscode.CancellationTokenSource();

        void this.panel?.webview.postMessage({
          type: 'summaryLoading',
          loading: true,
        });

        try {
          let summary = '';
          if (this.currentMode === 'multi' && this.currentSelection) {
            summary = await this.aiFolderSummaryService.generateSelectionSummary(
              this.currentSelection,
              { includeSubfolders: !!message.includeSubfolders },
              this.currentCts.token
            );
          } else if (folderUri) {
            summary = await this.aiFolderSummaryService.generateFolderSummary(
              folderUri,
              { includeSubfolders: !!message.includeSubfolders },
              this.currentCts.token
            );
          }

          void this.panel?.webview.postMessage({
            type: 'summaryResult',
            summary,
          });
        } catch (err: any) {
          void this.panel?.webview.postMessage({
            type: 'summaryResult',
            error: err?.message || String(err),
          });
        } finally {
          void this.panel?.webview.postMessage({
            type: 'summaryLoading',
            loading: false,
          });
        }
        break;
      }

      case 'saveSummaryAsNote': {
        if (!message.summaryContent) return;

        const targetFolderUri = message.saveLocationUri
          ? this.resolveUri(message.saveLocationUri)
          : folderUri;
        if (!targetFolderUri) return;

        const titlePrefix =
          this.currentMode === 'multi'
            ? `Auswahl (${this.currentSelection?.length || 0} Elemente)`
            : path.basename(targetFolderUri.fsPath) || 'Ordner';

        let targetUri = vscode.Uri.joinPath(targetFolderUri, 'summary.md');
        let counter = 1;
        while (true) {
          try {
            await vscode.workspace.fs.stat(targetUri);
            targetUri = vscode.Uri.joinPath(targetFolderUri, `summary-${counter}.md`);
            counter++;
          } catch {
            break;
          }
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('de-DE');
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        const noteContent = [
          `# Zusammenfassung: ${titlePrefix}`,
          '',
          `*Erstellt am ${dateStr} um ${timeStr} Uhr via Janus KI-Zusammenfassung.*`,
          '',
          message.summaryContent.trim(),
          '',
        ].join('\n');

        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(noteContent, 'utf-8'));
        this.onDidMutate?.();
        if (this.currentMode === 'multi' && this.currentSelection) {
          await this.sendSelectionData(this.currentSelection, this.currentNotesRootUri);
        } else if (folderUri) {
          await this.sendFolderData(folderUri);
        }
        vscode.window.showInformationMessage(
          `Zusammenfassung gespeichert unter ${path.basename(targetUri.fsPath)}.`
        );
        await vscode.commands.executeCommand('vscode.openWith', targetUri, MarkdownEditorProvider.viewType);
        break;
      }

      case 'copyToClipboard': {
        if (message.text) {
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage('Zusammenfassung in die Zwischenablage kopiert.');
        }
        break;
      }

      case 'exportPdf': {
        if (this.currentMode === 'multi' && this.currentSelection) {
          await vscode.commands.executeCommand(
            'janus.exportFolderToPdf',
            undefined,
            this.currentSelection.map((s) => s.uri)
          );
        } else if (message.folderUri) {
          await vscode.commands.executeCommand(
            'janus.exportFolderToPdf',
            this.resolveUri(message.folderUri)
          );
        }
        break;
      }
    }
  }

  private resolveUri(rawUri: string): vscode.Uri {
    if (rawUri.includes('://')) {
      return vscode.Uri.parse(rawUri);
    }
    return vscode.Uri.file(rawUri);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'folderOverview.js')
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
  <title>Ordnerübersicht</title>
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
