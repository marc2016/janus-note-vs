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

  describe('diagram change requests', () => {
    const noteUri = vscode.Uri.file('/workspace/notes/project-plan.md');
    let noteText: string;
    const diagram = (code: string) => `# Plan\n\nText\n\n\`\`\`mermaid\n${code}\n\`\`\`\n`;

    const setup = async () => {
      noteText = diagram('graph TD; A-->B');
      (vscode.workspace as any).openTextDocument = vi.fn(async () => ({ uri: noteUri, getText: () => noteText }));
      const provider = new ChatViewProvider(
        mockContext,
        mockCompanionManager,
        mockSearchService,
        mockFolderTasksService,
        mockAiModelService
      );
      const applier = { replaceMermaidCode: vi.fn(async () => 'ok' as const) };
      provider.setDiagramApplier(applier);
      await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      provider.setDiagramContext({ noteUri: noteUri.toString(), code: 'graph TD; A-->B', line: 5 });
      return { provider, applier };
    };
    const lastAssistant = (provider: ChatViewProvider) => provider.getHistory().filter((m) => m.sender === 'assistant').at(-1)!;

    it('shows the diagram context chip', async () => {
      await setup();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: 'diagramContext',
        context: { label: 'Diagramm · project-plan.md, Zeile 5', line: 5 },
      });
    });

    it('sends the current code and offers Übernehmen and Code kopieren', async () => {
      const { provider } = await setup();
      noteText = diagram('graph TD; A-->B; B-->D');
      mockAiModelService.completePrompt.mockResolvedValue('Kalender ergänzt.\n\n```mermaid\ngraph TD; A-->B; B-->D; D-->K\n```');

      await provider.processUserMessage('Füge nach Notizen einen Schritt Kalender hinzu');

      const userPrompt = mockAiModelService.completePrompt.mock.calls[0][1];
      expect(userPrompt).toContain('graph TD; A-->B; B-->D');
      expect(userPrompt).toContain('Füge nach Notizen einen Schritt Kalender hinzu');
      expect(lastAssistant(provider).actions?.map((a) => [a.label, a.actionType])).toEqual([
        ['Übernehmen', 'applyDiagram'],
        ['Code kopieren', 'copyDiagramCode'],
      ]);
    });

    it('applies a proposal, reports it and continues from the applied code', async () => {
      const { provider, applier } = await setup();
      mockAiModelService.completePrompt.mockResolvedValue('Ok.\n```mermaid\ngraph TD; A-->C\n```');
      await provider.processUserMessage('C statt B');
      const proposalId = lastAssistant(provider).actions![0].proposalId;

      await provider.handleMessage({ type: 'applyDiagram', proposalId });
      expect(applier.replaceMermaidCode).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: noteUri.fsPath }),
        'graph TD; A-->B',
        'graph TD; A-->C',
        5
      );
      expect(lastAssistant(provider).text).toBe('Diagramm übernommen.');
      expect(provider.getDiagramContext()?.code).toBe('graph TD; A-->C');

      noteText = diagram('graph TD; A-->C');
      mockAiModelService.completePrompt.mockClear();
      await provider.processUserMessage('Und jetzt von oben nach unten');
      expect(mockAiModelService.completePrompt.mock.calls[0][1]).toContain('graph TD; A-->C');
    });

    it('reports why a proposal was not applied', async () => {
      const { provider, applier } = await setup();
      mockAiModelService.completePrompt.mockResolvedValue('```mermaid\ngraph TD; A-->C\n```');
      await provider.processUserMessage('C statt B');
      applier.replaceMermaidCode.mockResolvedValue('changed' as any);

      await provider.handleMessage({ type: 'applyDiagram', proposalId: lastAssistant(provider).actions![0].proposalId });
      expect(lastAssistant(provider).text).toBe('Das Diagramm wurde inzwischen geändert – bitte neu anfragen.');
    });

    it('copies the proposed code', async () => {
      const { provider } = await setup();
      const write = vi.spyOn(vscode.env.clipboard, 'writeText').mockResolvedValue();
      mockAiModelService.completePrompt.mockResolvedValue('```mermaid\ngraph TD; A-->C\n```');
      await provider.processUserMessage('C statt B');

      await provider.handleMessage({ type: 'copyDiagramCode', proposalId: lastAssistant(provider).actions![1].proposalId });
      expect(write).toHaveBeenCalledWith('graph TD; A-->C');
    });

    it('shows answers without code without actions', async () => {
      const { provider } = await setup();
      mockAiModelService.completePrompt.mockResolvedValue('Soll der Pfeil von B oder von C ausgehen?');
      await provider.processUserMessage('Verbinde das mit Kalender');
      expect(lastAssistant(provider).actions).toBeUndefined();
    });

    it('does not call the AI model when the diagram is gone', async () => {
      const { provider } = await setup();
      noteText = '# Plan\n\nKein Diagramm mehr\n';
      mockAiModelService.completePrompt.mockClear();
      await provider.processUserMessage('Mach es bunter');
      expect(mockAiModelService.completePrompt).not.toHaveBeenCalled();
      expect(lastAssistant(provider).text).toBe('Das Diagramm wurde in der Notiz nicht mehr gefunden.');
    });

    it('answers normally after the context is removed', async () => {
      const { provider } = await setup();
      await provider.handleMessage({ type: 'clearDiagramContext' });
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({ type: 'diagramContext', context: null });
      mockAiModelService.completePrompt.mockClear();
      mockAiModelService.completePrompt.mockResolvedValue('Normale Antwort');
      await provider.processUserMessage('Was steht in meinen Notizen?');
      expect(mockAiModelService.completePrompt.mock.calls[0][0]).not.toContain('Mermaid-Diagramm');
    });
  });
});

