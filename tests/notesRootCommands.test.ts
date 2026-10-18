import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CompanionManager } from '../src/companion/companionManager';
import {
  checkNotesRootStatus,
  updateNotesContextKeys,
  initNotesRootCommand,
  getLocalizedRootFolderLabel,
  formatRelativePathWithLocalizedRoot,
} from '../src/commands/notesRootCommands';
import { __setConfigStore } from './__mocks__/vscode';

describe('notesRootCommands initialization & context state', () => {
  let companionManager: CompanionManager;
  const mockWorkspaceUri = vscode.Uri.file('/workspace/project');

  beforeEach(() => {
    companionManager = new CompanionManager();
    __setConfigStore({});
    (vscode.workspace as any).workspaceFolders = [
      { uri: mockWorkspaceUri, name: 'project', index: 0 },
    ];
    (vscode.env as any).language = 'de';
    vi.restoreAllMocks();
  });

  describe('checkNotesRootStatus & updateNotesContextKeys', () => {
    it('detects uninitialized state with non-note files present', async () => {
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['src', vscode.FileType.Directory],
        ['package.json', vscode.FileType.File],
        ['tsconfig.json', vscode.FileType.File],
      ]);

      const executeSpy = vi.spyOn(vscode.commands, 'executeCommand');

      const status = await updateNotesContextKeys(companionManager);

      expect(status.isInitialized).toBe(false);
      expect(status.hasNonNoteFiles).toBe(true);

      expect(executeSpy).toHaveBeenCalledWith('setContext', 'janus.isInitialized', false);
      expect(executeSpy).toHaveBeenCalledWith('setContext', 'janus.hasNonNoteFiles', true);
    });

    it('detects uninitialized clean/empty folder', async () => {
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);

      const executeSpy = vi.spyOn(vscode.commands, 'executeCommand');

      const status = await updateNotesContextKeys(companionManager);

      expect(status.isInitialized).toBe(false);
      expect(status.hasNonNoteFiles).toBe(false);

      expect(executeSpy).toHaveBeenCalledWith('setContext', 'janus.isInitialized', false);
      expect(executeSpy).toHaveBeenCalledWith('setContext', 'janus.hasNonNoteFiles', false);
    });

    it('detects initialized state when markdown notes already exist', async () => {
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['inbox.md', vscode.FileType.File],
        ['inbox.tasks.json', vscode.FileType.File],
      ]);

      const status = await checkNotesRootStatus(companionManager);

      expect(status.isInitialized).toBe(true);
      expect(status.hasNonNoteFiles).toBe(false);
    });

    it('detects initialized state when janus.initialized is configured true', async () => {
      __setConfigStore({
        'janus.initialized': true,
      });

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);

      const status = await checkNotesRootStatus(companionManager);

      expect(status.isInitialized).toBe(true);
    });
  });

  describe('initNotesRootCommand & root folder localization', () => {
    it('creates inbox.md and the three canonical root folders (meetings, projects, knowledge)', async () => {
      const createdDirs: string[] = [];
      let writtenFile: { uri: vscode.Uri; content: string } | undefined;
      let refreshed = false;

      vi.spyOn(vscode.workspace.fs, 'createDirectory').mockImplementation(async (uri) => {
        createdDirs.push(uri.fsPath);
      });

      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async () => {
        throw new Error('Not found'); // inbox.md does not exist yet
      });

      vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(async (uri, data) => {
        writtenFile = { uri, content: Buffer.from(data).toString('utf-8') };
      });

      const executeSpy = vi.spyOn(vscode.commands, 'executeCommand');

      const treeMock = {
        refresh: () => {
          refreshed = true;
        },
      };

      const inboxUri = await initNotesRootCommand(companionManager, treeMock);

      expect(inboxUri).toBeDefined();
      expect(inboxUri?.fsPath).toBe('/workspace/project/inbox.md');
      expect(createdDirs).toEqual([
        '/workspace/project',
        '/workspace/project/meetings',
        '/workspace/project/projects',
        '/workspace/project/knowledge',
      ]);

      expect(writtenFile).toBeDefined();
      expect(writtenFile?.uri.fsPath).toBe('/workspace/project/inbox.md');
      expect(writtenFile?.content).toContain('# Inbox');

      expect(refreshed).toBe(true);
      expect(executeSpy).toHaveBeenCalledWith('vscode.openWith', inboxUri, 'janus.markdownEditor');
    });

    it('does not overwrite inbox.md if it already exists', async () => {
      vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();
      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any); // exists!
      const writeSpy = vi.spyOn(vscode.workspace.fs, 'writeFile');

      await initNotesRootCommand(companionManager);

      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('localizes root folder labels according to language (de vs en)', () => {
      expect(getLocalizedRootFolderLabel('meetings', 'de')).toBe('Allgemeine Meetings');
      expect(getLocalizedRootFolderLabel('projects', 'de-DE')).toBe('Projekte');
      expect(getLocalizedRootFolderLabel('knowledge', 'de')).toBe('Wissensbasis');

      expect(getLocalizedRootFolderLabel('meetings', 'en')).toBe('General Meetings');
      expect(getLocalizedRootFolderLabel('projects', 'en-US')).toBe('Projects');
      expect(getLocalizedRootFolderLabel('knowledge', 'en')).toBe('Knowledge Base');

      expect(
        formatRelativePathWithLocalizedRoot('projects/App-Launch/app-launch.md', 'de')
      ).toBe('Projekte/App-Launch/app-launch.md');
      expect(
        formatRelativePathWithLocalizedRoot('projects/App-Launch/app-launch.md', 'en')
      ).toBe('Projects/App-Launch/app-launch.md');
    });
  });
});
