import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import {
  NotesTreeItem,
  FolderTreeItem,
  NoteTreeItem,
  CompanionTreeItem,
  NotesTreeDataProvider,
} from '../ui/notesTreeDataProvider';
import { MarkdownEditorProvider } from '../editors/markdownEditorProvider';
import {
  RenameOperation,
  RenamePlan,
  applyLinkRewritePlan,
  planLinkUpdatesForRename,
  reportLinkUpdates,
} from '../services/linkRewriteService';

/**
 * Resolves the target directory URI for creating files or folders.
 * Checks context item, active tree view selection, and falls back to notes root.
 */
export async function resolveTargetDirectory(
  contextItem: NotesTreeItem | undefined,
  treeView: vscode.TreeView<NotesTreeItem> | undefined,
  companionManager: CompanionManager
): Promise<vscode.Uri> {
  const item = contextItem || treeView?.selection?.[0];

  if (item) {
    if (item instanceof FolderTreeItem) {
      return item.uri;
    }
    if (item instanceof NoteTreeItem || item instanceof CompanionTreeItem) {
      return vscode.Uri.file(path.dirname(item.uri.fsPath));
    }
  }

  const rootUri = companionManager.getNotesRootUri();
  if (rootUri) {
    return rootUri;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    return workspaceFolder.uri;
  }

  throw new Error('Kein Arbeitsbereich oder Notizen-Ordner geöffnet.');
}

/**
 * Command to create a new folder inside the selected folder or notes root.
 */
export async function createFolderCommand(
  contextItem: NotesTreeItem | undefined,
  treeView: vscode.TreeView<NotesTreeItem> | undefined,
  companionManager: CompanionManager,
  notesTreeDataProvider: NotesTreeDataProvider
): Promise<vscode.Uri | undefined> {
  const targetDir = await resolveTargetDirectory(contextItem, treeView, companionManager);

  const folderName = await vscode.window.showInputBox({
    prompt: 'Name des neuen Ordners:',
    placeHolder: 'z. B. recherchen',
    validateInput: (value: string) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return 'Bitte einen Ordnernamen eingeben';
      }
      if (trimmed.includes('/') || trimmed.includes('\\')) {
        return 'Der Ordnername darf keine Schrägstriche (/ oder \\) enthalten';
      }
      return null;
    },
  });

  if (!folderName) {
    return undefined;
  }

  const trimmedName = folderName.trim();
  const newFolderUri = vscode.Uri.joinPath(targetDir, trimmedName);

  try {
    await vscode.workspace.fs.stat(newFolderUri);
    vscode.window.showWarningMessage(`Ein Ordner oder eine Datei mit dem Namen "${trimmedName}" existiert bereits.`);
    return undefined;
  } catch {
    // Target does not exist yet, proceed with creation
  }

  await vscode.workspace.fs.createDirectory(newFolderUri);
  notesTreeDataProvider.refresh();
  return newFolderUri;
}

/**
 * Command to create a new Markdown note inside the selected folder or notes root.
 * Initializes note with title heading and opens it in the Janus Markdown Editor.
 */
export async function createNoteCommand(
  contextItem: NotesTreeItem | undefined,
  treeView: vscode.TreeView<NotesTreeItem> | undefined,
  companionManager: CompanionManager,
  notesTreeDataProvider: NotesTreeDataProvider
): Promise<vscode.Uri | undefined> {
  const targetDir = await resolveTargetDirectory(contextItem, treeView, companionManager);

  const noteNameInput = await vscode.window.showInputBox({
    prompt: 'Name der neuen Notiz:',
    placeHolder: 'z. B. meeting-notizen',
    validateInput: (value: string) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return 'Bitte einen Notiznamen eingeben';
      }
      if (trimmed.includes('/') || trimmed.includes('\\')) {
        return 'Der Name darf keine Schrägstriche (/ oder \\) enthalten';
      }
      return null;
    },
  });

  if (!noteNameInput) {
    return undefined;
  }

  let finalNoteName = noteNameInput.trim();
  if (!finalNoteName.toLowerCase().endsWith('.md')) {
    finalNoteName += '.md';
  }

  const newNoteUri = vscode.Uri.joinPath(targetDir, finalNoteName);

  try {
    await vscode.workspace.fs.stat(newNoteUri);
    vscode.window.showWarningMessage(`Eine Notiz mit dem Namen "${finalNoteName}" existiert bereits.`);
    return undefined;
  } catch {
    // Note does not exist yet, proceed with creation
  }

  const title = path.basename(finalNoteName, path.extname(finalNoteName));
  const initialContent = `# ${title}\n\n`;

  await vscode.workspace.fs.writeFile(newNoteUri, Buffer.from(initialContent, 'utf8'));
  notesTreeDataProvider.refresh();

  await vscode.commands.executeCommand('vscode.openWith', newNoteUri, MarkdownEditorProvider.viewType);
  return newNoteUri;
}

