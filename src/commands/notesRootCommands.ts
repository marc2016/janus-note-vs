import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownNote, isTasksCompanion, isChartCompanion } from '../companion/companionPaths';

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
