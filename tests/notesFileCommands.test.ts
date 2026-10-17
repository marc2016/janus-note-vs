import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CompanionManager } from '../src/companion/companionManager';
import {
  NotesTreeDataProvider,
  FolderTreeItem,
  NoteTreeItem,
} from '../src/ui/notesTreeDataProvider';
import {
  resolveTargetDirectory,
  createFolderCommand,
  createNoteCommand,
  renameItemCommand,
  deleteItemCommand,
} from '../src/commands/notesFileCommands';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import { __setConfigStore } from './__mocks__/vscode';

describe('notesFileCommands', () => {
  let companionManager: CompanionManager;
  let notesTreeDataProvider: NotesTreeDataProvider;
  const mockWorkspaceUri = vscode.Uri.file('/workspace/project');
  const mockNotesRootUri = vscode.Uri.file('/workspace/project/notes');

  beforeEach(() => {
    companionManager = new CompanionManager();
    notesTreeDataProvider = new NotesTreeDataProvider(companionManager);
    __setConfigStore({
      'janus.notesRoot': 'notes',
    });
    (vscode.workspace as any).workspaceFolders = [
      { uri: mockWorkspaceUri, name: 'project', index: 0 },
    ];
    vi.restoreAllMocks();
  });

  describe('resolveTargetDirectory', () => {
    it('uses context item URI if it is a FolderTreeItem', async () => {
      const folderUri = vscode.Uri.file('/workspace/project/notes/subfolder');
      const folderItem = new FolderTreeItem(folderUri);

      const target = await resolveTargetDirectory(folderItem, undefined, companionManager);
      expect(target.fsPath).toBe(folderUri.fsPath);
    });

    it('uses parent directory if context item is a NoteTreeItem', async () => {
      const noteUri = vscode.Uri.file('/workspace/project/notes/subfolder/meeting.md');
      const noteItem = new NoteTreeItem(noteUri);

      const target = await resolveTargetDirectory(noteItem, undefined, companionManager);
      expect(target.fsPath).toBe('/workspace/project/notes/subfolder');
    });

    it('uses treeView selection when contextItem is not provided', async () => {
      const folderUri = vscode.Uri.file('/workspace/project/notes/selected-dir');
      const treeView = {
        selection: [new FolderTreeItem(folderUri)],
        dispose: () => {},
        reveal: async () => {},
      } as any;

      const target = await resolveTargetDirectory(undefined, treeView, companionManager);
      expect(target.fsPath).toBe(folderUri.fsPath);
    });

    it('falls back to notesRootUri when no context item and no treeView selection', async () => {
      const treeView = {
        selection: [],
        dispose: () => {},
        reveal: async () => {},
      } as any;

      const target = await resolveTargetDirectory(undefined, treeView, companionManager);
      expect(target.fsPath).toBe(mockNotesRootUri.fsPath);
    });
  });

  describe('createFolderCommand', () => {
    it('prompts, creates folder, and refreshes tree', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('new-topic');
      const statSpy = vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));
      const createDirSpy = vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue(undefined);
      const refreshSpy = vi.spyOn(notesTreeDataProvider, 'refresh');

      const created = await createFolderCommand(undefined, undefined, companionManager, notesTreeDataProvider);

      expect(created?.fsPath).toBe('/workspace/project/notes/new-topic');
      expect(createDirSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: '/workspace/project/notes/new-topic' })
      );
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('does not create if prompt is cancelled', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);
      const createDirSpy = vi.spyOn(vscode.workspace.fs, 'createDirectory');

      const created = await createFolderCommand(undefined, undefined, companionManager, notesTreeDataProvider);

      expect(created).toBeUndefined();
      expect(createDirSpy).not.toHaveBeenCalled();
    });

    it('shows warning and does not create if folder already exists', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('existing-dir');
      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
      const warningSpy = vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as any);
      const createDirSpy = vi.spyOn(vscode.workspace.fs, 'createDirectory');

      const created = await createFolderCommand(undefined, undefined, companionManager, notesTreeDataProvider);

      expect(created).toBeUndefined();
      expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('existiert bereits'));
      expect(createDirSpy).not.toHaveBeenCalled();
    });
  });

  describe('createNoteCommand', () => {
    it('prompts, appends .md if omitted, writes initial markdown, opens editor, and refreshes tree', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('sprint-planning');
      vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));
      const writeFileSpy = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue(undefined);
      const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
      const refreshSpy = vi.spyOn(notesTreeDataProvider, 'refresh');

      const created = await createNoteCommand(undefined, undefined, companionManager, notesTreeDataProvider);

      expect(created?.fsPath).toBe('/workspace/project/notes/sprint-planning.md');
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: '/workspace/project/notes/sprint-planning.md' }),
        Buffer.from('# sprint-planning\n\n', 'utf8')
      );
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.objectContaining({ fsPath: '/workspace/project/notes/sprint-planning.md' }),
        MarkdownEditorProvider.viewType
      );
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('does not create note if prompt is cancelled', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);
      const writeFileSpy = vi.spyOn(vscode.workspace.fs, 'writeFile');

      const created = await createNoteCommand(undefined, undefined, companionManager, notesTreeDataProvider);

      expect(created).toBeUndefined();
      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('renameItemCommand', () => {
    it('renames a folder', async () => {
      const oldFolderUri = vscode.Uri.file('/workspace/project/notes/old-folder');
      const folderItem = new FolderTreeItem(oldFolderUri);

      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('renamed-folder');
      vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));
      const renameSpy = vi.spyOn(vscode.workspace.fs, 'rename').mockResolvedValue(undefined);
      const refreshSpy = vi.spyOn(notesTreeDataProvider, 'refresh');

      await renameItemCommand(folderItem, undefined, companionManager, notesTreeDataProvider);

      expect(renameSpy).toHaveBeenCalledWith(
        oldFolderUri,
        expect.objectContaining({ fsPath: '/workspace/project/notes/renamed-folder' })
      );
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('renames a note and all attached companion files', async () => {
      const oldNoteUri = vscode.Uri.file('/workspace/project/notes/doc.md');
      const noteItem = new NoteTreeItem(oldNoteUri);

      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('guide.md');
      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: any) => {
        // destination does not exist
        if (uri.fsPath.includes('guide')) {
          throw new Error('Not found');
        }
        // old companions exist
        return {} as any;
      });

      const renameSpy = vi.spyOn(vscode.workspace.fs, 'rename').mockResolvedValue(undefined);
      const refreshSpy = vi.spyOn(notesTreeDataProvider, 'refresh');

      await renameItemCommand(noteItem, undefined, companionManager, notesTreeDataProvider);

      // Note rename
      expect(renameSpy).toHaveBeenCalledWith(
        oldNoteUri,
        expect.objectContaining({ fsPath: '/workspace/project/notes/guide.md' })
      );
      // Tasks companion rename
      expect(renameSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: '/workspace/project/notes/doc.tasks.json' }),
        expect.objectContaining({ fsPath: '/workspace/project/notes/guide.tasks.json' })
      );
      // Chart companion rename
      expect(renameSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: '/workspace/project/notes/doc.chart.json' }),
        expect.objectContaining({ fsPath: '/workspace/project/notes/guide.chart.json' })
      );
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('deleteItemCommand', () => {
    it('asks confirmation and deletes note with all companions to trash', async () => {
      const noteUri = vscode.Uri.file('/workspace/project/notes/trash-me.md');
      const noteItem = new NoteTreeItem(noteUri);

      vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue('In den Papierkorb verschieben' as any);
      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
      const deleteSpy = vi.spyOn(vscode.workspace.fs, 'delete').mockResolvedValue(undefined);
      const refreshSpy = vi.spyOn(notesTreeDataProvider, 'refresh');

      const deleted = await deleteItemCommand(noteItem, undefined, companionManager, notesTreeDataProvider);

      expect(deleted).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith(
        noteUri,
        { useTrash: true, recursive: true }
      );
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: '/workspace/project/notes/trash-me.tasks.json' }),
        { useTrash: true, recursive: true }
      );
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: '/workspace/project/notes/trash-me.chart.json' }),
        { useTrash: true, recursive: true }
      );
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('cancels deletion when modal confirmation is dismissed or declined', async () => {
      const folderUri = vscode.Uri.file('/workspace/project/notes/important');
      const folderItem = new FolderTreeItem(folderUri);

      vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as any);
      const deleteSpy = vi.spyOn(vscode.workspace.fs, 'delete');

      const deleted = await deleteItemCommand(folderItem, undefined, companionManager, notesTreeDataProvider);

      expect(deleted).toBe(false);
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });
});