/**
 * Plans link updates for a rename. Failures must never block the rename itself.
 */
async function planLinkUpdates(
  op: RenameOperation,
  companionManager: CompanionManager
): Promise<RenamePlan | undefined> {
  const scopeUri = vscode.Uri.file(op.oldPath);
  const roots = companionManager.getAllNotesRoots(scopeUri);
  if (roots.length === 0) {
    return undefined;
  }
  try {
    return await planLinkUpdatesForRename(op, roots, companionManager.getNotesRootUri(scopeUri));
  } catch (err) {
    console.warn('Failed to plan link updates for rename:', err);
    return undefined;
  }
}

async function applyLinkUpdates(plan: RenamePlan | undefined): Promise<void> {
  if (!plan || (plan.files.length === 0 && plan.skipped === 0)) {
    return;
  }
  const result = await applyLinkRewritePlan(plan);
  reportLinkUpdates(result, plan.skipped);
}

/**
 * Command to rename an item (folder or note) in the Janus notes tree.
 * Automatically synchronizes companion files (*.tasks.json, *.chart.json) when renaming a note,
 * and rewrites links that pointed to the renamed note or to notes inside the renamed folder.
 */
export async function renameItemCommand(
  item: NotesTreeItem | undefined,
  treeView: vscode.TreeView<NotesTreeItem> | undefined,
  companionManager: CompanionManager,
  notesTreeDataProvider: NotesTreeDataProvider
): Promise<void> {
  const targetItem = item || treeView?.selection?.[0];
  if (!targetItem) {
    return;
  }

  if (targetItem instanceof FolderTreeItem) {
    const currentName = path.basename(targetItem.uri.fsPath);
    const newNameInput = await vscode.window.showInputBox({
      prompt: 'Neuen Ordnernamen eingeben:',
      value: currentName,
      validateInput: (value: string) => {
        const trimmed = value?.trim();
        if (!trimmed) {
          return 'Bitte einen Ordnernamen eingeben';
        }
        if (trimmed.includes('/') || trimmed.includes('\\')) {
          return 'Der Ordnername darf keine Schrägstriche (/ oder \\) enthalten';
        }
        return null;
      },
    });

    if (!newNameInput || newNameInput.trim() === currentName) {
      return;
    }

    const trimmedNewName = newNameInput.trim();
    const parentUri = vscode.Uri.file(path.dirname(targetItem.uri.fsPath));
    const destFolderUri = vscode.Uri.joinPath(parentUri, trimmedNewName);

    try {
      await vscode.workspace.fs.stat(destFolderUri);
      vscode.window.showErrorMessage(`Ein Ordner mit dem Namen "${trimmedNewName}" existiert bereits.`);
      return;
    } catch {
      // Destination does not exist
    }

    const linkPlan = await planLinkUpdates(
      { oldPath: targetItem.uri.fsPath, newPath: destFolderUri.fsPath, isFolder: true },
      companionManager
    );

    await vscode.workspace.fs.rename(targetItem.uri, destFolderUri);
    notesTreeDataProvider.refresh();
    await applyLinkUpdates(linkPlan);
    return;
  }

  if (targetItem instanceof NoteTreeItem) {
    const currentFullName = path.basename(targetItem.uri.fsPath);
    const newNameInput = await vscode.window.showInputBox({
      prompt: 'Neuen Notiznamen eingeben:',
      value: currentFullName,
      validateInput: (value: string) => {
        const trimmed = value?.trim();
        if (!trimmed) {
          return 'Bitte einen Notiznamen eingeben';
        }
        if (trimmed.includes('/') || trimmed.includes('\\')) {
          return 'Der Name darf keine Schrägstriche (/ oder \\) enthalten';
        }
        return null;
      },
    });

    if (!newNameInput || newNameInput.trim() === currentFullName) {
      return;
    }

    let finalNewName = newNameInput.trim();
    if (!finalNewName.toLowerCase().endsWith('.md')) {
      finalNewName += '.md';
    }

    if (finalNewName === currentFullName) {
      return;
    }

    const parentUri = vscode.Uri.file(path.dirname(targetItem.uri.fsPath));
    const destNoteUri = vscode.Uri.joinPath(parentUri, finalNewName);

    try {
      await vscode.workspace.fs.stat(destNoteUri);
      vscode.window.showErrorMessage(`Eine Notiz mit dem Namen "${finalNewName}" existiert bereits.`);
      return;
    } catch {
      // Destination does not exist
    }

    const companionStatus = await companionManager.getCompanionStatus(targetItem.uri);
    const newBaseName = path.basename(finalNewName, path.extname(finalNewName));
    const linkPlan = await planLinkUpdates(
      { oldPath: targetItem.uri.fsPath, newPath: destNoteUri.fsPath, isFolder: false },
      companionManager
    );

    await vscode.workspace.fs.rename(targetItem.uri, destNoteUri);

    if (companionStatus.tasksExist) {
      const newTasksUri = vscode.Uri.joinPath(parentUri, `${newBaseName}.tasks.json`);
      await vscode.workspace.fs.rename(companionStatus.tasksUri, newTasksUri);
    }

    if (companionStatus.chartExist) {
      const newChartUri = vscode.Uri.joinPath(parentUri, `${newBaseName}.chart.json`);
      await vscode.workspace.fs.rename(companionStatus.chartUri, newChartUri);
    }

    notesTreeDataProvider.refresh();
    await applyLinkUpdates(linkPlan);
  }
}

