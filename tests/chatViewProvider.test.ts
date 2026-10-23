import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { ChatViewProvider } from '../src/editors/chatViewProvider';

describe('ChatViewProvider', () => {
  let mockContext: any;
  let mockCompanionManager: any;
  let mockSearchService: any;
  let mockFolderTasksService: any;
  let mockAiModelService: any;
  let mockWebviewView: any;
  let messageHandler: ((msg: any) => Promise<void>) | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockContext = {
      extensionUri: vscode.Uri.file('/extension'),
      subscriptions: [],
    };

    mockCompanionManager = {
      getNotesRootUri: vi.fn().mockReturnValue(vscode.Uri.file('/workspace/notes')),
      getCompanionStatus: vi.fn().mockResolvedValue({ tasksExist: true, chartExist: false }),
    };

    mockSearchService = {
      searchWorkspace: vi.fn().mockResolvedValue({
        query: 'test',
        noteMatches: [
          {
            title: 'Project Kickoff',
            relativePath: 'projects/kickoff.md',
            uri: vscode.Uri.file('/workspace/notes/projects/kickoff.md'),
            snippet: 'Kickoff notes and goals',
            score: 10,
            headings: [],
          },
        ],
        taskMatches: [
          {
            id: 'task-1',
            title: 'Prepare slides',
            completed: false,
            status: 'todo',
            priority: 'high',
            folder: 'projects',
            tasksUri: vscode.Uri.file('/workspace/notes/projects/projects.tasks.json'),
            score: 5,
          },
        ],
      }),
      getSummarizeContext: vi.fn().mockResolvedValue({
        targetType: 'note',
        targetLabel: 'projects/kickoff.md',
        notes: [
          {
            title: 'Project Kickoff',
            relativePath: 'projects/kickoff.md',
            uri: vscode.Uri.file('/workspace/notes/projects/kickoff.md'),
            content: '# Project Kickoff\nImportant decisions...',
          },
        ],
        tasks: [],
      }),
      getInboxContext: vi.fn().mockResolvedValue({
        exists: true,
        isEmpty: false,
        inboxUri: vscode.Uri.file('/workspace/notes/inbox.md'),
        meaningfulContent: '- Idea for redesign',
      }),
    };

    mockFolderTasksService = {
      loadAllTasks: vi.fn().mockResolvedValue([
        {
          folder: 'projects',
          tasksUri: vscode.Uri.file('/workspace/notes/projects/projects.tasks.json'),
          tasks: [
            { id: '1', title: 'Task 1', completed: false, status: 'todo', priority: 'high' },
            { id: '2', title: 'Task 2', completed: true, status: 'done', priority: 'low' },
          ],
        },
      ]),
    };

    mockAiModelService = {
      onDidChangeModel: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      getActiveModelInfo: vi.fn().mockResolvedValue({
        provider: 'ollama',
        modelId: 'llama3.3',
        label: 'Ollama: llama3.3',
      }),
      completePrompt: vi.fn().mockResolvedValue('KI-Antwort basierend auf Notizen'),
    };

    mockWebviewView = {
      webview: {
        options: {},
        html: '',
        asWebviewUri: (uri: any) => uri,
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn().mockImplementation((handler: any) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        }),
      },
      onDidDispose: vi.fn(),
    };
  });

  it('resolves webview view and sends initial model and empty history', async () => {
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );

    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    expect(mockWebviewView.webview.html).toContain('Janus KI & Suche');
    expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        model: expect.objectContaining({ provider: 'ollama' }),
        history: [],
      })
    );
  });

  it('handles /help command without calling AI model', async () => {
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await provider.processUserMessage('/help');

    expect(mockAiModelService.completePrompt).not.toHaveBeenCalled();
    const history = provider.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].sender).toBe('user');
    expect(history[0].text).toBe('/help');
    expect(history[1].sender).toBe('assistant');
    expect(history[1].text).toContain('/search');
    expect(history[1].actions?.[0].actionType).toBe('openSettings');
  });

  it('handles /search command with source note cards and tasks action', async () => {
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await provider.processUserMessage('/search kickoff');

    expect(mockSearchService.searchWorkspace).toHaveBeenCalledWith('kickoff', expect.anything());
    expect(mockAiModelService.completePrompt).toHaveBeenCalled();

    const history = provider.getHistory();
    const assistantMsg = history[1];
    expect(assistantMsg.sources?.length).toBe(1);
    expect(assistantMsg.sources?.[0].title).toBe('Project Kickoff');
    expect(assistantMsg.actions?.some((a) => a.actionType === 'openAllTasks')).toBe(true);
  });

  it('handles /tasks command and returns overview with actions', async () => {
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await provider.processUserMessage('/tasks');

    expect(mockFolderTasksService.loadAllTasks).toHaveBeenCalled();
    const history = provider.getHistory();
    const assistantMsg = history[1];
    expect(assistantMsg.actions?.some((a) => a.actionType === 'openAllTasks')).toBe(true);
  });

  it('handles /summarize command with notes context', async () => {
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await provider.processUserMessage('/summarize projects/kickoff.md');

    expect(mockSearchService.getSummarizeContext).toHaveBeenCalled();
    const history = provider.getHistory();
    const assistantMsg = history[1];
    expect(assistantMsg.sources?.length).toBe(1);
    expect(assistantMsg.sources?.[0].title).toBe('Project Kickoff');
  });

  it('handles /inbox command with inbox.md action buttons', async () => {
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await provider.processUserMessage('/inbox');

    expect(mockSearchService.getInboxContext).toHaveBeenCalled();
    const history = provider.getHistory();
    const assistantMsg = history[1];
    expect(assistantMsg.actions?.some((a) => a.actionType === 'sortInbox')).toBe(true);
  });

  it('handles free-form question with RAG retrieval and AI completion', async () => {
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await provider.processUserMessage('Was sind die nächsten Schritte im Projekt?');

    expect(mockSearchService.searchWorkspace).toHaveBeenCalled();
    expect(mockAiModelService.completePrompt).toHaveBeenCalled();

    const history = provider.getHistory();
    expect(history.length).toBe(2);
    expect(history[1].sources?.length).toBe(1);
  });

  it('dispatches webview messages to VS Code commands', async () => {
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined as any);
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    expect(messageHandler).toBeDefined();

    await messageHandler!({ type: 'openSettings' });
    expect(executeCommandSpy).toHaveBeenCalledWith('janus.openSettings');

    await messageHandler!({ type: 'openAllTasks' });
    expect(executeCommandSpy).toHaveBeenCalledWith('janus.openAllTasks');

    await messageHandler!({ type: 'openNote', uri: 'file:///workspace/notes/test.md' });
    expect(executeCommandSpy).toHaveBeenCalledWith(
      'vscode.openWith',
      expect.anything(),
      'janus.markdownEditor'
    );
  });

  it('clears history when requested', async () => {
    const provider = new ChatViewProvider(
      mockContext,
      mockCompanionManager,
      mockSearchService,
      mockFolderTasksService,
      mockAiModelService
    );
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await provider.processUserMessage('/help');
    expect(provider.getHistory().length).toBe(2);

    provider.clearHistory();
    expect(provider.getHistory().length).toBe(0);
    expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({ type: 'clearHistory' });
  });
});

