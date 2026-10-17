import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager, CompanionStatus } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';
import { TasksEditorProvider } from '../editors/tasksEditorProvider';
import { ChartEditorProvider } from '../editors/chartEditorProvider';
import { MarkdownEditorProvider } from '../editors/markdownEditorProvider';
import { checkNotesRootStatus } from '../commands/notesRootCommands';
import { FolderTasksService } from '../services/folderTasksService';

export type NotesTreeItem =
  | AllTasksTreeItem
  | FolderTasksTreeItem
  | FolderTreeItem
  | NoteTreeItem
  | CompanionTreeItem;

export class AllTasksTreeItem extends vscode.TreeItem {
  public readonly uri: vscode.Uri;

  constructor(
    public readonly openCount: number = 0,
    notesRootUri?: vscode.Uri
  ) {
    super('Alle Aufgaben', vscode.TreeItemCollapsibleState.None);

    this.uri = notesRootUri || vscode.Uri.parse('janus-tasks:///all');
    this.contextValue = 'janusAllTasks';
    this.iconPath = new vscode.ThemeIcon('checklist');
    this.description = `(${openCount} offen)`;
    this.tooltip = `Alle Aufgaben im Workspace (${openCount} offen)`;
    this.command = {
      command: 'janus.openAllTasks',
      title: 'Alle Aufgaben öffnen',
    };
  }
}

export class FolderTasksTreeItem extends vscode.TreeItem {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly openCount: number = 0
  ) {
    super('Aufgaben', vscode.TreeItemCollapsibleState.None);

    this.resourceUri = uri;
    this.contextValue = 'janusFolderTasks';
    this.iconPath = new vscode.ThemeIcon('checklist');
    this.description = `(${openCount} offen)`;
    this.tooltip = `Ordner-Aufgaben: ${uri.fsPath} (${openCount} offen)`;
    this.command = {
      command: 'vscode.openWith',
      title: 'Ordner-Aufgaben öffnen',
      arguments: [uri, TasksEditorProvider.viewType],
    };
  }
}

export class FolderTreeItem extends vscode.TreeItem {
  constructor(public readonly uri: vscode.Uri) {
    const name = path.basename(uri.fsPath);
    super(name, vscode.TreeItemCollapsibleState.Collapsed);

    this.resourceUri = uri;
    this.contextValue = 'janusFolder';
    this.iconPath = new vscode.ThemeIcon('folder');
    this.tooltip = uri.fsPath;
  }
}

export class NoteTreeItem extends vscode.TreeItem {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly companionStatus?: CompanionStatus
  ) {
    const name = path.basename(uri.fsPath);
    const hasCompanions = Boolean(
      companionStatus && (companionStatus.tasksExist || companionStatus.chartExist)
    );

    super(
      name,
      hasCompanions
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.resourceUri = uri;
    this.contextValue = 'janusNote';
    this.iconPath = new vscode.ThemeIcon('markdown');
    this.tooltip = uri.fsPath;
    this.command = {
      command: 'vscode.openWith',
      title: 'Open in Janus Editor',
      arguments: [uri, MarkdownEditorProvider.viewType],
    };

    if (hasCompanions) {
      const parts: string[] = [];
      if (companionStatus?.tasksExist) parts.push('Tasks');
      if (companionStatus?.chartExist) parts.push('Diagram');
      this.description = parts.join(', ');
    }
  }
}

export class CompanionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly companionType: 'tasks' | 'chart',
    public readonly uri: vscode.Uri,
    public readonly noteUri: vscode.Uri
  ) {
    const isTasks = companionType === 'tasks';
    const label = isTasks ? 'Task Board' : 'Diagram View';

    super(label, vscode.TreeItemCollapsibleState.None);

    this.resourceUri = uri;
    this.contextValue = isTasks ? 'janusCompanionTasks' : 'janusCompanionChart';
    this.iconPath = new vscode.ThemeIcon(isTasks ? 'checklist' : 'graph');
    this.description = path.basename(uri.fsPath);
    this.tooltip = `${label}: ${uri.fsPath}`;

    const viewType = isTasks ? TasksEditorProvider.viewType : ChartEditorProvider.viewType;
    this.command = {
      command: 'vscode.openWith',
      title: `Open ${label}`,
      arguments: [uri, viewType],
    };
  }
}

export class NotesTreeDataProvider implements vscode.TreeDataProvider<NotesTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<NotesTreeItem | undefined | null | void> =
    new vscode.EventEmitter<NotesTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<NotesTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private readonly companionManager: CompanionManager,
    private readonly folderTasksService: FolderTasksService = new FolderTasksService()
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: NotesTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: NotesTreeItem): Promise<NotesTreeItem[]> {
    if (!element) {
      // Root level: return empty if not initialized so VS Code displays viewsWelcome
      const status = await checkNotesRootStatus(this.companionManager);
      if (!status.isInitialized || !status.notesRootUri) {
        return [];
      }
      const totalOpen = await this.folderTasksService.countTotalOpenTasks(status.notesRootUri);
      const allTasksItem = new AllTasksTreeItem(totalOpen);
      const dirItems = await this.readDirectoryItems(status.notesRootUri);
      return [allTasksItem, ...dirItems];
    }

    if (element instanceof FolderTreeItem) {
      return this.readDirectoryItems(element.uri);
    }

    if (element instanceof NoteTreeItem) {
      return this.getCompanionChildren(element);
    }

    // Companion or task items have no children
    return [];
  }

  private async readDirectoryItems(dirUri: vscode.Uri): Promise<NotesTreeItem[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      let folderTasksItem: FolderTasksTreeItem | undefined;
      const folders: FolderTreeItem[] = [];
      const notes: NoteTreeItem[] = [];

      for (const [name, fileType] of entries) {
        if (name.startsWith('.')) {
          continue;
        }

        const entryUri = vscode.Uri.joinPath(dirUri, name);

        if (fileType === vscode.FileType.Directory) {
          folders.push(new FolderTreeItem(entryUri));
        } else if (fileType === vscode.FileType.File && name === 'tasks.json') {
          const openCount = await this.folderTasksService.countOpenTasksInFile(entryUri);
          folderTasksItem = new FolderTasksTreeItem(entryUri, openCount);
        } else if (fileType === vscode.FileType.File && isMarkdownNote(name)) {
          const status = await this.companionManager.getCompanionStatus(entryUri);
          notes.push(new NoteTreeItem(entryUri, status));
        }
      }

      // Sort alphabetically: folders first, then notes
      folders.sort((a, b) => (a.label as string).localeCompare(b.label as string));
      notes.sort((a, b) => (a.label as string).localeCompare(b.label as string));

      return [
        ...(folderTasksItem ? [folderTasksItem] : []),
        ...folders,
        ...notes,
      ];
    } catch (err) {
      console.warn('Error reading notes directory for tree view:', err);
      return [];
    }
  }

  private async getCompanionChildren(noteItem: NoteTreeItem): Promise<CompanionTreeItem[]> {
    const status =
      noteItem.companionStatus ||
      (await this.companionManager.getCompanionStatus(noteItem.uri));

    const children: CompanionTreeItem[] = [];

    if (status.tasksExist) {
      children.push(new CompanionTreeItem('tasks', status.tasksUri, noteItem.uri));
    }
    if (status.chartExist) {
      children.push(new CompanionTreeItem('chart', status.chartUri, noteItem.uri));
    }

    return children;
  }
}
