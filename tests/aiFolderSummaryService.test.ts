import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { AiFolderSummaryService } from '../src/services/aiFolderSummaryService';
import { AiModelService } from '../src/services/aiModelService';
import { FolderTasksService } from '../src/services/folderTasksService';

describe('AiFolderSummaryService', () => {
  let aiModelService: AiModelService;
  let folderTasksService: FolderTasksService;
  let service: AiFolderSummaryService;
  let fsMap: Map<string, string>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fsMap = new Map();

    aiModelService = {
      completePrompt: vi.fn().mockResolvedValue('### 🎯 Kerninhalte & Themen\nZusammenfassung'),
    } as unknown as AiModelService;

    folderTasksService = new FolderTasksService();
    service = new AiFolderSummaryService(aiModelService, folderTasksService);

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: vscode.Uri) => {
      const content = fsMap.get(uri.fsPath);
      if (content === undefined) {
        throw new Error(`File not found: ${uri.fsPath}`);
      }
      return Buffer.from(content, 'utf-8');
    });
  });

  describe('extractTitle & extractSnippet', () => {
    it('extracts first H1 title or falls back to clean filename', () => {
      expect(service.extractTitle('# Projekt Beta\nSome text', 'test.md')).toBe('Projekt Beta');
      expect(service.extractTitle('No title\nJust text', 'test-file.md')).toBe('test-file');
    });

    it('extracts snippet skipping headings and empty lines', () => {
      const content = '# Titel\n\nDas ist die erste Textzeile mit wichtigem Kontext.\nUnd die zweite Zeile.';
      const snippet = service.extractSnippet(content, 40);
      expect(snippet).toContain('Das ist die erste Textzeile');
      expect(snippet).not.toContain('# Titel');
    });
  });

  describe('discoverNotes', () => {
    it('discovers only direct markdown notes when includeSubfolders is false', async () => {
      const folderUri = vscode.Uri.file('/workspace/project');
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/project') {
          return [
            ['note1.md', vscode.FileType.File],
            ['subfolder', vscode.FileType.Directory],
            ['image.png', vscode.FileType.File],
            ['.hidden', vscode.FileType.File],
          ];
        }
        return [];
      });

      const notes = await service.discoverNotes(folderUri, false);
      expect(notes.map((n) => n.fsPath)).toEqual(['/workspace/project/note1.md']);
    });

    it('discovers notes in subdirectories when includeSubfolders is true', async () => {
      const folderUri = vscode.Uri.file('/workspace/project');
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/project') {
          return [
            ['note1.md', vscode.FileType.File],
            ['subfolder', vscode.FileType.Directory],
            ['.git', vscode.FileType.Directory],
          ];
        }
        if (uri.fsPath === '/workspace/project/subfolder') {
          return [['subnote.md', vscode.FileType.File]];
        }
        return [];
      });

      const notes = await service.discoverNotes(folderUri, true);
      expect(notes.map((n) => n.fsPath)).toEqual([
        '/workspace/project/note1.md',
        '/workspace/project/subfolder/subnote.md',
      ]);
    });
  });

  describe('generateFolderSummary', () => {
    it('returns informative message when folder contains no markdown notes', async () => {
      const folderUri = vscode.Uri.file('/workspace/empty');
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);

      const result = await service.generateFolderSummary(folderUri);
      expect(result).toBe('In diesem Ordner wurden keine Markdown-Notizen gefunden.');
      expect(aiModelService.completePrompt).not.toHaveBeenCalled();
    });

    it('reads notes and tasks, builds German prompt and calls completePrompt', async () => {
      const folderUri = vscode.Uri.file('/workspace/project');
      const noteUri = vscode.Uri.file('/workspace/project/plan.md');

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['plan.md', vscode.FileType.File],
      ]);
      fsMap.set(noteUri.fsPath, '# Projektplan\nErste Phase bis Freitag abschließen.');

      vi.spyOn(folderTasksService, 'loadFolderTasks').mockResolvedValue([
        {
          id: '1',
          title: 'UI Design Review',
          completed: false,
          status: 'todo',
          priority: 'high',
          createdAt: '2026-01-01',
        },
      ]);

      const summary = await service.generateFolderSummary(folderUri, { includeSubfolders: false });
      expect(summary).toContain('Kerninhalte & Themen');
      expect(aiModelService.completePrompt).toHaveBeenCalledWith(
        expect.stringContaining('Du bist ein strukturierter KI-Assistent'),
        expect.stringContaining('UI Design Review'),
        undefined
      );
    });
  });

  describe('generateSelectionSummary', () => {
    it('returns informative message when selection contains no markdown notes', async () => {
      const result = await service.generateSelectionSummary([
        { uri: vscode.Uri.file('/workspace/image.png'), isFolder: false },
      ]);
      expect(result).toBe('In der aktuellen Auswahl wurden keine Markdown-Notizen gefunden.');
      expect(aiModelService.completePrompt).not.toHaveBeenCalled();
    });

    it('synthesizes multiple selected notes and folders', async () => {
      const note1Uri = vscode.Uri.file('/workspace/notes/meetings/standup.md');
      const note2Uri = vscode.Uri.file('/workspace/notes/projects/app.md');
      fsMap.set(note1Uri.fsPath, '# Standup Notiz\nBlocker besprochen.');
      fsMap.set(note2Uri.fsPath, '# App Launch\nRelease steht bevor.');

      const summary = await service.generateSelectionSummary([
        { uri: note1Uri, isFolder: false },
        { uri: note2Uri, isFolder: false },
      ]);

      expect(summary).toContain('Kerninhalte & Themen');
      expect(aiModelService.completePrompt).toHaveBeenCalledWith(
        expect.stringContaining('Du bist ein strukturierter KI-Assistent'),
        expect.stringContaining('Standup Notiz'),
        undefined
      );
    });
  });
});

