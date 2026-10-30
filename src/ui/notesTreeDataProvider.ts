import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager, CompanionStatus } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';
import { IMAGE_ASSETS_FOLDER } from '../services/imageAssetService';
import { TasksEditorProvider } from '../editors/tasksEditorProvider';
import { ChartEditorProvider } from '../editors/chartEditorProvider';
import { MarkdownEditorProvider } from '../editors/markdownEditorProvider';
import {
  checkNotesRootStatus,
  getLocalizedRootFolderLabel,
} from '../commands/notesRootCommands';
import { FolderTasksService } from '../services/folderTasksService';
import { CalendarService } from '../services/calendarService';
import { TagIndex, getTagIndex } from '../services/noteTagService';

export type NotesTreeItem =
  | AllTasksTreeItem
  | CalendarTreeItem
  | NoteGraphTreeItem
  | TagsRootTreeItem
  | TagTreeItem
  | FolderTasksTreeItem
  | FolderTreeItem
  | NoteTreeItem
  | CompanionTreeItem
  | LinkedFolderTreeItem
  | ImageTreeItem;

const IMAGE_FILE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

export class CalendarTreeItem extends vscode.TreeItem {
  public readonly uri: vscode.Uri;

  constructor(
    public readonly eventCount: number = 0,
    notesRootUri?: vscode.Uri
  ) {
    super('Kalender', vscode.TreeItemCollapsibleState.None);

    this.uri = notesRootUri || vscode.Uri.parse('janus-calendar:///all');
    this.id = 'janus:calendar';
    this.contextValue = 'janusCalendar';
    this.iconPath = new vscode.ThemeIcon('calendar');
    this.description = `(${eventCount} Termine)`;
    this.tooltip = `Kalender (Monatsansicht & Termine, ${eventCount} Einträge)`;
    this.command = {
      command: 'janus.openCalendar',
      title: 'Kalender öffnen',
    };
  }
}

export class NoteGraphTreeItem extends vscode.TreeItem {
  public readonly uri: vscode.Uri;

  constructor(notesRootUri?: vscode.Uri) {
    super('Netzwerk', vscode.TreeItemCollapsibleState.None);

    this.uri = notesRootUri || vscode.Uri.parse('janus-graph:///all');
    this.id = 'janus:noteGraph';
    this.contextValue = 'janusNoteGraph';
    this.iconPath = new vscode.ThemeIcon('type-hierarchy');
    this.tooltip = 'Notiz-Netzwerk (alle Notizen und ihre Verknüpfungen)';
    this.command = {
      command: 'janus.openNoteGraph',
      title: 'Notiz-Netzwerk öffnen',
    };
  }
}

/** Pinned `Tags` entry; lists every tag of the collection. */
export class TagsRootTreeItem extends vscode.TreeItem {
  public readonly uri = vscode.Uri.parse('janus-tags:///all');

  constructor(public readonly index: TagIndex) {
    super('Tags', vscode.TreeItemCollapsibleState.Collapsed);
    this.id = 'janus:tags';
    this.contextValue = 'janusTags';
    this.iconPath = new vscode.ThemeIcon('tag');
    this.description = `${index.tags.size}`;
    this.tooltip = `${index.tags.size} Tags in deinen Notizen`;
  }
}

/** One tag under `Tags`; expands to the notes carrying it. */
export class TagTreeItem extends vscode.TreeItem {
  public readonly uri: vscode.Uri;

  constructor(
    public readonly tag: string,
    display: string,
    public readonly notes: vscode.Uri[]
  ) {
    super(display, vscode.TreeItemCollapsibleState.Collapsed);
    this.uri = vscode.Uri.parse(`janus-tags:///${encodeURIComponent(tag)}`);
    this.id = `janus:tag:${tag}`;
    this.contextValue = 'janusTag';
    this.iconPath = new vscode.ThemeIcon('tag');
    this.description = `${notes.length}`;
    this.tooltip = `#${display} – ${notes.length === 1 ? '1 Notiz' : `${notes.length} Notizen`}`;
  }
}

export class AllTasksTreeItem extends vscode.TreeItem {
  public readonly uri: vscode.Uri;

