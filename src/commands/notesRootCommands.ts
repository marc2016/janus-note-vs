import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownNote, isTasksCompanion, isChartCompanion } from '../companion/companionPaths';
import { CompanionManager } from '../companion/companionManager';

export async function setNotesRootCommand(folderUri?: vscode.Uri): Promise<void> {
  let targetUri = folderUri;

  if (!targetUri) {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Als Notizen-Ordner festlegen',
    });
    if (selected && selected.length > 0) {
      targetUri = selected[0];
    }
  }

  if (!targetUri) {
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetUri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Der ausgewählte Ordner befindet sich nicht im aktuellen Workspace.');
    return;
  }

  // Check if directory contains non-note files
  try {
    const entries = await vscode.workspace.fs.readDirectory(targetUri);
    const hasNonNoteFiles = entries.some(([name, type]) => {
      if (name.startsWith('.')) return false;
      if (type === vscode.FileType.File) {
        return !isMarkdownNote(name) && !isTasksCompanion(name) && !isChartCompanion(name);
      }
      return false;
    });

    if (hasNonNoteFiles) {
      const choice = await vscode.window.showInformationMessage(
        'In diesem Ordner wurden andere Dateien gefunden (z. B. Quellcode). Möchtest du einen separaten Unterordner für Notizen anlegen?',
        'Neuen Ordner "notes" anlegen',
        'Anderen Namen wählen...',
        'Diesen Ordner trotzdem verwenden'
      );

      if (!choice) {
        return;
      }

      if (choice === 'Neuen Ordner "notes" anlegen') {
        const newFolderUri = vscode.Uri.joinPath(targetUri, 'notes');
        await vscode.workspace.fs.createDirectory(newFolderUri);
        targetUri = newFolderUri;
      } else if (choice === 'Anderen Namen wählen...') {
        const customName = await vscode.window.showInputBox({
          prompt: 'Name des neuen Notizen-Ordners',
          value: 'notes',
          validateInput: (val) => {
            if (!val || !val.trim()) return 'Bitte einen gültigen Ordnernamen eingeben.';
            if (val.includes('/') || val.includes('\\')) return 'Der Name darf keine Pfadtrennzeichen enthalten.';
            return null;
          },
        });
        if (!customName || !customName.trim()) {
          return;
        }
        const newFolderUri = vscode.Uri.joinPath(targetUri, customName.trim());
        await vscode.workspace.fs.createDirectory(newFolderUri);
        targetUri = newFolderUri;
      }
    }
  } catch (err) {
    console.warn('Could not read directory contents when setting notes root:', err);
  }

  const relPath = path.relative(workspaceFolder.uri.fsPath, targetUri.fsPath);
  const normalized = relPath === '' ? '' : relPath.split(path.sep).join('/');

  const config = vscode.workspace.getConfiguration('janus', workspaceFolder.uri);
  await config.update('notesRoot', normalized, vscode.ConfigurationTarget.Workspace);

  if (normalized) {
    vscode.window.showInformationMessage(`Janus Notizen-Ordner gesetzt auf: ${normalized}`);
  } else {
    vscode.window.showInformationMessage('Janus Notizen-Ordner auf Workspace-Root zurückgesetzt.');
  }
}

export async function resetNotesRootCommand(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }

  const workspaceFolder = folders[0];
  const config = vscode.workspace.getConfiguration('janus', workspaceFolder.uri);
  await config.update('notesRoot', '', vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage('Janus Notizen-Ordner auf Workspace-Root zurückgesetzt.');
}

export const DEFAULT_ROOT_FOLDERS = ['meetings', 'projects', 'knowledge'] as const;
export type DefaultRootFolder = (typeof DEFAULT_ROOT_FOLDERS)[number];

export function isDefaultRootFolder(name: string): name is DefaultRootFolder {
  return (DEFAULT_ROOT_FOLDERS as readonly string[]).includes(name.toLowerCase());
}

export function getLocalizedRootFolderLabel(folderName: string, language?: string): string {
  const lang = (language || vscode.env?.language || 'de').toLowerCase();
  const isGerman = lang.startsWith('de');
  switch (folderName.toLowerCase()) {
    case 'meetings':
      return isGerman ? 'Allgemeine Meetings' : 'General Meetings';
    case 'projects':
      return isGerman ? 'Projekte' : 'Projects';
    case 'knowledge':
      return isGerman ? 'Wissensbasis' : 'Knowledge Base';
    default:
      return folderName;
  }
}

