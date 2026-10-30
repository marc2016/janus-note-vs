import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { AiModelService } from '../src/services/aiModelService';
import {
  AiInboxSorterService,
  parseAiInboxSortItems,
  sanitizeRelativeNotePath,
  extractMeaningfulInboxBody,
  splitInboxBlocks,
  collectNoteOutlines,
  formatAppendedInboxSection,
  splitDailyNoteBlocks,
} from '../src/services/aiInboxSorterService';
import * as fs from 'fs';
import * as path from 'path';
import { CompanionManager } from '../src/companion/companionManager';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import * as markdownEditorModule from '../src/editors/markdownEditorProvider';
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

    it('ignores proposals into the journal folder', () => {
      expect(sanitizeRelativeNotePath('journal/2026-10-28.md')).toBeNull();
      expect(sanitizeRelativeNotePath('Journal/notizen')).toBeNull();

      const blocks = splitInboxBlocks('Gedanke');
      const items = parseAiInboxSortItems(
        JSON.stringify({ items: [{ block: 1, title: 'X', action: 'append', targetRelativePath: 'journal/2026-10-28.md' }] }),
        blocks
      );
      expect(items).toEqual([]);
    });

    it('parses block assignments wrapped in code fences', () => {
      const blocks = splitInboxBlocks('- Beta-Test am Freitag starten\n\nZweiter Gedanke');
      const raw = `\`\`\`json
{
  "items": [
    {
      "block": 1,
      "title": "App Launch Stichpunkte",
      "content": "wird ignoriert",
      "sourceText": "wird ignoriert",
      "action": "append",
      "targetRelativePath": "Projekte/App-Launch"
    },
    {
      "block": 2,
      "title": "Ungültiger Pfad",
      "action": "create",
      "targetRelativePath": "../hack.md"
    }
  ]
}
\`\`\``;
      const items = parseAiInboxSortItems(raw, blocks);
      expect(items).toEqual([
        {
          block: blocks[0],
          title: 'App Launch Stichpunkte',
          action: 'append',
          targetRelativePath: 'projects/App-Launch.md',
        },
      ]);
    });

    it('drops unknown block numbers and keeps only the first assignment per block', () => {
      const blocks = splitInboxBlocks('Erster\n\nZweiter');
      const items = parseAiInboxSortItems(
        JSON.stringify([
          { block: 7, title: 'Gibt es nicht', targetRelativePath: 'knowledge/x.md' },
          { block: 'zwei', targetRelativePath: 'knowledge/y.md' },
          { block: 2, title: 'Zuerst', targetRelativePath: 'knowledge/a.md' },
          { block: 2, title: 'Doppelt', targetRelativePath: 'knowledge/b.md' },
        ]),
        blocks
      );
      expect(items).toHaveLength(1);
      expect(items[0].block.index).toBe(2);
      expect(items[0].targetRelativePath).toBe('knowledge/a.md');
    });

    it('falls back to the block heading or first line when the title is missing', () => {
      const headingBlocks = splitInboxBlocks('## Sync-Architektur\nText');
      expect(
        parseAiInboxSortItems(
          JSON.stringify({ items: [{ block: 1, targetRelativePath: 'projects/Sync/sync.md' }] }),
          headingBlocks
        )[0].title
      ).toBe('Sync-Architektur');

      const listBlocks = splitInboxBlocks('- Heartbeat-Intervall verringern\n- Offline-Queue');
      expect(
        parseAiInboxSortItems(
          JSON.stringify({ items: [{ block: 1, targetRelativePath: 'knowledge/x.md' }] }),
          listBlocks
        )[0].title
      ).toBe('Heartbeat-Intervall verringern');
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

    it('removes any variant of the welcome paragraph but keeps following user content', () => {
      const sample = fs.readFileSync(path.join(__dirname, '../sample/inbox.md'), 'utf-8');
      const body = extractMeaningfulInboxBody(sample);
      expect(body).not.toContain('Willkommen');
      expect(body.startsWith('## App-Launch')).toBe(true);

      expect(
        extractMeaningfulInboxBody(
          '# Inbox\n\nWillkommen in deinen Janus Notes!\nIrgendein anderer Satz.\n\nMein Gedanke'
        )
      ).toBe('Mein Gedanke');
    });
  });

  describe('splitInboxBlocks', () => {
    it('splits sample/inbox.md into one block per ## section', () => {
      const sample = fs.readFileSync(path.join(__dirname, '../sample/inbox.md'), 'utf-8');
      const blocks = splitInboxBlocks(extractMeaningfulInboxBody(sample));
      expect(blocks).toHaveLength(8);
      expect(blocks[0].heading).toBe('App-Launch: Beta-Feedback & Push-Notifications');
      expect(blocks.map((b) => b.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('treats text before the first heading as its own block', () => {
      const blocks = splitInboxBlocks('Intro\n\n## A\na\n\n## B\nb\n### B.1\nb1');
      expect(blocks.map((b) => b.text)).toEqual(['Intro', '## A\na', '## B\nb', '### B.1\nb1']);
      expect(blocks[0].heading).toBeUndefined();
    });

    it('splits by paragraphs when there are no headings and keeps lists together', () => {
      const blocks = splitInboxBlocks('Erster Gedanke.\n\n- Punkt 1\n- Punkt 2\n- Punkt 3\n\n\nDritter Gedanke.');
      expect(blocks.map((b) => b.text)).toEqual([
        'Erster Gedanke.',
        '- Punkt 1\n- Punkt 2\n- Punkt 3',
        'Dritter Gedanke.',
      ]);
    });

    it('never splits inside fenced code', () => {
      const headingInFence = splitInboxBlocks('## A\n```md\n## kein Block\n```\n\n## B');
      expect(headingInFence).toHaveLength(2);
      expect(headingInFence[0].text).toBe('## A\n```md\n## kein Block\n```');

      const blankInFence = splitInboxBlocks('Text\n~~~\nzeile 1\n\nzeile 2\n~~~\n\nNächster');
      expect(blankInFence.map((b) => b.text)).toEqual(['Text\n~~~\nzeile 1\n\nzeile 2\n~~~', 'Nächster']);
    });

    it('reports the first and last non-blank line of each block', () => {
      const headingBlocks = splitInboxBlocks('Intro\n\n## A\na\n\n\n## B\nb\n');
      expect(headingBlocks.map((b) => [b.startLine, b.endLine])).toEqual([
        [0, 0],
        [2, 3],
        [6, 7],
      ]);

      const paragraphBlocks = splitInboxBlocks('\nErster\n\n- a\n- b');
      expect(paragraphBlocks.map((b) => [b.startLine, b.endLine])).toEqual([
        [1, 1],
        [3, 4],
      ]);
    });
  });

  describe('formatAppendedInboxSection', () => {
    it('uses the given suffix in the heading', () => {
      expect(formatAppendedInboxSection('Thema', '## Call mit Anna\nText', '2026-10-27')).toBe(
        '## Call mit Anna (2026-10-27)\n\nText'
      );
      expect(formatAppendedInboxSection('Heartbeat', 'Absatz', '2026-10-29 07:30')).toBe(
        '## Heartbeat (2026-10-29 07:30)\n\nAbsatz'
      );
    });
  });

  describe('collectNoteOutlines', () => {
    it('collects title and ## headings without sort timestamps', async () => {
      fsMap.set(
        '/workspace/projects/App-Launch/app-launch.md',
        '# App-Launch\n\n## Push-Notifications\n```\n## im Code\n```\n## Beta-Feedback (2026-10-20 09:15)\n## Call mit Anna (2026-10-27)\n'
      );
      fsMap.set('/workspace/knowledge/ohne-titel.md', 'Nur Text\n## Abschnitt');
      const outlines = await collectNoteOutlines(vscode.Uri.file('/workspace'), [
        vscode.Uri.file('/workspace/projects/App-Launch/app-launch.md'),
        vscode.Uri.file('/workspace/knowledge/ohne-titel.md'),
        vscode.Uri.file('/workspace/inbox.md'),
      ]);
      expect(outlines).toEqual([
        { relativePath: 'knowledge/ohne-titel.md', title: 'ohne-titel', headings: ['Abschnitt'] },
        {
          relativePath: 'projects/App-Launch/app-launch.md',
          title: 'App-Launch',
          headings: ['Push-Notifications', 'Beta-Feedback', 'Call mit Anna'],
        },
      ]);
    });

    it('does not offer daily notes as targets', async () => {
      fsMap.set('/workspace/journal/2026-10-28.md', '# Mittwoch\n## Call');
      fsMap.set('/workspace/knowledge/a.md', '# A');
      const outlines = await collectNoteOutlines(vscode.Uri.file('/workspace'), [
        vscode.Uri.file('/workspace/journal/2026-10-28.md'),
        vscode.Uri.file('/workspace/knowledge/a.md'),
      ]);
      expect(outlines.map((o) => o.relativePath)).toEqual(['knowledge/a.md']);
    });

    it('only sends paths for notes beyond the outline limit', async () => {
      fsMap.set('/workspace/knowledge/a.md', '# A\n## a1');
      fsMap.set('/workspace/knowledge/b.md', '# B\n## b1');
      const outlines = await collectNoteOutlines(
        vscode.Uri.file('/workspace'),
        [vscode.Uri.file('/workspace/knowledge/b.md'), vscode.Uri.file('/workspace/knowledge/a.md')],
        1
      );
      expect(outlines).toEqual([
        { relativePath: 'knowledge/a.md', title: 'A', headings: ['a1'] },
        { relativePath: 'knowledge/b.md', headings: [] },
      ]);
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
              block: 1,
              title: 'Ergänzung zum App Launch',
              // Even though AI mistakenly says "create", service MUST append because file exists!
              action: 'create',
              targetRelativePath: 'Projekte/App-Launch.md',
            },
            {
              block: 2,
              title: 'Neues Thema',
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

      // Existing file must preserve 100% of old content and append the new section with a ## <Thema> (YYYY-MM-DD HH:mm) heading
      const appendedContent = fsMap.get('/workspace/projects/App-Launch.md')!;
      expect(appendedContent).toMatch(
        /^# App Launch\n\nBestehender wichtiger Inhalt, der nicht gelöscht werden darf\.\n\n## Ergänzung zum App Launch \(\d{4}-\d{2}-\d{2} \d{2}:\d{2}\)\n\nGedanke A für bestehende Notiz\.\n$/
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
              block: 1,
              title: 'Erster Abschnitt',
              action: 'create',
              targetRelativePath: 'meetings/Erster.md',
            },
            {
              block: 2,
              title: 'Zweiter Abschnitt',
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
      expect(result.remainingBlockCount).toBe(1);
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

  describe('AiInboxSorterService.sortInbox block safety', () => {
    const assign = (...items: Array<[number, string]>) =>
      JSON.stringify({
        items: items.map(([block, target]) => ({ block, title: `Titel ${block}`, action: 'create', targetRelativePath: target })),
      });

    it('sends numbered blocks and note headings to the AI, without the welcome text', async () => {
      __setConfigStore({ 'janus.ai.inboxSortConfirm': false });
      fsMap.set(
        '/workspace/inbox.md',
        '# Inbox\n\nWillkommen in deinen Janus Notes!\nHier kannst du schnell etwas erfassen.\n\n## Push\nAPNs erneuern\n\n## Retro\nFokuszeiten'
      );
      fsMap.set('/workspace/projects/app.md', '# App\n\n## Push-Notifications (2026-10-20 09:15)\n');
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace') {
          return [
            ['inbox.md', vscode.FileType.File],
            ['projects', vscode.FileType.Directory],
          ];
        }
        if (uri.fsPath === '/workspace/projects') {
          return [['app.md', vscode.FileType.File]];
        }
        return [];
      });

      const aiModelService = new AiModelService(mockContext);
      const promptSpy = vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue('{"items": []}');
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
      const result = await sorter.sortInbox(vscode.Uri.file('/workspace/inbox.md'));

      const userPrompt = promptSpy.mock.calls[0][1];
      expect(userPrompt).toContain('[Block 1]\n## Push\nAPNs erneuern');
      expect(userPrompt).toContain('[Block 2]\n## Retro\nFokuszeiten');
      expect(userPrompt).toContain('- projects/app.md — "App": Push-Notifications');
      expect(userPrompt).not.toContain('Willkommen');
      expect(result.sortedItems).toHaveLength(0);
      expect(result.remainingBlockCount).toBe(2);
      // No proposals: inbox stays untouched
      expect(fsMap.get('/workspace/inbox.md')).toContain('Willkommen');
    });

    it('keeps unassigned blocks in the inbox even when all proposals are confirmed', async () => {
      __setConfigStore({ 'janus.ai.inboxSortConfirm': false });
      fsMap.set('/workspace/inbox.md', '# Inbox\n\nEins.\n\nZwei.\n\nDrei.\n');
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
        assign([1, 'knowledge/eins.md'], [3, 'knowledge/drei.md'])
      );
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
      const result = await sorter.sortInbox(vscode.Uri.file('/workspace/inbox.md'));

      expect(result.sortedItems).toHaveLength(2);
      expect(result.unassignedBlocks.map((b) => b.text)).toEqual(['Zwei.']);
      expect(result.remainingBlockCount).toBe(1);
      expect(fsMap.get('/workspace/inbox.md')).toBe('# Inbox\n\nZwei.\n');
    });

    it('moves the block text verbatim, even if the AI returns paraphrased content', async () => {
      __setConfigStore({ 'janus.ai.inboxSortConfirm': false });
      const block = '## Sync-Architektur: WebSocket Heartbeats\nWenn die Verbindung   abreißt:\n- Heartbeat **15s**\n- [[architektur:9]]';
      fsMap.set('/workspace/inbox.md', `# Inbox\n\n${block}\n`);
      fsMap.set('/workspace/projects/sync.md', '# Sync');
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
        JSON.stringify({
          items: [{ block: 1, title: 'Sync', content: 'umformuliert', action: 'append', targetRelativePath: 'projects/sync.md' }],
        })
      );
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
      await sorter.sortInbox(vscode.Uri.file('/workspace/inbox.md'));

      expect(fsMap.get('/workspace/projects/sync.md')).toMatch(
        /^# Sync\n\n## Sync-Architektur: WebSocket Heartbeats \(\d{4}-\d{2}-\d{2} \d{2}:\d{2}\)\n\nWenn die Verbindung {3}abreißt:\n- Heartbeat \*\*15s\*\*\n- \[\[architektur:9\]\]\n$/
      );
      expect(fsMap.get('/workspace/inbox.md')).toBe('# Inbox\n\n');
    });

    it('skips blocks edited during sorting and keeps newly typed text', async () => {
      let docText = '# Inbox\n\n## A\nalpha\n\n## B\nbeta\n';
      const openDoc = {
        uri: vscode.Uri.file('/workspace/inbox.md'),
        getText: () => docText,
      } as any;
      fsMap.set('/workspace/inbox.md', docText);

      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockImplementation(async () => {
        // User edits block B and adds a new section while the AI is working
        docText = '# Inbox\n\n## A\nalpha\n\n## B\nbeta geändert\n\n## C\nneu\n';
        return assign([1, 'knowledge/a.md'], [2, 'knowledge/b.md']);
      });
      vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) =>
        items.filter((i: any) => i.proposal)
      );

      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
      const result = await sorter.sortInbox(openDoc.uri, openDoc);

      expect(result.sortedItems.map((i) => i.targetRelativePath)).toEqual(['knowledge/a.md']);
      expect(result.skippedChanged.map((p) => p.block.index)).toEqual([2]);
      expect(fsMap.has('/workspace/knowledge/b.md')).toBe(false);
      expect(fsMap.get('/workspace/inbox.md')).toBe('# Inbox\n\n## B\nbeta geändert\n\n## C\nneu\n');
      expect(result.remainingBlockCount).toBe(2);
    });

    it('rewrites relative paths in appended and created notes, but not in the inbox', async () => {
      __setConfigStore({ 'janus.ai.inboxSortConfirm': false });
      fsMap.set(
        '/workspace/inbox.md',
        '# Inbox\n\nSiehe [Plan](knowledge/plan.md) für Details.\n\n![Skizze](assets/skizze.png) neu\n\nBleibt ![Skizze](assets/skizze.png)\n'
      );
      fsMap.set('/workspace/knowledge/plan.md', '# Plan');
      fsMap.set('/workspace/assets/skizze.png', 'png');
      fsMap.set('/workspace/projects/app/launch.md', '# Launch');
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
        JSON.stringify({
          items: [
            { block: 1, title: 'Plan', action: 'append', targetRelativePath: 'projects/app/launch.md' },
            { block: 2, title: 'Skizze', action: 'create', targetRelativePath: 'meetings/skizze.md' },
          ],
        })
      );
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
      await sorter.sortInbox(vscode.Uri.file('/workspace/inbox.md'));

      expect(fsMap.get('/workspace/projects/app/launch.md')).toContain(
        '\n\nSiehe [Plan](../../knowledge/plan.md) für Details.\n'
      );
      expect(fsMap.get('/workspace/meetings/skizze.md')).toBe('# skizze\n\n![Skizze](../assets/skizze.png) neu\n');
      expect(fsMap.get('/workspace/inbox.md')).toBe('# Inbox\n\nBleibt ![Skizze](assets/skizze.png)\n');
    });

    it('lists unassigned blocks as a separator in the preview', async () => {
      fsMap.set('/workspace/inbox.md', '# Inbox\n\nEins.\n\nZwei.\n');
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(assign([1, 'knowledge/eins.md']));
      let shownItems: any[] = [];
      vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) => {
        shownItems = items;
        return undefined;
      });

      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());
      const result = await sorter.sortInbox(vscode.Uri.file('/workspace/inbox.md'));

      expect(result.cancelled).toBe(true);
      const separator = shownItems.find((i) => i.kind === vscode.QuickPickItemKind.Separator);
      expect(separator?.label).toBe('1 Abschnitt(e) ohne Vorschlag bleiben in der Inbox');
      expect(fsMap.get('/workspace/inbox.md')).toBe('# Inbox\n\nEins.\n\nZwei.\n');
    });
  });

  describe('splitDailyNoteBlocks', () => {
    it('leaves out frontmatter and the title heading', () => {
      const text = '---\ndate: 2026-10-29\n---\n# Donnerstag, 29.10.2026\n\n## Call\nText\n\n## Idee\nDark Mode\n';
      const blocks = splitDailyNoteBlocks(text);
      expect(blocks.map((b) => b.text)).toEqual(['## Call\nText', '## Idee\nDark Mode']);
      // Line numbers refer to the file
      expect(blocks.map((b) => [b.startLine, b.endLine])).toEqual([
        [5, 6],
        [8, 9],
      ]);
    });

    it('skips blocks that already have a link line', () => {
      const text = '# Donnerstag\n\n## Call\nText\n\n-> [[projects/app]]\n\n## Idee\nDark Mode\n';
      expect(splitDailyNoteBlocks(text).map((b) => [b.index, b.text])).toEqual([[1, '## Idee\nDark Mode']]);
    });

    it('keeps a link line with its paragraph when there are no ## headings', () => {
      const text = '# Donnerstag\n\nErster Gedanke\n\n-> [[knowledge/erster]]\n\nZweiter Gedanke\n';
      expect(splitDailyNoteBlocks(text).map((b) => b.text)).toEqual(['Zweiter Gedanke']);
    });

    it('does not treat a link line inside fenced code as a marker', () => {
      const text = '## Beispiel\n```\n-> [[x]]\n```\n';
      expect(splitDailyNoteBlocks(text)).toHaveLength(1);
    });
  });

  describe('AiInboxSorterService.sortDailyNote', () => {
    const dailyPath = '/workspace/journal/2026-10-27.md';
    const dailyUri = vscode.Uri.file(dailyPath);
    const assign = (...items: Array<[number, string, ('append' | 'create')?]>) =>
      JSON.stringify({
        items: items.map(([block, target, action]) => ({
          block,
          title: `Titel ${block}`,
          action: action ?? 'append',
          targetRelativePath: target,
        })),
      });

    beforeEach(() => {
      __setConfigStore({ 'janus.ai.inboxSortConfirm': false });
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
    });

    it('copies a block into the target and links it in the daily note', async () => {
      fsMap.set(dailyPath, '---\ndate: 2026-10-27\n---\n# Dienstag, 27.10.2026\n\n## Call mit Anna\nBackend auf Postgres umstellen\n\n## Notiz\nBleibt hier\n');
      fsMap.set('/workspace/projects/App-Launch/architektur.md', '# Architektur\n');
      fsMap.set('/workspace/inbox.md', '# Inbox\n\nUnberührt\n');
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(assign([1, 'projects/App-Launch/architektur.md']));
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());

      const result = await sorter.sortDailyNote(dailyUri);

      expect(result.source).toBe('daily');
      expect(result.sortedItems).toHaveLength(1);
      expect(fsMap.get('/workspace/projects/App-Launch/architektur.md')).toBe(
        '# Architektur\n\n## Call mit Anna (2026-10-27)\n\nBackend auf Postgres umstellen\n'
      );
      expect(fsMap.get(dailyPath)).toBe(
        '---\ndate: 2026-10-27\n---\n# Dienstag, 27.10.2026\n\n## Call mit Anna\nBackend auf Postgres umstellen\n\n-> [[projects/App-Launch/architektur]]\n\n## Notiz\nBleibt hier\n'
      );
      expect(fsMap.get('/workspace/inbox.md')).toBe('# Inbox\n\nUnberührt\n');
    });

    it('creates a new note and links it', async () => {
      fsMap.set(dailyPath, '# Dienstag\n\nDark Mode für die App\n');
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(assign([1, 'knowledge/dark-mode.md', 'create']));
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());

      await sorter.sortDailyNote(dailyUri);

      expect(fsMap.get('/workspace/knowledge/dark-mode.md')).toBe('# dark-mode\n\nDark Mode für die App\n');
      expect(fsMap.get(dailyPath)).toBe('# Dienstag\n\nDark Mode für die App\n\n-> [[knowledge/dark-mode]]\n');
    });

    it('links only confirmed blocks and keeps the line ending', async () => {
      __setConfigStore({ 'janus.ai.inboxSortConfirm': true });
      fsMap.set(dailyPath, '## Eins\r\na\r\n\r\n## Zwei\r\nb\r\n\r\n## Drei\r\nc\r\n');
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
        assign([1, 'knowledge/eins.md', 'create'], [2, 'knowledge/zwei.md', 'create'])
      );
      vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) =>
        items.filter((item: any) => item.proposal?.block.index === 2)
      );
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());

      const result = await sorter.sortDailyNote(dailyUri);

      expect(result.sortedItems.map((i) => i.targetRelativePath)).toEqual(['knowledge/zwei.md']);
      expect(fsMap.has('/workspace/knowledge/eins.md')).toBe(false);
      expect(fsMap.get(dailyPath)).toBe('## Eins\r\na\r\n\r\n## Zwei\r\nb\r\n\r\n-> [[knowledge/zwei]]\r\n\r\n## Drei\r\nc\r\n');
    });

    it('only sorts new blocks on a second run', async () => {
      fsMap.set(dailyPath, '## Call\nText\n\n-> [[projects/app]]\n\n## Idee\nDark Mode\n');
      const aiModelService = new AiModelService(mockContext);
      const promptSpy = vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue('{"items": []}');
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());

      await sorter.sortDailyNote(dailyUri);

      const userPrompt = promptSpy.mock.calls[0][1];
      expect(userPrompt).toContain('Blöcke aus journal/2026-10-27.md:');
      expect(userPrompt).toContain('[Block 1]\n## Idee\nDark Mode');
      expect(userPrompt).not.toContain('## Call');
    });

    it('reports nothing to sort without calling the AI model', async () => {
      fsMap.set(dailyPath, '---\ndate: 2026-10-27\n---\n# Dienstag\n\n## Call\nText\n\n-> [[projects/app]]\n');
      const aiModelService = new AiModelService(mockContext);
      const promptSpy = vi.spyOn(aiModelService, 'completePrompt');
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());

      const result = await sorter.sortDailyNote(dailyUri);

      expect(result.skippedEmpty).toBe(true);
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('neither copies nor links a block that changed during sorting', async () => {
      fsMap.set(dailyPath, '## Call\nText\n');
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'completePrompt').mockImplementation(async () => {
        fsMap.set(dailyPath, '## Call\nText geändert\n');
        return assign([1, 'knowledge/call.md', 'create']);
      });
      const sorter = new AiInboxSorterService(aiModelService, new CompanionManager());

      const result = await sorter.sortDailyNote(dailyUri);

      expect(result.skippedChanged).toHaveLength(1);
      expect(fsMap.has('/workspace/knowledge/call.md')).toBe(false);
      expect(fsMap.get(dailyPath)).toBe('## Call\nText geändert\n');
    });

    it('rejects notes that are not daily notes', async () => {
      const sorter = new AiInboxSorterService(new AiModelService(mockContext), new CompanionManager());
      await expect(sorter.sortDailyNote(vscode.Uri.file('/workspace/projects/app.md'))).rejects.toThrow('keine Tagesnotiz');
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
            block: { index: 1, text: 'Inhalt' },
            title: 'Sortiert',
            action: 'create',
            targetRelativePath: 'projects/Test.md',
            targetUri: vscode.Uri.file('/workspace/projects/Test.md'),
            effectiveAction: 'create',
          },
        ],
        unassignedBlocks: [],
        skippedChanged: [],
        remainingBlockCount: 1,
      });
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

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
      expect(infoSpy).toHaveBeenCalledWith(
        '1 Abschnitt(e) einsortiert, 1 in der Inbox verblieben.',
        'Notiz öffnen'
      );
    });

    it('routes the footer button by the open note', async () => {
      const companionManager = new CompanionManager();
      const aiModelService = new AiModelService(mockContext);
      const aiInboxSorterService = new AiInboxSorterService(aiModelService, companionManager);
      const emptyDaily = {
        inboxUri: vscode.Uri.file('/workspace/journal/2026-10-29.md'),
        source: 'daily' as const,
        sortedItems: [],
        unassignedBlocks: [],
        skippedChanged: [],
        remainingBlockCount: 0,
        skippedEmpty: true,
      };
      const dailySpy = vi.spyOn(aiInboxSorterService, 'sortDailyNote').mockResolvedValue(emptyDaily);
      const inboxSpy = vi.spyOn(aiInboxSorterService, 'sortInbox').mockResolvedValue({ ...emptyDaily, source: 'inbox' });
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
      const provider = new MarkdownEditorProvider(
        mockContext,
        companionManager,
        aiModelService,
        { generateTasksForNote: vi.fn() } as any,
        aiInboxSorterService
      );
      const panel = { webview: { postMessage: vi.fn() } } as any;
      const doc = (p: string) => ({ uri: vscode.Uri.file(p), getText: () => '' }) as any;

      expect(provider.getSortSource(vscode.Uri.file('/workspace/inbox.md'))).toBe('inbox');
      expect(provider.getSortSource(vscode.Uri.file('/workspace/journal/2026-10-29.md'))).toBe('daily');
      expect(provider.getSortSource(vscode.Uri.file('/workspace/projects/App-Launch/architektur.md'))).toBeUndefined();

      const dailyDoc = doc('/workspace/journal/2026-10-29.md');
      await provider.handleWebviewMessage({ type: 'sortAiInbox' }, dailyDoc, panel);
      expect(dailySpy).toHaveBeenCalledWith(dailyDoc.uri, dailyDoc);
      expect(inboxSpy).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith('Die Tagesnotiz enthält keine neuen Einträge zum Einsortieren.');

      dailySpy.mockClear();
      panel.webview.postMessage.mockClear();
      await provider.handleWebviewMessage({ type: 'sortAiInbox' }, doc('/workspace/projects/app.md'), panel);
      expect(dailySpy).not.toHaveBeenCalled();
      expect(inboxSpy).not.toHaveBeenCalled();
      expect(panel.webview.postMessage).not.toHaveBeenCalled();
    });

    it('tells the webview which sort button to show', async () => {
      const companionManager = new CompanionManager();
      const aiModelService = new AiModelService(mockContext);
      vi.spyOn(aiModelService, 'getActiveModelInfo').mockResolvedValue(undefined as any);
      const provider = new MarkdownEditorProvider(mockContext, companionManager, aiModelService);
      const panel = { webview: { postMessage: vi.fn() } } as any;

      await provider.handleWebviewMessage(
        { type: 'ready' },
        { uri: vscode.Uri.file('/workspace/journal/2026-10-29.md'), getText: () => '' } as any,
        panel,
        () => {},
        async () => {},
        async () => {}
      );

      expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'sortSource', source: 'daily' });
    });

    it('reports a daily note sort as copied and linked', () => {
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
      markdownEditorModule.showInboxSortResult({
        inboxUri: vscode.Uri.file('/workspace/journal/2026-10-29.md'),
        source: 'daily',
        sortedItems: [
          {
            block: { index: 1, text: 'x' },
            title: 'x',
            action: 'create',
            targetRelativePath: 'knowledge/x.md',
            targetUri: vscode.Uri.file('/workspace/knowledge/x.md'),
            effectiveAction: 'create',
          },
        ],
        unassignedBlocks: [],
        skippedChanged: [],
        remainingBlockCount: 2,
      });
      expect(infoSpy).toHaveBeenCalledWith('1 Abschnitt(e) einsortiert und verlinkt.', 'Notiz öffnen');
    });

    it('mentions blocks that changed during sorting', () => {
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
      markdownEditorModule.showInboxSortResult({
        inboxUri: vscode.Uri.file('/workspace/inbox.md'),
        sortedItems: [],
        unassignedBlocks: [],
        skippedChanged: [
          { block: { index: 1, text: 'x' }, title: 'x', action: 'create', targetRelativePath: 'knowledge/x.md' },
        ],
        remainingBlockCount: 1,
      });
      expect(infoSpy).toHaveBeenCalledWith(
        'Keine Abschnitte einsortiert. 1 Abschnitt(e) wurden währenddessen geändert und nicht verschoben.'
      );
    });
  });
});
