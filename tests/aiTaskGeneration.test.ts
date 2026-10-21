import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { AiModelService } from '../src/services/aiModelService';
import {
  AiTaskGeneratorService,
  parseAiExtractedTasks,
} from '../src/services/aiTaskGeneratorService';
import { FolderTasksService } from '../src/services/folderTasksService';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import { CompanionManager } from '../src/companion/companionManager';
import { __setConfigStore } from './__mocks__/vscode';

describe('aiTaskGeneration', () => {
  let secretMap: Map<string, string>;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    __setConfigStore({});
    secretMap = new Map<string, string>();
    mockContext = {
      extensionUri: vscode.Uri.file('/ext'),
      secrets: {
        get: vi.fn(async (key: string) => secretMap.get(key)),
        store: vi.fn(async (key: string, value: string) => {
          secretMap.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
          secretMap.delete(key);
        }),
      },
    } as any;
    (vscode.workspace as any).workspaceFolders = [
      { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 },
    ];
  });

  describe('AiModelService', () => {
    it('discovers vscode-lm models and resolves active model label', async () => {
      vi.spyOn(vscode.lm, 'selectChatModels').mockResolvedValue([
        {
          id: 'claude-3.5-sonnet',
          name: 'Claude 3.5 Sonnet',
          vendor: 'copilot',
          family: 'claude',
          version: '1',
          maxInputTokens: 8192,
        } as any,
      ]);

      const service = new AiModelService(mockContext);
      const discovered = await service.discoverVsCodeLmModels();
      expect(discovered).toHaveLength(1);
      expect(discovered[0].label).toBe('Copilot: Claude 3.5 Sonnet');

      const active = await service.getActiveModelInfo();
      expect(active.provider).toBe('vscode-lm');
      expect(active.modelId).toBe('claude-3.5-sonnet');
      expect(active.label).toBe('Copilot: Claude 3.5 Sonnet');
    });

    it('persists provider and modelId and stores API keys in SecretStorage', async () => {
      const service = new AiModelService(mockContext);
      await service.setApiKey('openai', 'sk-test-123');
      expect(await service.getApiKey('openai')).toBe('sk-test-123');

      await service.setActiveModel('openai', 'gpt-4o');
      const active = await service.getActiveModelInfo();
      expect(active.provider).toBe('openai');
      expect(active.modelId).toBe('gpt-4o');
      expect(active.label).toBe('OpenAI: gpt-4o');
    });

    it('completes prompts using vscode-lm stream', async () => {
      vi.spyOn(vscode.lm, 'selectChatModels').mockResolvedValue([
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          vendor: 'copilot',
          sendRequest: vi.fn(async () => ({
            text: (async function* () {
              yield '{"tasks": [';
              yield '{"title": "API testen", "priority": "high"}';
              yield ']}';
            })(),
          })),
        } as any,
      ]);

      const service = new AiModelService(mockContext);
      const output = await service.completePrompt('Sys', 'User');
      expect(output).toBe('{"tasks": [{"title": "API testen", "priority": "high"}]}');
    });
  });

  describe('parseAiExtractedTasks & AiTaskGeneratorService', () => {
    it('parses JSON tasks even when wrapped in markdown code fences and normalizes dueDate', () => {
      const raw = `Hier sind die Aufgaben:
\`\`\`json
{
  "tasks": [
    { "title": "Datenbank-Migration schreiben", "priority": "high", "dueDate": "2026-10-24" },
    { "title": "Dokumentation aktualisieren", "priority": "low", "dueDate": "28.10.2026" }
  ]
}
\`\`\``;
      const tasks = parseAiExtractedTasks(raw);
      expect(tasks).toEqual([
        { title: 'Datenbank-Migration schreiben', priority: 'high', dueDate: '2026-10-24' },
        { title: 'Dokumentation aktualisieren', priority: 'low', dueDate: '2026-10-28' },
      ]);
    });

    it('extracts new tasks from note and deduplicates against existing folder tasks.json', async () => {
      const aiModelService = new AiModelService(mockContext);
      const folderTasksService = new FolderTasksService();
      const generator = new AiTaskGeneratorService(aiModelService, folderTasksService);

      vi.spyOn(folderTasksService, 'readFolderCompanion').mockResolvedValue({
        version: 1,
        title: 'Aufgaben: projekt-alpha',
        tasks: [
          {
            id: 'existing-1',
            title: 'Bestehende Aufgabe',
            completed: false,
            status: 'todo',
            priority: 'medium',
            createdAt: '2026-10-17T00:00:00.000Z',
          },
        ],
      });

      const writeSpy = vi
        .spyOn(folderTasksService, 'writeFolderCompanion')
        .mockResolvedValue(undefined);

      vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
        JSON.stringify({
          tasks: [
            { title: 'bestehende aufgabe', priority: 'medium' }, // duplicate (case-insensitive)
            { title: 'Neue Aufgabe aus Meeting', priority: 'high' },
          ],
        })
      );

      const noteUri = vscode.Uri.file('/workspace/notes/projekt-alpha/meeting.md');
      const result = await generator.generateTasksForNote(
        noteUri,
        '# Meeting\nWir müssen die Neue Aufgabe aus Meeting erledigen.'
      );

      expect(result.addedTasks).toHaveLength(1);
      expect(result.addedTasks[0].title).toBe('Neue Aufgabe aus Meeting');
      expect(result.addedTasks[0].priority).toBe('high');
      expect(result.addedTasks[0].note).toBe('meeting.md');
      expect(result.totalTasks).toBe(2);
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('MarkdownEditorProvider AI Webview Messages', () => {
    it('handles generateAiTasks and selectAiModel messages from the footer bar', async () => {
      const companionManager = new CompanionManager();
      const aiModelService = new AiModelService(mockContext);
      const aiTaskGeneratorService = new AiTaskGeneratorService(aiModelService);

      const executeCommandSpy = vi
        .spyOn(vscode.commands, 'executeCommand')
        .mockResolvedValue(undefined);

      const generateSpy = vi
        .spyOn(aiTaskGeneratorService, 'generateTasksForNote')
        .mockResolvedValue({
          tasksUri: vscode.Uri.file('/workspace/notes/tasks.json'),
          addedTasks: [
            {
              id: 't-1',
              title: 'Generierte Aufgabe',
              completed: false,
              status: 'todo',
              priority: 'medium',
              createdAt: '',
            },
          ],
          totalTasks: 1,
        });

      const provider = new MarkdownEditorProvider(
        mockContext,
        companionManager,
        aiModelService,
        aiTaskGeneratorService
      );

      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/meeting.md'),
        getText: () => '# Meeting\nTodo item',
      } as any;

      const postMessageSpy = vi.fn();
      const mockPanel = {
        webview: { postMessage: postMessageSpy },
      } as any;

      await provider.handleWebviewMessage({ type: 'selectAiModel' }, mockDoc, mockPanel);
      expect(executeCommandSpy).toHaveBeenCalledWith('janus.openSettings');

      await provider.handleWebviewMessage({ type: 'generateAiTasks' }, mockDoc, mockPanel);
      expect(generateSpy).toHaveBeenCalledWith(mockDoc.uri, '# Meeting\nTodo item');
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'aiTasksGenerating',
        isGenerating: true,
      });
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'aiTasksGenerating',
        isGenerating: false,
      });
    });
  });
});