  constructor(
    public readonly openCount: number = 0,
    notesRootUri?: vscode.Uri
  ) {
    super('Alle Aufgaben', vscode.TreeItemCollapsibleState.None);

    this.uri = notesRootUri || vscode.Uri.parse('janus-tasks:///all');
    this.id = 'janus:allTasks';
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
  public readonly folderUri: vscode.Uri;

  constructor(
    public readonly uri: vscode.Uri,
    public readonly openCount: number = 0,
    folderUri?: vscode.Uri
  ) {
    super('Aufgaben', vscode.TreeItemCollapsibleState.None);

    this.folderUri = folderUri || vscode.Uri.file(path.dirname(uri.fsPath));
    this.resourceUri = uri;
    this.id = `folderTasks:${this.folderUri.toString()}`;
    this.contextValue = 'janusFolderTasks';
    this.iconPath = new vscode.ThemeIcon('checklist');
    this.description = `(${openCount} offen)`;
    this.tooltip = `Ordner-Aufgaben: ${this.folderUri.fsPath} (${openCount} offen)`;
    this.command = {
      command: 'janus.openFolderTasks',
      title: 'Ordner-Aufgaben öffnen',
      arguments: [this.folderUri],
    };
  }
}

export class FolderTreeItem extends vscode.TreeItem {
  public readonly folderName: string;
  public readonly isPureFolder: boolean;

  constructor(
    public readonly uri: vscode.Uri,
    public readonly isRootChild: boolean = true,
    isPureFolder: boolean = false
  ) {
    const rawName = path.basename(uri.fsPath);
    const displayLabel = isRootChild ? getLocalizedRootFolderLabel(rawName) : rawName;
    super(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);

    this.folderName = rawName;
    this.isPureFolder = isPureFolder;
    this.resourceUri = uri;
    this.id = `folder:${uri.toString()}`;
    this.contextValue = 'janusFolder';
    this.iconPath = new vscode.ThemeIcon('folder');
    this.tooltip = uri.fsPath;
  }
}

/** An `assets` folder next to notes: lists its images and has no folder tasks. */
export class AssetsFolderTreeItem extends FolderTreeItem {
  constructor(uri: vscode.Uri, isRootChild: boolean = false, isPureFolder: boolean = false) {
    super(uri, isRootChild, isPureFolder);
    this.contextValue = 'janusAssetsFolder';
    this.iconPath = new vscode.ThemeIcon('file-media');
    this.tooltip = `Bilder: ${uri.fsPath}`;
  }
}

export class ImageTreeItem extends vscode.TreeItem {
  constructor(public readonly uri: vscode.Uri) {
    super(path.basename(uri.fsPath), vscode.TreeItemCollapsibleState.None);
    this.resourceUri = uri;
    this.id = `image:${uri.toString()}`;
    this.contextValue = 'janusImage';
    this.tooltip = uri.fsPath;
    this.command = { command: 'vscode.open', title: 'Bild öffnen', arguments: [uri] };
  }
}

export class LinkedFolderTreeItem extends vscode.TreeItem {
  public readonly folderRelPath: string;

