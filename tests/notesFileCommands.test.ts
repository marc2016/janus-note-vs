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

  describe('renameItemCommand link updates', () => {
    const root = '/workspace/project/notes';
    let files: Record<string, string>;

    /** Backs workspace.fs with an in-memory notes collection. */
    function mockFileSystem() {
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
        const prefix = `${uri.fsPath}/`;
        const entries = new Map<string, vscode.FileType>();
        for (const filePath of Object.keys(files)) {
          if (!filePath.startsWith(prefix)) continue;
          const [name, ...rest] = filePath.slice(prefix.length).split('/');
          entries.set(name, rest.length > 0 ? vscode.FileType.Directory : vscode.FileType.File);
        }
        return [...entries];
      });
      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: any) => {
        if (!(uri.fsPath in files)) throw new Error('Not found');
        return Buffer.from(files[uri.fsPath]);
      });
      vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(async (uri: any, content: any) => {
        files[uri.fsPath] = Buffer.from(content).toString('utf-8');
      });
      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: any) => {
        if (uri.fsPath in files) return {} as any;
        throw new Error('Not found');
      });
      vi.spyOn(vscode.workspace.fs, 'rename').mockImplementation(async (from: any, to: any) => {
        for (const filePath of Object.keys(files)) {
          if (filePath === from.fsPath || filePath.startsWith(`${from.fsPath}/`)) {
            files[to.fsPath + filePath.slice(from.fsPath.length)] = files[filePath];
            delete files[filePath];
          }
        }
      });
    }

    function openDocument(fsPath: string, text: string, isDirty: boolean) {
      const doc = {
        uri: vscode.Uri.file(fsPath),
        isDirty,
        getText: () => text,
        positionAt: (offset: number) => {
          const before = text.slice(0, offset).split('\n');
          return new vscode.Position(before.length - 1, before[before.length - 1].length);
        },
        save: vi.fn(async () => true),
      };
      (vscode.workspace as any).textDocuments = [doc];
      return doc;
    }

    beforeEach(() => {
      files = {
        [`${root}/inbox.md`]: '# Inbox',
        [`${root}/meetings/kickoff.md`]: '# Kickoff\n\nSelbst: [[kickoff#L1]]',
        [`${root}/projects/plan.md`]: 'Siehe [[kickoff]] und [K](../meetings/kickoff.md).\n\n```\n[[kickoff]]\n```',
      };
      (vscode.workspace as any).textDocuments = [];
      mockFileSystem();
    });

    const kickoffItem = () => new NoteTreeItem(vscode.Uri.file(`${root}/meetings/kickoff.md`));

    it('rewrites links in notes that are not open and in the renamed note itself', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('start');
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

      await renameItemCommand(kickoffItem(), undefined, companionManager, notesTreeDataProvider);

      expect(files[`${root}/projects/plan.md`]).toBe(
        'Siehe [[start]] und [K](../meetings/start.md).\n\n```\n[[kickoff]]\n```'
      );
      expect(files[`${root}/meetings/start.md`]).toBe('# Kickoff\n\nSelbst: [[start#L1]]');
      expect(infoSpy).toHaveBeenCalledWith('3 Links in 2 Notizen aktualisiert.');
    });

    it('applies document edits to a dirty open note and keeps it unsaved', async () => {
      const planPath = `${root}/projects/plan.md`;
      const unsaved = 'Neu getippt. [[kickoff]]';
      const doc = openDocument(planPath, unsaved, true);
      const applySpy = vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('start');

      await renameItemCommand(kickoffItem(), undefined, companionManager, notesTreeDataProvider);

      const edit = applySpy.mock.calls[0][0] as any;
      expect(edit.entries).toHaveLength(1);
      expect(edit.entries[0].newText).toBe('start');
      expect(edit.entries[0].range.start).toEqual(new vscode.Position(0, unsaved.indexOf('kickoff')));
      expect(doc.save).not.toHaveBeenCalled();
      // The file on disk is left to the editor; it is not overwritten with stale content
      expect(files[planPath]).toContain('[[kickoff]] und');
    });

    it('saves an open note that had no unsaved changes', async () => {
      const doc = openDocument(`${root}/projects/plan.md`, '[[kickoff]]', false);
      vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('start');

      await renameItemCommand(kickoffItem(), undefined, companionManager, notesTreeDataProvider);

      expect(doc.save).toHaveBeenCalled();
    });

    it('rewrites path links when a folder is renamed', async () => {
      files[`${root}/index.md`] = '[[meetings/kickoff]] [[kickoff]]';
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('treffen');

      await renameItemCommand(
        new FolderTreeItem(vscode.Uri.file(`${root}/meetings`)),
        undefined,
        companionManager,
        notesTreeDataProvider
      );

      expect(files[`${root}/index.md`]).toBe('[[treffen/kickoff]] [[kickoff]]');
      expect(files[`${root}/projects/plan.md`]).toContain('[K](../treffen/kickoff.md)');
    });

    it('changes nothing when the name prompt is cancelled', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);
      const before = { ...files };

      await renameItemCommand(kickoffItem(), undefined, companionManager, notesTreeDataProvider);

      expect(files).toEqual(before);
    });

    it('changes no link when the rename fails', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('start');
      vi.spyOn(vscode.workspace.fs, 'rename').mockRejectedValue(new Error('EACCES'));
      const before = { ...files };

      await expect(
        renameItemCommand(kickoffItem(), undefined, companionManager, notesTreeDataProvider)
      ).rejects.toThrow('EACCES');
      expect(files).toEqual(before);
    });

    it('shows no message when no link points to the renamed note', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('archiv');
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

      await renameItemCommand(
        new NoteTreeItem(vscode.Uri.file(`${root}/inbox.md`)),
        undefined,
        companionManager,
        notesTreeDataProvider
      );

      expect(files[`${root}/archiv.md`]).toBe('# Inbox');
      expect(infoSpy).not.toHaveBeenCalled();
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
