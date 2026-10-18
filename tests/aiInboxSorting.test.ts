import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { AiModelService } from '../src/services/aiModelService';
import {
  AiInboxSorterService,
  parseAiInboxSortItems,
  sanitizeRelativeNotePath,
  extractMeaningfulInboxBody,
} from '../src/services/aiInboxSorterService';
import { CompanionManager } from '../src/companion/companionManager';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import { __setConfigStore } from './__mocks__/vscode';

describe('aiInboxSorting', () => {
  let mockContext: vscode.ExtensionContext;
  let fsMap: Map<string, string>;

  beforeEach(() => {
    vi.restoreAllMocks();
    __setConfigStore({});
    (vscode.env as any).language = 'de';
    fsMap = new Map<string, string>();

    mockContext = {
      extensionUri: vscode.Uri.file('/ext'),
      secrets: {
        get: vi.fn(async () => undefined),
        store: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
      },
    } as any;

    (vscode.workspace as any).workspaceFolders = [
      { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 },
    ];

    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: vscode.Uri) => {
      if (fsMap.has(uri.fsPath)) {
        return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 100 };
      }
      throw new Error(`File not found: ${uri.fsPath}`);
    });

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: vscode.Uri) => {
      const content = fsMap.get(uri.fsPath);
      if (content === undefined) {
        throw new Error(`File not found: ${uri.fsPath}`);
      }
      return Buffer.from(content, 'utf-8');
    });

    vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(
      async (uri: vscode.Uri, content: Uint8Array) => {
        fsMap.set(uri.fsPath, Buffer.from(content).toString('utf-8'));
      }
    );

    vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue(undefined);
  });

  describe('sanitizeRelativeNotePath & parseAiInboxSortItems', () => {
    it('normalizes relative note paths to canonical English root categories (meetings, projects, knowledge) and rejects traversal or root inbox.md', () => {
      expect(sanitizeRelativeNotePath('Projekte/App-Launch')).toBe('projects/App-Launch.md');
      expect(sanitizeRelativeNotePath('projects/App-Launch/app-launch.md')).toBe(
        'projects/App-Launch/app-launch.md'
      );
      expect(sanitizeRelativeNotePath('Allgemeine Meetings/Sprint-Review')).toBe(
        'meetings/Sprint-Review.md'
      );
      expect(sanitizeRelativeNotePath('General Meetings/weekly.md')).toBe('meetings/weekly.md');
      expect(sanitizeRelativeNotePath('/Wissensbasis\\KI-Feature.md')).toBe(
        'knowledge/KI-Feature.md'
      );
      expect(sanitizeRelativeNotePath('/Ideen\\KI-Feature.md')).toBe('knowledge/KI-Feature.md');
      expect(sanitizeRelativeNotePath('bare-note')).toBe('knowledge/bare-note.md');
      expect(sanitizeRelativeNotePath('App-Launch/spec')).toBe('projects/App-Launch/spec.md');
      expect(sanitizeRelativeNotePath('../outside.md')).toBeNull();
      expect(sanitizeRelativeNotePath('inbox.md')).toBeNull();
      expect(sanitizeRelativeNotePath('INBOX')).toBeNull();
    });

    it('parses JSON sorting proposals wrapped in code fences', () => {
      const raw = `\`\`\`json
{
  "items": [
    {
      "title": "App Launch Stichpunkte",
      "content": "- Beta-Test am Freitag starten",
      "sourceText": "- Beta-Test am Freitag starten",
      "action": "append",
      "targetRelativePath": "Projekte/App-Launch"
    },
    {
      "title": "Ungültiger Pfad",
      "content": "Sollte ignoriert werden",
      "action": "create",
      "targetRelativePath": "../hack.md"
    }
  ]
}
\`\`\``;
      const items = parseAiInboxSortItems(raw);
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        title: 'App Launch Stichpunkte',
        content: '- Beta-Test am Freitag starten',
        sourceText: '- Beta-Test am Freitag starten',
        action: 'append',
        targetRelativePath: 'projects/App-Launch.md',
      });
    });

    it('detects empty or default welcome inbox content', () => {
      expect(
        extractMeaningfulInboxBody(
          '# Inbox\n\nWillkommen in deinen Janus Notes!\nHier kannst du neue Notizen und Gedanken erfassen.\n'
        )
      ).toBe('');
      expect(extractMeaningfulInboxBody('# Inbox\n\nNeuer Gedanke zum Projekt')).toBe(
        'Neuer Gedanke zum Projekt'
      );
    });
  });

  describe('AiInboxSorterService.sortInbox', () => {
    it('enforces strict append-only on existing notes even if AI proposes action="create"', async () => {
      __setConfigStore({ 'janus.ai.inboxSortConfirm': false });

      fsMap.set(
        '/workspace/inbox.md',
        '# Inbox\n\nGedanke A für bestehende Notiz.\n\nGedanke B für komplett neue Notiz.\n'
      );
      fsMap.set(
        '/workspace/projects/App-Launch.md',
        '# App Launch\n\nBestehender wichtiger Inhalt, der nicht gelöscht werden darf.'
      );

      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
        JSON.stringify({
          items: [
            {
              title: 'Ergänzung zum App Launch',
              content: 'Gedanke A für bestehende Notiz.',
              sourceText: 'Gedanke A für bestehende Notiz.',
              // Even though AI mistakenly says "create", service MUST append because file exists!
              action: 'create',
              targetRelativePath: 'Projekte/App-Launch.md',
            },
            {
              title: 'Neues Thema',
              content: 'Gedanke B für komplett neue Notiz.',
              sourceText: 'Gedanke B für komplett neue Notiz.',
              action: 'create',
              targetRelativePath: 'Wissensbasis/Architektur.md',
            },
          ],
        })
      );

      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
      const result = await sorter.sortInbox(vscode.Uri.file('/workspace/inbox.md'));

      expect(result.sortedItems).toHaveLength(2);
      expect(result.sortedItems[0].effectiveAction).toBe('append');
      expect(result.sortedItems[0].targetRelativePath).toBe('projects/App-Launch.md');
      expect(result.sortedItems[1].effectiveAction).toBe('create');
      expect(result.sortedItems[1].targetRelativePath).toBe('knowledge/Architektur.md');

      // Existing file must preserve 100% of old content and append the new section
      expect(fsMap.get('/workspace/projects/App-Launch.md')).toBe(
        '# App Launch\n\nBestehender wichtiger Inhalt, der nicht gelöscht werden darf.\n\nGedanke A für bestehende Notiz.\n'
      );

      // New file is created with heading + content
      expect(fsMap.get('/workspace/knowledge/Architektur.md')).toBe(
        '# Architektur\n\nGedanke B für komplett neue Notiz.\n'
      );

      // Inbox was completely sorted, so it is reset to '# Inbox\n\n'
      expect(fsMap.get('/workspace/inbox.md')).toBe('# Inbox\n\n');
    });

    it('uses preview confirmation by default and preserves deselected sections in inbox.md', async () => {
      // Default janus.ai.inboxSortConfirm is true
      fsMap.set(
        '/workspace/inbox.md',
        '# Inbox\n\nErster Abschnitt zum Sortieren.\n\nZweiter Abschnitt soll in Inbox bleiben.\n'
      );

      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
        JSON.stringify({
          items: [
            {
              title: 'Erster Abschnitt',
              content: 'Erster Abschnitt zum Sortieren.',
              sourceText: 'Erster Abschnitt zum Sortieren.',
              action: 'create',
              targetRelativePath: 'meetings/Erster.md',
            },
            {
              title: 'Zweiter Abschnitt',
              content: 'Zweiter Abschnitt soll in Inbox bleiben.',
              sourceText: 'Zweiter Abschnitt soll in Inbox bleiben.',
              action: 'create',
              targetRelativePath: 'knowledge/Zweiter.md',
            },
          ],
        })
      );

      // Simulate user selecting ONLY the first item in QuickPick
      vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) => {
        expect(items[0].label).toContain('Allgemeine Meetings/Erster.md');
        return [items[0]];
      });

      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
      const result = await sorter.sortInbox(vscode.Uri.file('/workspace/inbox.md'));

      expect(result.sortedItems).toHaveLength(1);
      expect(result.remainingItems).toHaveLength(1);
      expect(fsMap.get('/workspace/meetings/Erster.md')).toBe(
        '# Erster\n\nErster Abschnitt zum Sortieren.\n'
      );
      expect(fsMap.has('/workspace/knowledge/Zweiter.md')).toBe(false);

      // Unselected second section must remain in inbox.md!
      expect(fsMap.get('/workspace/inbox.md')).toBe(
        '# Inbox\n\nZweiter Abschnitt soll in Inbox bleiben.\n'
      );
    });
  });

  describe('MarkdownEditorProvider sortAiInbox Webview Message', () => {
    it('handles sortAiInbox message and resets aiInboxSorting loading state', async () => {
      const companionManager = new CompanionManager();
      const aiModelService = new AiModelService(mockContext);
      const aiTaskGeneratorService = { generateTasksForNote: vi.fn() } as any;
      const aiInboxSorterService = new AiInboxSorterService(aiModelService, companionManager);

      const sortSpy = vi.spyOn(aiInboxSorterService, 'sortInbox').mockResolvedValue({
        inboxUri: vscode.Uri.file('/workspace/inbox.md'),
        sortedItems: [
          {
            title: 'Sortiert',
            content: 'Inhalt',
            sourceText: 'Inhalt',
            action: 'create',
            targetRelativePath: 'projects/Test.md',
            targetUri: vscode.Uri.file('/workspace/projects/Test.md'),
            effectiveAction: 'create',
          },
        ],
        remainingItems: [],
      });

      const provider = new MarkdownEditorProvider(
        mockContext,
        companionManager,
        aiModelService,
        aiTaskGeneratorService,
        aiInboxSorterService
      );

      const mockDoc = {
        uri: vscode.Uri.file('/workspace/inbox.md'),
        getText: () => '# Inbox\n\nInhalt',
      } as any;

      const postMessageSpy = vi.fn();
      const mockPanel = {
        webview: { postMessage: postMessageSpy },
      } as any;

      await provider.handleWebviewMessage({ type: 'sortAiInbox' }, mockDoc, mockPanel);

      expect(sortSpy).toHaveBeenCalledWith(mockDoc.uri, mockDoc);
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'aiInboxSorting',
        isSorting: true,
      });
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'aiInboxSorting',
        isSorting: false,
      });
    });
  });
});