  constructor(
    public readonly uri: vscode.Uri,
    folderRelPath?: string
  ) {
    const rawName = path.basename(uri.fsPath);
    super(rawName, vscode.TreeItemCollapsibleState.Collapsed);

    this.folderRelPath = folderRelPath || rawName;
    this.resourceUri = uri;
    this.id = `linkedFolder:${uri.toString()}`;
    this.contextValue = 'linkedFolder';
    this.iconPath = new vscode.ThemeIcon('folder-library');
    this.tooltip = `Verknüpfter Ordner: ${uri.fsPath}`;
  }
}

export class NoteTreeItem extends vscode.TreeItem {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly companionStatus?: CompanionStatus
  ) {
    const name = path.basename(uri.fsPath);
    const hasChartCompanion = Boolean(companionStatus?.chartExist);

    super(
      name,
      hasChartCompanion
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.resourceUri = uri;
    this.id = `note:${uri.toString()}`;
    this.contextValue = 'janusNote';
    this.iconPath = new vscode.ThemeIcon('markdown');
    this.tooltip = uri.fsPath;
    this.command = {
      command: 'vscode.openWith',
      title: 'Open in Janus Editor',
      arguments: [uri, MarkdownEditorProvider.viewType],
    };

    if (hasChartCompanion) {
      this.description = 'Diagram';
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
    const label = isTasks ? 'Task List' : 'Diagram View';

    super(label, vscode.TreeItemCollapsibleState.None);

    this.resourceUri = uri;
    this.id = `companion:${companionType}:${uri.toString()}`;
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
    private readonly folderTasksService: FolderTasksService = new FolderTasksService(),
    private readonly calendarService: CalendarService = new CalendarService(folderTasksService)
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: NotesTreeItem): vscode.TreeItem {
    return element;
  }

  async getParent(element: NotesTreeItem): Promise<NotesTreeItem | undefined> {
    if (!element) {
      return undefined;
    }

    if (
      element instanceof CalendarTreeItem ||
      element instanceof NoteGraphTreeItem ||
      element instanceof TagsRootTreeItem ||
      element instanceof TagTreeItem ||
      element instanceof AllTasksTreeItem ||
      element instanceof LinkedFolderTreeItem
    ) {
      return undefined;
    }

    if (element instanceof CompanionTreeItem) {
      const status = await this.companionManager.getCompanionStatus(element.noteUri);
      return new NoteTreeItem(element.noteUri, status);
    }

    const includedUris = this.companionManager.getIncludedFolderUris ? this.companionManager.getIncludedFolderUris() : [];
    const parentDirFsPath = path.dirname(element.uri.fsPath);

    // Check if parent directory matches any included folder root or is inside it
    for (const incUri of includedUris) {
      if (parentDirFsPath === incUri.fsPath) {
        const wsFolder = vscode.workspace.getWorkspaceFolder(incUri);
        const rel = wsFolder
          ? path.relative(wsFolder.uri.fsPath, incUri.fsPath).split(path.sep).join('/')
          : path.basename(incUri.fsPath);
        return new LinkedFolderTreeItem(incUri, rel);
      }
      const relToInc = path.relative(incUri.fsPath, parentDirFsPath);
      if (relToInc !== '' && !relToInc.startsWith('..') && !path.isAbsolute(relToInc)) {
        return new FolderTreeItem(vscode.Uri.file(parentDirFsPath), false, true);
      }
    }

    const status = await checkNotesRootStatus(this.companionManager);
    if (!status.isInitialized || !status.notesRootUri) {
      return undefined;
    }

    const notesRootFsPath = status.notesRootUri.fsPath;

    if (element instanceof FolderTasksTreeItem) {
      const parentDirFsPath = element.folderUri.fsPath;
      if (parentDirFsPath === notesRootFsPath) {
        return undefined;
      }
      const isRootChild = path.dirname(parentDirFsPath) === notesRootFsPath;
      return new FolderTreeItem(element.folderUri, isRootChild);
    }

    if (element instanceof NoteTreeItem) {
      if (parentDirFsPath === notesRootFsPath) {
        return undefined;
      }
      const parentDirUri = vscode.Uri.file(parentDirFsPath);
      const isRootChild = path.dirname(parentDirFsPath) === notesRootFsPath;
      return new FolderTreeItem(parentDirUri, isRootChild);
    }

    if (element instanceof FolderTreeItem) {
      if (element.uri.fsPath === notesRootFsPath || parentDirFsPath === notesRootFsPath) {
        return undefined;
      }
      const parentDirUri = vscode.Uri.file(parentDirFsPath);
      const isRootChild = path.dirname(parentDirFsPath) === notesRootFsPath;
      return new FolderTreeItem(parentDirUri, isRootChild, element.isPureFolder);
    }

    return undefined;
  }

  async getTreeItemForUri(uri: vscode.Uri): Promise<NotesTreeItem | undefined> {
    const includedUris = this.companionManager.getIncludedFolderUris ? this.companionManager.getIncludedFolderUris() : [];
    for (const incUri of includedUris) {
      if (uri.fsPath === incUri.fsPath) {
        const wsFolder = vscode.workspace.getWorkspaceFolder(incUri);
        const rel = wsFolder
          ? path.relative(wsFolder.uri.fsPath, incUri.fsPath).split(path.sep).join('/')
          : path.basename(incUri.fsPath);
        return new LinkedFolderTreeItem(incUri, rel);
      }
      const relToInc = path.relative(incUri.fsPath, uri.fsPath);
      if (relToInc !== '' && !relToInc.startsWith('..') && !path.isAbsolute(relToInc)) {
        if (isMarkdownNote(uri.fsPath)) {
          return new NoteTreeItem(uri);
        }
        return new FolderTreeItem(uri, false, true);
      }
    }

    const status = await checkNotesRootStatus(this.companionManager);
    if (!status.isInitialized || !status.notesRootUri) {
      return undefined;
    }

    if (uri.scheme === 'janus-calendar') {
      const eventCount = await this.calendarService.countCalendarEntries(status.notesRootUri);
      return new CalendarTreeItem(eventCount, status.notesRootUri);
    }

    if (uri.scheme === 'janus-graph') {
      return new NoteGraphTreeItem(status.notesRootUri);
    }

    if (uri.scheme === 'janus-tasks') {
      const totalOpen = await this.folderTasksService.countTotalOpenTasks(status.notesRootUri);
      return new AllTasksTreeItem(totalOpen, status.notesRootUri);
    }

    const relPath = path.relative(status.notesRootUri.fsPath, uri.fsPath);
    if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
      return undefined;
    }

    const fileName = path.basename(uri.fsPath);

    if (isMarkdownNote(uri.fsPath)) {
      const companionStatus = await this.companionManager.getCompanionStatus(uri);
      return new NoteTreeItem(uri, companionStatus);
    }

    if (fileName === 'tasks.json') {
      const folderUri = vscode.Uri.file(path.dirname(uri.fsPath));
      const openCount = await this.folderTasksService.countOpenTasksInFile(uri);
      return new FolderTasksTreeItem(uri, openCount, folderUri);
    }

    if (fileName.endsWith('.chart.json')) {
      const noteName = fileName.replace(/\.chart\.json$/i, '.md');
      const noteUri = vscode.Uri.joinPath(vscode.Uri.file(path.dirname(uri.fsPath)), noteName);
      return new CompanionTreeItem('chart', uri, noteUri);
    }

    // Folders inside the notes root (e.g. targets of folder links)
    if (relPath) {
      try {
        if ((await vscode.workspace.fs.stat(uri)).type === vscode.FileType.Directory) {
          const isRootChild = path.dirname(uri.fsPath) === status.notesRootUri.fsPath;
          return fileName === IMAGE_ASSETS_FOLDER ? new AssetsFolderTreeItem(uri) : new FolderTreeItem(uri, isRootChild);
        }
      } catch {
        // Not a folder
      }
    }

    return undefined;
  }

  async getChildren(element?: NotesTreeItem): Promise<NotesTreeItem[]> {
    if (!element) {
      const status = await checkNotesRootStatus(this.companionManager);
      const includedUris = this.companionManager.getIncludedFolderUris ? this.companionManager.getIncludedFolderUris() : [];

      const items: NotesTreeItem[] = [];

      if (status.isInitialized && status.notesRootUri) {
        const totalOpen = await this.folderTasksService.countTotalOpenTasks(status.notesRootUri);
        const allTasksItem = new AllTasksTreeItem(totalOpen, status.notesRootUri);
        const eventCount = await this.calendarService.countCalendarEntries(status.notesRootUri);
        const calendarItem = new CalendarTreeItem(eventCount, status.notesRootUri);
        const dirItems = await this.readDirectoryItems(status.notesRootUri, false, false);
        const noteGraphItem = new NoteGraphTreeItem(status.notesRootUri);
        items.push(allTasksItem, calendarItem, noteGraphItem);
        const tagIndex = await getTagIndex(this.companionManager.getAllNotesRoots());
        if (tagIndex.tags.size > 0) items.push(new TagsRootTreeItem(tagIndex));
        items.push(...dirItems);
      }

      for (const incUri of includedUris) {
        const wsFolder = vscode.workspace.getWorkspaceFolder(incUri);
        const rel = wsFolder
          ? path.relative(wsFolder.uri.fsPath, incUri.fsPath).split(path.sep).join('/')
          : path.basename(incUri.fsPath);
        items.push(new LinkedFolderTreeItem(incUri, rel));
      }

      return items;
    }

    if (element instanceof TagsRootTreeItem) {
      return [...element.index.tags]
        .map(([tag, info]) => new TagTreeItem(tag, info.display, element.index.notesWithTag(tag)))
        .sort((a, b) => String(a.label).localeCompare(String(b.label)));
    }

    if (element instanceof TagTreeItem) {
      return element.notes.map((uri) => {
        const item = new NoteTreeItem(uri);
        // The same note also appears in its folder; tree IDs must be unique
        item.id = `${element.id}:${uri.toString()}`;
        return item;
      });
    }

    if (element instanceof LinkedFolderTreeItem) {
      return this.readDirectoryItems(element.uri, false, true);
    }

    if (element instanceof AssetsFolderTreeItem) {
      return this.readImageItems(element.uri);
    }

    if (element instanceof FolderTreeItem) {
      return this.readDirectoryItems(element.uri, true, Boolean(element.isPureFolder));
    }

    if (element instanceof NoteTreeItem) {
      return this.getCompanionChildren(element);
    }

    // Companion or task items have no children
    return [];
  }

  private async readImageItems(dirUri: vscode.Uri): Promise<NotesTreeItem[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      return entries
        .filter(([name, type]) => type === vscode.FileType.File && IMAGE_FILE_RE.test(name))
        .map(([name]) => new ImageTreeItem(vscode.Uri.joinPath(dirUri, name)))
        .sort((a, b) => (a.label as string).localeCompare(b.label as string));
    } catch {
      return [];
    }
  }

