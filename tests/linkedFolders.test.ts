import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CompanionManager } from '../src/companion/companionManager';
import {
  checkNotesRootStatus,
  updateNotesContextKeys,
  addLinkedFolderCommand,
  removeLinkedFolderCommand,
} from '../src/commands/notesRootCommands';
import {
  NotesTreeDataProvider,
  LinkedFolderTreeItem,
  FolderTreeItem,
  NoteTreeItem,
  FolderTasksTreeItem,
  AllTasksTreeItem,
} from '../src/ui/notesTreeDataProvider';
import {
  findMarkdownNotesInRoots,
  findBacklinks,
  resolveOutgoingLink,
  extractDocumentLinks,
} from '../src/services/noteLinkService';
import {
  findLinkCandidatesAcrossRoots,
  createLinkCandidate,
} from '../src/companion/noteLinking';
import { __setConfigStore } from './__mocks__/vscode';

describe('Linked Markdown Folders (Multi-Root Support)', () => {
  const mockWorkspaceUri = vscode.Uri.file('/workspace/project');
  let companionManager: CompanionManager;

  beforeEach(() => {
    companionManager = new CompanionManager();
    __setConfigStore({});
    (vscode.workspace as any).workspaceFolders = [
      { uri: mockWorkspaceUri, name: 'project', index: 0 },
    ];
    vi.restoreAllMocks();
  });

  describe('CompanionManager multi-root resolution', () => {
    it('returns empty included folder uris when none are configured', () => {
      const uris = companionManager.getIncludedFolderUris();
      expect(uris).toEqual([]);
    });

    it('resolves included folder paths against workspace folder', () => {
      __setConfigStore({
        'janus.includeFolders': ['docs', 'specs', './design/'],
      });

      const uris = companionManager.getIncludedFolderUris();
      expect(uris).toHaveLength(3);
      expect(uris[0].fsPath).toBe('/workspace/project/docs');
      expect(uris[1].fsPath).toBe('/workspace/project/specs');
      expect(uris[2].fsPath).toBe('/workspace/project/design');
    });

    it('getAllNotesRoots returns notesRootUri and includedFolderUris deduplicated', () => {
      __setConfigStore({
        'janus.notesRoot': 'notes',
        'janus.includeFolders': ['docs', 'specs', 'notes'],
      });

      const allRoots = companionManager.getAllNotesRoots();
      expect(allRoots).toHaveLength(3);
      expect(allRoots[0].fsPath).toBe('/workspace/project/notes');
      expect(allRoots[1].fsPath).toBe('/workspace/project/docs');
      expect(allRoots[2].fsPath).toBe('/workspace/project/specs');
    });

    it('isUnderNotesRoot returns true for notes in notesRoot or included folders', () => {
      __setConfigStore({
        'janus.notesRoot': 'notes',
        'janus.includeFolders': ['docs'],
      });

      const vaultNote = vscode.Uri.file('/workspace/project/notes/meeting.md');
      const docsNote = vscode.Uri.file('/workspace/project/docs/api/endpoints.md');
      const srcFile = vscode.Uri.file('/workspace/project/src/index.ts');

      expect(companionManager.isUnderNotesRoot(vaultNote)).toBe(true);
      expect(companionManager.isUnderNotesRoot(docsNote)).toBe(true);
      expect(companionManager.isUnderNotesRoot(srcFile)).toBe(false);
    });
  });

  describe('Commands: addLinkedFolderCommand & removeLinkedFolderCommand', () => {
    it('adds a folder to janus.includeFolders and sets context keys', async () => {
      const docsUri = vscode.Uri.file('/workspace/project/docs');
      const executeSpy = vi.spyOn(vscode.commands, 'executeCommand');
      let refreshed = false;

      await addLinkedFolderCommand(docsUri, { refresh: () => { refreshed = true; } }, companionManager);

      const config = vscode.workspace.getConfiguration('janus');
      const current = config.get<string[]>('includeFolders');
      expect(current).toEqual(['docs']);
      expect(refreshed).toBe(true);
      expect(executeSpy).toHaveBeenCalledWith('setContext', 'janus.hasLinkedFolders', true);
    });

    it('does not duplicate existing folder in janus.includeFolders', async () => {
      __setConfigStore({
        'janus.includeFolders': ['docs'],
      });

      const docsUri = vscode.Uri.file('/workspace/project/docs');
      await addLinkedFolderCommand(docsUri, undefined, companionManager);

      const config = vscode.workspace.getConfiguration('janus');
      expect(config.get<string[]>('includeFolders')).toEqual(['docs']);
    });

    it('removes a folder from janus.includeFolders', async () => {
      __setConfigStore({
        'janus.includeFolders': ['docs', 'specs'],
      });

      const item = new LinkedFolderTreeItem(vscode.Uri.file('/workspace/project/docs'), 'docs');
      let refreshed = false;

      await removeLinkedFolderCommand(item, { refresh: () => { refreshed = true; } }, companionManager);

      const config = vscode.workspace.getConfiguration('janus');
      expect(config.get<string[]>('includeFolders')).toEqual(['specs']);
      expect(refreshed).toBe(true);
    });

    it('updates hasLinkedFolders context to false when all folders are removed and vault uninitialized', async () => {
      __setConfigStore({
        'janus.includeFolders': ['docs'],
      });

      const executeSpy = vi.spyOn(vscode.commands, 'executeCommand');
      const item = new LinkedFolderTreeItem(vscode.Uri.file('/workspace/project/docs'), 'docs');

      await removeLinkedFolderCommand(item, undefined, companionManager);

      expect(executeSpy).toHaveBeenCalledWith('setContext', 'janus.hasLinkedFolders', false);
    });
  });

  describe('NotesTreeDataProvider with linked folders', () => {
    let treeProvider: NotesTreeDataProvider;

    beforeEach(() => {
      treeProvider = new NotesTreeDataProvider(companionManager);
    });

    it('renders LinkedFolderTreeItem at root level without initializing vault', async () => {
      __setConfigStore({
        'janus.includeFolders': ['docs'],
      });

      // Vault is uninitialized
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);

      const rootItems = await treeProvider.getChildren();
      expect(rootItems).toHaveLength(1);
      expect(rootItems[0]).toBeInstanceOf(LinkedFolderTreeItem);
      expect((rootItems[0] as LinkedFolderTreeItem).folderRelPath).toBe('docs');
      expect(rootItems[0].contextValue).toBe('linkedFolder');
    });

    it('renders both vault items and LinkedFolderTreeItems when vault is initialized', async () => {
      __setConfigStore({
        'janus.initialized': true,
        'janus.notesRoot': 'notes',
        'janus.includeFolders': ['docs'],
      });

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
        if (uri.fsPath.endsWith('/notes')) {
          return [
            ['inbox.md', vscode.FileType.File],
          ];
        }
        return [];
      });

      const rootItems = await treeProvider.getChildren();
      // Should have: AllTasksTreeItem, CalendarTreeItem, NoteTreeItem(inbox.md), and LinkedFolderTreeItem(docs)
      expect(rootItems.some((item) => item instanceof AllTasksTreeItem)).toBe(true);
      expect(rootItems.some((item) => item instanceof LinkedFolderTreeItem && item.folderRelPath === 'docs')).toBe(true);
      expect(rootItems.some((item) => item instanceof NoteTreeItem && (item.label as string) === 'inbox.md')).toBe(true);
    });

    it('renders linked folder children purely without FolderTasksTreeItem', async () => {
      const docsUri = vscode.Uri.file('/workspace/project/docs');
      const linkedItem = new LinkedFolderTreeItem(docsUri, 'docs');

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
        if (uri.fsPath === docsUri.fsPath) {
          return [
            ['guide.md', vscode.FileType.File],
            ['tasks.json', vscode.FileType.File], // existing tasks.json should be ignored in pure folder
            ['api', vscode.FileType.Directory],
          ];
        }
        if (uri.fsPath.endsWith('/api')) {
          return [
            ['reference.md', vscode.FileType.File],
          ];
        }
        return [];
      });

      const children = await treeProvider.getChildren(linkedItem);
      expect(children).toHaveLength(2); // api folder and guide.md (no tasks.json or FolderTasksTreeItem!)
      expect(children.some((c) => c instanceof FolderTasksTreeItem)).toBe(false);

      const folderChild = children.find((c) => c instanceof FolderTreeItem) as FolderTreeItem;
      const noteChild = children.find((c) => c instanceof NoteTreeItem) as NoteTreeItem;

      expect(folderChild).toBeDefined();
      expect(folderChild.folderName).toBe('api');
      expect(folderChild.isPureFolder).toBe(true);
      expect(noteChild.label).toBe('guide.md');

      // Expand subfolder in pure linked folder
      const subChildren = await treeProvider.getChildren(folderChild);
      expect(subChildren.some((c) => c instanceof FolderTasksTreeItem)).toBe(false);
      expect(subChildren.some((c) => c instanceof NoteTreeItem && (c.label as string) === 'reference.md')).toBe(true);
    });
  });

  describe('Cross-folder linking & autocompletion', () => {
    it('discovers link candidates across notesRoot and includedFolders', async () => {
      const notesRoot = vscode.Uri.file('/workspace/project/notes');
      const docsRoot = vscode.Uri.file('/workspace/project/docs');

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
        if (uri.fsPath === notesRoot.fsPath) {
          return [
            ['Inbox.md', vscode.FileType.File],
          ];
        }
        if (uri.fsPath === docsRoot.fsPath) {
          return [
            ['architecture.md', vscode.FileType.File],
            ['schema.png', vscode.FileType.File],
          ];
        }
        return [];
      });

      const candidates = await findLinkCandidatesAcrossRoots([notesRoot, docsRoot], 6, notesRoot);
      expect(candidates).toHaveLength(3);

      const inboxCand = candidates.find((c) => c.label === 'Inbox');
      const archCand = candidates.find((c) => c.label === 'architecture');
      const imgCand = candidates.find((c) => c.label === 'schema.png');

      expect(inboxCand).toBeDefined();
      expect(inboxCand?.insertText).toBe('Inbox');

      expect(archCand).toBeDefined();
      expect(archCand?.insertText).toBe('docs/architecture');
      expect(archCand?.relPath).toBe('docs/architecture.md');

      expect(imgCand).toBeDefined();
      expect(imgCand?.insertText).toBe('docs/schema.png');
    });

    it('discovers backlinks across multiple roots (vault note <-> linked folder note)', async () => {
      const notesRoot = vscode.Uri.file('/workspace/project/notes');
      const docsRoot = vscode.Uri.file('/workspace/project/docs');

      const targetVaultNote = vscode.Uri.file('/workspace/project/notes/ProductPlan.md');
      const docsNote = vscode.Uri.file('/workspace/project/docs/architecture.md');

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
        if (uri.fsPath === notesRoot.fsPath) {
          return [['ProductPlan.md', vscode.FileType.File]];
        }
        if (uri.fsPath === docsRoot.fsPath) {
          return [['architecture.md', vscode.FileType.File]];
        }
        return [];
      });

      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
        if (uri.fsPath === docsNote.fsPath) {
          return Buffer.from('Here is reference to [[ProductPlan]] in the vault.');
        }
        return Buffer.from('');
      });

      const backlinks = await findBacklinks(targetVaultNote, [notesRoot, docsRoot]);
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].title).toBe('architecture');
      expect(backlinks[0].relativePath).toBe('docs/architecture.md');
      expect(backlinks[0].exists).toBe(true);
    });

    it('resolves cross-folder outgoing link from note to linked folder note', async () => {
      const sourceNote = vscode.Uri.file('/workspace/project/notes/ProductPlan.md');
      const link = { raw: '[[docs/architecture]]', target: 'docs/architecture', label: 'architecture', type: 'wiki' as const };
      const archNote = vscode.Uri.file('/workspace/project/docs/architecture.md');

      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
        if (uri.fsPath === archNote.fsPath) {
          return { type: vscode.FileType.File } as any;
        }
        throw new Error('Not found');
      });

      const resolved = await resolveOutgoingLink(link, sourceNote, vscode.Uri.file('/workspace/project/notes'), [archNote]);
      expect(resolved.exists).toBe(true);
      expect(resolved.uri).toBe(archNote.toString());
      expect(resolved.relativePath).toBe('docs/architecture.md');
    });
  });
});