/**
 * Command to delete an item from the Janus notes tree.
 * Prompts with modal confirmation, moves items to trash, and cleans up attached companion files.
 */
export async function deleteItemCommand(
  item: NotesTreeItem | undefined,
  treeView: vscode.TreeView<NotesTreeItem> | undefined,
  companionManager: CompanionManager,
  notesTreeDataProvider: NotesTreeDataProvider
): Promise<boolean> {
  const targetItem = item || treeView?.selection?.[0];
  if (!targetItem) {
    return false;
  }

  const itemName = path.basename(targetItem.uri.fsPath);
  const actionTrash = 'In den Papierkorb verschieben';

  const confirmation = await vscode.window.showWarningMessage(
    `Möchtest du "${itemName}" wirklich in den Papierkorb verschieben?`,
    { modal: true },
    actionTrash
  );

  if (confirmation !== actionTrash) {
    return false;
  }

  if (targetItem instanceof NoteTreeItem) {
    const companionStatus = await companionManager.getCompanionStatus(targetItem.uri);

    await vscode.workspace.fs.delete(targetItem.uri, { useTrash: true, recursive: true });

    if (companionStatus.tasksExist) {
      try {
        await vscode.workspace.fs.delete(companionStatus.tasksUri, { useTrash: true, recursive: true });
      } catch (err) {
        console.warn('Failed to delete tasks companion:', err);
      }
    }

    if (companionStatus.chartExist) {
      try {
        await vscode.workspace.fs.delete(companionStatus.chartUri, { useTrash: true, recursive: true });
      } catch (err) {
        console.warn('Failed to delete chart companion:', err);
      }
    }
  } else {
    await vscode.workspace.fs.delete(targetItem.uri, { useTrash: true, recursive: true });
  }

  notesTreeDataProvider.refresh();
  return true;
}