  private async readDirectoryItems(
    dirUri: vscode.Uri,
    isSubfolder: boolean,
    isPureFolder: boolean = false
  ): Promise<NotesTreeItem[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      let hasTasksJson = false;
      const folders: FolderTreeItem[] = [];
      const notes: NoteTreeItem[] = [];

      for (const [name, fileType] of entries) {
        if (name.startsWith('.')) {
          continue;
        }

        const entryUri = vscode.Uri.joinPath(dirUri, name);

        if (fileType === vscode.FileType.Directory && name === IMAGE_ASSETS_FOLDER) {
          folders.push(new AssetsFolderTreeItem(entryUri, false, isPureFolder));
        } else if (fileType === vscode.FileType.Directory) {
          folders.push(new FolderTreeItem(entryUri, !isSubfolder && !isPureFolder, isPureFolder));
        } else if (fileType === vscode.FileType.File && name === 'tasks.json' && !isPureFolder) {
          hasTasksJson = true;
        } else if (fileType === vscode.FileType.File && isMarkdownNote(name)) {
          if (isPureFolder) {
            notes.push(new NoteTreeItem(entryUri));
          } else {
            const status = await this.companionManager.getCompanionStatus(entryUri);
            notes.push(new NoteTreeItem(entryUri, status));
          }
        }
      }

      // Sort alphabetically: folders first, then notes
      folders.sort((a, b) => (a.label as string).localeCompare(b.label as string));
      notes.sort((a, b) => (a.label as string).localeCompare(b.label as string));

      // Only subfolders get an individual FolderTasksTreeItem (root level uses the global AllTasksTreeItem)
      let folderTasksItem: FolderTasksTreeItem | undefined;
      if (isSubfolder && !isPureFolder) {
        const tasksUri = vscode.Uri.joinPath(dirUri, 'tasks.json');
        const openCount = hasTasksJson
          ? await this.folderTasksService.countOpenTasksInFile(tasksUri)
          : 0;
        folderTasksItem = new FolderTasksTreeItem(tasksUri, openCount, dirUri);
      }

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

    if (status.chartExist) {
      children.push(new CompanionTreeItem('chart', status.chartUri, noteItem.uri));
    }

    return children;
  }
}
