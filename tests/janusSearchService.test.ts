import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import {
  JanusSearchService,
  tokenizeSearchQuery,
  extractRelevantSnippet,
} from '../src/services/janusSearchService';
import { CompanionManager } from '../src/companion/companionManager';
import { FolderTasksService } from '../src/services/folderTasksService';

describe('JanusSearchService', () => {
  const rootUri = vscode.Uri.file('/workspace/notes');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('tokenizeSearchQuery', () => {
    it('strips German and English stopwords and punctuation', () => {
      const tokens = tokenizeSearchQuery('Wo steht etwas zum Q3 Budget in meinen Notizen?');
      expect(tokens).toEqual(['q3', 'budget']);
    });

    it('deduplicates and preserves meaningful terms', () => {
      const tokens = tokenizeSearchQuery('find notes about App-Launch and app-launch roadmap');
      expect(tokens).toEqual(['app-launch', 'roadmap']);
    });
  });

  describe('extractRelevantSnippet', () => {
    it('extracts the paragraph matching the search tokens with its heading', () => {
      const md = [
        '# Projekt Übersicht',
        '',
        'Allgemeine Einleitung zum Projekt.',
        '',
        '## Q3 Budget & Ressourcen',
        '',
        'Für das Q3 Budget wurden 45.000 EUR für Infrastruktur freigegeben.',
      ].join('\n');

      const snippet = extractRelevantSnippet(md, ['q3', 'budget']);
      expect(snippet).toContain('## Q3 Budget & Ressourcen');
      expect(snippet).toContain('45.000 EUR');
    });
  });

  describe('searchWorkspace', () => {
    it('ranks note matches with higher weight on title/headings than body and matches tasks', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(rootUri);

      const folderTasksService = new FolderTasksService();
      vi.spyOn(folderTasksService, 'loadAllTasks').mockResolvedValue([
        {
          folder: 'projects/App-Launch',
          uri: vscode.Uri.file('/workspace/notes/projects/App-Launch/tasks.json'),
          tasks: [
            {
              id: 't1',
              title: 'Q3 Budget Freigabe einholen',
              completed: false,
              status: 'todo',
              priority: 'high',
              createdAt: '2026-10-01T10:00:00Z',
            },
          ],
        },
      ]);

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/notes') {
          return [
            ['projects', vscode.FileType.Directory],
            ['meetings', vscode.FileType.Directory],
          ];
        }
        if (uri.fsPath === '/workspace/notes/projects') {
          return [['budget-planung.md', vscode.FileType.File]];
        }
        if (uri.fsPath === '/workspace/notes/meetings') {
          return [['weekly.md', vscode.FileType.File]];
        }
        return [];
      });

      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath.endsWith('budget-planung.md')) {
          return Buffer.from(
            '# Q3 Budget Planung\n\nDetails zum Marketing- und Server-Budget.',
            'utf-8'
          );
        }
        if (uri.fsPath.endsWith('weekly.md')) {
          return Buffer.from(
            '# Weekly Sync\n\nKurze Erwähnung vom Budget am Rande.',
            'utf-8'
          );
        }
        return Buffer.from('', 'utf-8');
      });

      const service = new JanusSearchService(companionManager, folderTasksService);
      const result = await service.searchWorkspace('Wo steht etwas zum Q3 Budget?');

      expect(result.noteMatches.length).toBe(2);
      expect(result.noteMatches[0].relativePath).toBe('projects/budget-planung.md');
      expect(result.noteMatches[0].score).toBeGreaterThan(result.noteMatches[1].score);
      expect(result.taskMatches.length).toBe(1);
      expect(result.taskMatches[0].title).toBe('Q3 Budget Freigabe einholen');
    });

    it('returns fallbackOverview when query has no keyword matches', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(rootUri);

      const folderTasksService = new FolderTasksService();
      vi.spyOn(folderTasksService, 'loadAllTasks').mockResolvedValue([
        {
          folder: 'projects',
          uri: vscode.Uri.file('/workspace/notes/projects/tasks.json'),
          tasks: [
            {
              id: 't1',
              title: 'Offene Aufgabe 1',
              completed: false,
              status: 'todo',
              priority: 'medium',
              createdAt: '2026-10-01T10:00:00Z',
            },
          ],
        },
      ]);

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/notes') {
          return [['inbox.md', vscode.FileType.File]];
        }
        return [];
      });

      vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
        Buffer.from('# Inbox\n\nErster Gedanke', 'utf-8')
      );

      const service = new JanusSearchService(companionManager, folderTasksService);
      const result = await service.searchWorkspace('unbekannteswortxyz');

      expect(result.noteMatches).toHaveLength(0);
      expect(result.fallbackOverview).toBeDefined();
      expect(result.fallbackOverview?.totalNotes).toBe(1);
      expect(result.fallbackOverview?.totalOpenTasks).toBe(1);
    });
  });

  describe('searchWorkspace with frontmatter', () => {
    const files: Record<string, string> = {
      '/workspace/notes/2026-10-29-sync.md': '---\ntitle: Wöchentlicher Sync\n---\n# Sync\n\nDeployment besprochen.',
      '/workspace/notes/rest-schnittstelle.md': '---\naliases: [API]\n---\n# REST\n\nEndpunkte und Fehlercodes.',
      '/workspace/notes/notizen.md': '# Notizen\n\nKurz die api erwähnt.',
    };

    const createService = () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(rootUri);
      const folderTasksService = new FolderTasksService();
      vi.spyOn(folderTasksService, 'loadAllTasks').mockResolvedValue([]);
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) =>
        uri.fsPath === '/workspace/notes'
          ? Object.keys(files).map((f) => [f.split('/').pop()!, vscode.FileType.File] as [string, vscode.FileType])
          : []
      );
      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: vscode.Uri) =>
        Buffer.from(files[uri.fsPath] ?? '', 'utf-8')
      );
      return new JanusSearchService(companionManager, folderTasksService);
    };

    it('uses the frontmatter title as result title', async () => {
      const result = await createService().searchWorkspace('Deployment');
      expect(result.noteMatches.map((m) => m.title)).toEqual(['Wöchentlicher Sync']);
    });

    it('scores aliases like the title', async () => {
      const result = await createService().searchWorkspace('API');
      expect(result.noteMatches[0].relativePath).toBe('rest-schnittstelle.md');
      // Title weight (5), not body weight (2 per occurrence)
      expect(result.noteMatches[0].score).toBe(5);
      expect(result.noteMatches[1]).toMatchObject({ relativePath: 'notizen.md', score: 2 });
    });
  });

  describe('searchWorkspace with tags', () => {
    const files: Record<string, string> = {
      '/workspace/notes/plan.md': '# Plan\n\nThema #backend: Deployment vorbereiten.',
      '/workspace/notes/retro.md': '# Retro\n\nDeployment lief gut.',
      '/workspace/notes/api.md': '---\ntags: [backend, budget]\n---\n# API\n\nEndpunkte.',
      '/workspace/notes/infra.md': '# Infra\n\nServer #Backend/infra',
    };

    const createService = () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(rootUri);
      const folderTasksService = new FolderTasksService();
      vi.spyOn(folderTasksService, 'loadAllTasks').mockResolvedValue([]);
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) =>
        uri.fsPath === '/workspace/notes'
          ? Object.keys(files).map((f) => [f.split('/').pop()!, vscode.FileType.File] as [string, vscode.FileType])
          : []
      );
      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: vscode.Uri) =>
        Buffer.from(files[uri.fsPath] ?? '', 'utf-8')
      );
      return new JanusSearchService(companionManager, folderTasksService);
    };

    it('restricts results to notes with the tag', async () => {
      const result = await createService().searchWorkspace('#backend Deployment');
      expect(result.noteMatches.map((m) => m.relativePath)).toEqual(['plan.md']);
      expect(result.tokens).toEqual(['deployment']);
    });

    it('returns all tagged notes ordered by title for a tag-only query', async () => {
      const result = await createService().searchWorkspace('#backend');
      expect(result.noteMatches.map((m) => m.title)).toEqual(['API', 'Infra', 'Plan']);
    });

    it('requires every tag filter to match', async () => {
      const result = await createService().searchWorkspace('#backend #budget');
      expect(result.noteMatches.map((m) => m.relativePath)).toEqual(['api.md']);
    });

    it('scores a keyword that equals a tag like a heading', async () => {
      const result = await createService().searchWorkspace('budget');
      expect(result.noteMatches).toEqual([expect.objectContaining({ relativePath: 'api.md', score: 6 })]);
    });
  });

  describe('getSummarizeContext & getInboxContext', () => {
    it('aggregates all notes and tasks in a specified folder for getSummarizeContext', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(rootUri);

      const folderTasksService = new FolderTasksService();
      vi.spyOn(folderTasksService, 'loadFolderTasks').mockResolvedValue([
        {
          id: 't1',
          title: 'Release vorbereiten',
          completed: false,
          status: 'todo',
          priority: 'high',
          createdAt: '2026-10-01T10:00:00Z',
        },
      ]);

      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/notes/projects/App-Launch') {
          return { type: vscode.FileType.Directory } as any;
        }
        if (uri.fsPath === '/workspace/notes/projects/App-Launch/tasks.json') {
          return { type: vscode.FileType.File } as any;
        }
        throw new Error('Not found');
      });

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/notes/projects/App-Launch') {
          return [
            ['kickoff.md', vscode.FileType.File],
            ['architecture.md', vscode.FileType.File],
          ];
        }
        return [];
      });

      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath.endsWith('kickoff.md')) {
          return Buffer.from('# Kickoff\n\nStart im November.', 'utf-8');
        }
        return Buffer.from('# Architecture\n\nServerless Setup.', 'utf-8');
      });

      const service = new JanusSearchService(companionManager, folderTasksService);
      const ctx = await service.getSummarizeContext('projects/App-Launch');

      expect(ctx).not.toBeNull();
      expect(ctx?.targetType).toBe('folder');
      expect(ctx?.targetLabel).toBe('projects/App-Launch');
      expect(ctx?.notes).toHaveLength(2);
      expect(ctx?.tasks).toHaveLength(1);
    });

    it('reads inbox.md and extracts meaningful content for getInboxContext', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(rootUri);

      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({
        type: vscode.FileType.File,
      } as any);
      vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
        Buffer.from('# Inbox\n\nNeues Feature für KI-Suche besprechen.', 'utf-8')
      );

      const service = new JanusSearchService(companionManager, new FolderTasksService());
      const inbox = await service.getInboxContext();

      expect(inbox).not.toBeNull();
      expect(inbox?.exists).toBe(true);
      expect(inbox?.isEmpty).toBe(false);
      expect(inbox?.meaningfulContent).toBe('Neues Feature für KI-Suche besprechen.');
    });
  });
});