export function formatRelativePathWithLocalizedRoot(
  relativePath: string,
  language?: string
): string {
  const segments = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length === 0) {
    return relativePath;
  }
  segments[0] = getLocalizedRootFolderLabel(segments[0], language);
  return segments.join('/');
}

export interface NotesRootStatus {
  isInitialized: boolean;
  hasNonNoteFiles: boolean;
  hasLinkedFolders: boolean;
  notesRootUri?: vscode.Uri;
  includedFolderUris: vscode.Uri[];
}

export async function checkNotesRootStatus(
  companionManager: CompanionManager = new CompanionManager()
): Promise<NotesRootStatus> {
  const rootUri = companionManager.getNotesRootUri();
  const includedFolderUris = companionManager.getIncludedFolderUris ? companionManager.getIncludedFolderUris() : [];
  const hasLinkedFolders = includedFolderUris.length > 0;

  if (!rootUri) {
    return {
      isInitialized: false,
      hasNonNoteFiles: false,
      hasLinkedFolders,
      includedFolderUris,
    };
  }

  const workspaceFolder =
    vscode.workspace.getWorkspaceFolder(rootUri) || vscode.workspace.workspaceFolders?.[0];
  const config = workspaceFolder
    ? vscode.workspace.getConfiguration('janus', workspaceFolder.uri)
    : vscode.workspace.getConfiguration('janus');
  const explicitlyInitialized = config.get<boolean>('initialized', false);

  let hasInbox = false;
  let hasOtherFiles = false;

  try {
    const entries = await vscode.workspace.fs.readDirectory(rootUri);
    for (const [name, fileType] of entries) {
      if (name.startsWith('.')) continue;
      if (name.toLowerCase() === 'inbox.md') {
        hasInbox = true;
      } else if (
        fileType === vscode.FileType.Directory &&
        isDefaultRootFolder(name)
      ) {
        continue;
      } else if (!isTasksCompanion(name) && !isChartCompanion(name)) {
        hasOtherFiles = true;
      }
    }
  } catch {
    // Directory may not exist yet
  }

  const isInitialized = explicitlyInitialized || hasInbox;
  return {
    isInitialized,
    hasNonNoteFiles: hasOtherFiles,
    hasLinkedFolders,
    notesRootUri: rootUri,
    includedFolderUris,
  };
}

export async function updateNotesContextKeys(
  companionManager: CompanionManager = new CompanionManager()
): Promise<NotesRootStatus> {
  const status = await checkNotesRootStatus(companionManager);
  await vscode.commands.executeCommand('setContext', 'janus.isInitialized', status.isInitialized);
  await vscode.commands.executeCommand('setContext', 'janus.hasNonNoteFiles', status.hasNonNoteFiles);
  await vscode.commands.executeCommand('setContext', 'janus.hasLinkedFolders', status.hasLinkedFolders);
  return status;
}

export async function addLinkedFolderCommand(
  folderUri?: vscode.Uri,
  treeProvider?: { refresh: () => void },
  companionManager: CompanionManager = new CompanionManager()
): Promise<void> {
  let targetUri = folderUri;

  if (!targetUri) {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Ordner verknüpfen',
    });
    if (selected && selected.length > 0) {
      targetUri = selected[0];
    }
  }

  if (!targetUri) {
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetUri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Der ausgewählte Ordner befindet sich nicht im aktuellen Workspace.');
    return;
  }

  const relPath = path.relative(workspaceFolder.uri.fsPath, targetUri.fsPath);
  const normalized = relPath === '' ? '' : relPath.split(path.sep).join('/');

  if (!normalized) {
    vscode.window.showWarningMessage('Der gesamte Workspace-Root kann nicht als Unterordner verknüpft werden.');
    return;
  }

  const config = vscode.workspace.getConfiguration('janus', workspaceFolder.uri);
  const currentFolders = config.get<string[]>('includeFolders', []) || [];

  if (currentFolders.includes(normalized)) {
    vscode.window.showInformationMessage(`Der Ordner "${normalized}" ist bereits verknüpft.`);
    return;
  }

  const updatedFolders = [...currentFolders, normalized];
  await config.update('includeFolders', updatedFolders, vscode.ConfigurationTarget.Workspace);

  await updateNotesContextKeys(companionManager);
  if (treeProvider) {
    treeProvider.refresh();
  }

  vscode.window.showInformationMessage(`Ordner "${normalized}" zu Janus Notizen hinzugefügt.`);
}

export async function removeLinkedFolderCommand(
  itemOrUri?: any,
  treeProvider?: { refresh: () => void },
  companionManager: CompanionManager = new CompanionManager()
): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }

  const workspaceFolder = folders[0];
  const config = vscode.workspace.getConfiguration('janus', workspaceFolder.uri);
  const currentFolders = config.get<string[]>('includeFolders', []) || [];

  if (currentFolders.length === 0) {
    vscode.window.showInformationMessage('Keine verknüpften Ordner vorhanden.');
    return;
  }

  let folderToRemove: string | undefined;

  if (itemOrUri && typeof itemOrUri.folderRelPath === 'string') {
    folderToRemove = itemOrUri.folderRelPath;
  } else if (itemOrUri && itemOrUri.uri instanceof vscode.Uri) {
    const wsFolder = vscode.workspace.getWorkspaceFolder(itemOrUri.uri) || workspaceFolder;
    const rel = path.relative(wsFolder.uri.fsPath, itemOrUri.uri.fsPath).split(path.sep).join('/');
    folderToRemove = rel;
  } else if (itemOrUri instanceof vscode.Uri) {
    const wsFolder = vscode.workspace.getWorkspaceFolder(itemOrUri) || workspaceFolder;
    const rel = path.relative(wsFolder.uri.fsPath, itemOrUri.fsPath).split(path.sep).join('/');
    folderToRemove = rel;
  } else {
    // QuickPick when invoked without context
    folderToRemove = await vscode.window.showQuickPick(currentFolders, {
      placeHolder: 'Verknüpften Ordner zum Entfernen auswählen',
    });
  }

  if (!folderToRemove) {
    return;
  }

  const updatedFolders = currentFolders.filter((f) => f !== folderToRemove);
  await config.update('includeFolders', updatedFolders, vscode.ConfigurationTarget.Workspace);

  await updateNotesContextKeys(companionManager);
  if (treeProvider) {
    treeProvider.refresh();
  }

  vscode.window.showInformationMessage(`Ordner "${folderToRemove}" aus verknüpften Notizen entfernt.`);
}

export async function initNotesRootCommand(
  companionManager: CompanionManager = new CompanionManager(),
  treeProvider?: { refresh: () => void }
): Promise<vscode.Uri | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('Kein Workspace geöffnet.');
    return undefined;
  }

  const targetUri = companionManager.getNotesRootUri() || folders[0].uri;

  try {
    await vscode.workspace.fs.createDirectory(targetUri);
    for (const rootFolder of DEFAULT_ROOT_FOLDERS) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(targetUri, rootFolder));
    }
  } catch (err) {
    console.warn('Could not create directory for notes root:', err);
  }

  const inboxUri = vscode.Uri.joinPath(targetUri, 'inbox.md');
  let inboxExists = false;
  try {
    await vscode.workspace.fs.stat(inboxUri);
    inboxExists = true;
  } catch {
    inboxExists = false;
  }

  if (!inboxExists) {
    const initialContent = Buffer.from(
      '# Inbox\n\nWillkommen in deinen Janus Notes!\nHier kannst du neue Notizen und Gedanken erfassen.\n',
      'utf-8'
    );
    await vscode.workspace.fs.writeFile(inboxUri, initialContent);
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetUri) || folders[0];
  const config = vscode.workspace.getConfiguration('janus', workspaceFolder.uri);
  await config.update('initialized', true, vscode.ConfigurationTarget.Workspace);

  await updateNotesContextKeys(companionManager);
  if (treeProvider) {
    treeProvider.refresh();
  }

  try {
    await vscode.commands.executeCommand('vscode.openWith', inboxUri, 'janus.markdownEditor');
  } catch (err) {
    console.warn('Could not open inbox.md in Janus markdown editor:', err);
  }

  return inboxUri;
}
