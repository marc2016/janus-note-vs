import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { JanusChatParticipant } from '../src/agent/chatParticipant';
import { CompanionManager } from '../src/companion/companionManager';
import { JanusSearchService } from '../src/services/janusSearchService';
import { FolderTasksService } from '../src/services/folderTasksService';
import { AiModelService } from '../src/services/aiModelService';

function createMockResponseStream() {
  const markdownChunks: string[] = [];
  const buttons: vscode.Command[] = [];
  const progressMessages: string[] = [];

  const stream = {
    markdown: vi.fn((val: string) => {
      markdownChunks.push(val);
    }),
    button: vi.fn((cmd: vscode.Command) => {
      buttons.push(cmd);
    }),
    progress: vi.fn((msg: string) => {
      progressMessages.push(msg);
    }),
  } as unknown as vscode.ChatResponseStream;

  return { stream, markdownChunks, buttons, progressMessages };
}

async function* arrayToAsyncGenerator<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

describe('JanusChatParticipant', () => {
  let companionManager: CompanionManager;
  let searchService: JanusSearchService;
  let folderTasksService: FolderTasksService;
  let aiModelService: AiModelService;

  beforeEach(() => {
    vi.restoreAllMocks();
    companionManager = new CompanionManager();
    folderTasksService = new FolderTasksService();
    searchService = new JanusSearchService(companionManager, folderTasksService);
    aiModelService = new AiModelService();
  });

  it('handles /search command, streams answer, and adds Janus Markdown Editor buttons', async () => {
    const noteUri = vscode.Uri.file('/workspace/notes/projects/budget.md');
    vi.spyOn(searchService, 'searchWorkspace').mockResolvedValue({
      query: 'Wo steht etwas zum Q3 Budget?',
      tokens: ['q3', 'budget'],
      notesRootUri: vscode.Uri.file('/workspace/notes'),
      noteMatches: [
        {
          title: 'Q3 Budget',
          relativePath: 'projects/budget.md',
          uri: noteUri,
          score: 20,
          snippet: '## Q3 Budget\n45.000 EUR freigegeben.',
          headings: ['Q3 Budget'],
        },
      ],
      taskMatches: [
        {
          id: 't1',
          title: 'Budget-Freigabe senden',
          completed: false,
          status: 'todo',
          priority: 'high',
          folder: 'projects',
          tasksUri: vscode.Uri.file('/workspace/notes/projects/tasks.json'),
          score: 6,
        },
      ],
    });

    const mockModel = {
      sendRequest: vi.fn().mockResolvedValue({
        text: arrayToAsyncGenerator(['Das Q3 Budget beträgt 45.000 EUR laut `projects/budget.md`.']),
      }),
    };

    const participant = new JanusChatParticipant(
      companionManager,
      searchService,
      folderTasksService,
      aiModelService
    );
    const { stream, markdownChunks, buttons } = createMockResponseStream();

    await participant.handleRequest(
      {
        command: 'search',
        prompt: 'Wo steht etwas zum Q3 Budget?',
        model: mockModel as any,
      } as any,
      {} as any,
      stream,
      {} as any
    );

    expect(markdownChunks.join('')).toContain('45.000 EUR');
    expect(buttons.some((b) => b.command === 'janus.openMarkdownEditor')).toBe(true);
    expect(buttons.some((b) => b.command === 'janus.openAllTasks')).toBe(true);
  });

  it('handles /help command and outputs overview of all available commands', async () => {
    const participant = new JanusChatParticipant(
      companionManager,
      searchService,
      folderTasksService,
      aiModelService
    );
    const { stream, markdownChunks, buttons } = createMockResponseStream();

    await participant.handleRequest(
      {
        command: 'help',
        prompt: '',
        model: undefined,
      } as any,
      {} as any,
      stream,
      {} as any
    );

    const output = markdownChunks.join('');
    expect(output).toContain('/search');
    expect(output).toContain('/tasks');
    expect(output).toContain('/summarize');
    expect(output).toContain('/inbox');
    expect(output).toContain('/help');
    expect(buttons.some((b) => b.command === 'janus.openSettings')).toBe(true);
  });

  it('handles /tasks command and offers task action buttons', async () => {
    vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(
      vscode.Uri.file('/workspace/notes')
    );
    vi.spyOn(folderTasksService, 'loadAllTasks').mockResolvedValue([
      {
        folder: 'projects/App-Launch',
        uri: vscode.Uri.file('/workspace/notes/projects/App-Launch/tasks.json'),
        tasks: [
          {
            id: 't1',
            title: 'Beta-Test starten',
            completed: false,
            status: 'todo',
            priority: 'high',
            createdAt: '2026-10-01T10:00:00Z',
          },
        ],
      },
    ]);

    vi.spyOn(aiModelService, 'completePrompt').mockResolvedValue(
      'Offene Aufgaben:\n- Beta-Test starten (projects/App-Launch)'
    );

    const participant = new JanusChatParticipant(
      companionManager,
      searchService,
      folderTasksService,
      aiModelService
    );
    const { stream, markdownChunks, buttons } = createMockResponseStream();

    await participant.handleRequest(
      {
        command: 'tasks',
        prompt: 'Welche Aufgaben sind noch offen?',
        model: undefined,
      } as any,
      {} as any,
      stream,
      {} as any
    );

    expect(markdownChunks.join('')).toContain('Beta-Test starten');
    expect(buttons.some((b) => b.command === 'janus.openAllTasks')).toBe(true);
  });

  it('handles /summarize command for a specified folder', async () => {
    const noteUri = vscode.Uri.file('/workspace/notes/projects/App-Launch/kickoff.md');
    vi.spyOn(searchService, 'getSummarizeContext').mockResolvedValue({
      targetType: 'folder',
      targetLabel: 'projects/App-Launch',
      targetUri: vscode.Uri.file('/workspace/notes/projects/App-Launch'),
      notes: [
        {
          title: 'kickoff',
          relativePath: 'projects/App-Launch/kickoff.md',
          uri: noteUri,
          content: '# Kickoff\nRelease am 15. November.',
        },
      ],
      tasks: [],
      tasksUri: vscode.Uri.file('/workspace/notes/projects/App-Launch/tasks.json'),
    });

    const mockModel = {
      sendRequest: vi.fn().mockResolvedValue({
        text: arrayToAsyncGenerator(['**Zusammenfassung:** Release am 15. November.']),
      }),
    };

    const participant = new JanusChatParticipant(
      companionManager,
      searchService,
      folderTasksService,
      aiModelService
    );
    const { stream, markdownChunks, buttons } = createMockResponseStream();

    await participant.handleRequest(
      {
        command: 'summarize',
        prompt: 'projects/App-Launch',
        model: mockModel as any,
      } as any,
      {} as any,
      stream,
      {} as any
    );

    expect(markdownChunks.join('')).toContain('Release am 15. November');
    expect(buttons.some((b) => b.command === 'janus.openMarkdownEditor')).toBe(true);
    expect(buttons.some((b) => b.command === 'janus.openFolderTasks')).toBe(true);
  });

  it('handles /inbox command and renders button to sort inbox via AI', async () => {
    const inboxUri = vscode.Uri.file('/workspace/notes/inbox.md');
    vi.spyOn(searchService, 'getInboxContext').mockResolvedValue({
      inboxUri,
      exists: true,
      isEmpty: false,
      rawContent: '# Inbox\n\nMeeting-Notiz zu Projekt Alpha',
      meaningfulContent: 'Meeting-Notiz zu Projekt Alpha',
    });

    const mockModel = {
      sendRequest: vi.fn().mockResolvedValue({
        text: arrayToAsyncGenerator(['In deiner Inbox befindet sich 1 Eintrag zu Projekt Alpha.']),
      }),
    };

    const participant = new JanusChatParticipant(
      companionManager,
      searchService,
      folderTasksService,
      aiModelService
    );
    const { stream, markdownChunks, buttons } = createMockResponseStream();

    await participant.handleRequest(
      {
        command: 'inbox',
        prompt: '',
        model: mockModel as any,
      } as any,
      {} as any,
      stream,
      {} as any
    );

    expect(markdownChunks.join('')).toContain('Projekt Alpha');
    expect(buttons.some((b) => b.command === 'janus.sortInbox')).toBe(true);
    expect(buttons.some((b) => b.command === 'janus.openMarkdownEditor')).toBe(true);
  });

  it('executes multi-turn LanguageModelToolCallPart loop in free-form chat', async () => {
    vi.spyOn(searchService, 'searchWorkspace').mockResolvedValue({
      query: 'Server Architektur',
      tokens: ['server', 'architektur'],
      notesRootUri: vscode.Uri.file('/workspace/notes'),
      noteMatches: [
        {
          title: 'Architektur',
          relativePath: 'knowledge/architektur.md',
          uri: vscode.Uri.file('/workspace/notes/knowledge/architektur.md'),
          score: 15,
          snippet: 'Wir nutzen Node.js und SQLite.',
          headings: ['Architektur'],
        },
      ],
      taskMatches: [],
    });

    let callCount = 0;
    const mockModel = {
      sendRequest: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            stream: arrayToAsyncGenerator([
              new vscode.LanguageModelToolCallPart('call-1', 'janus_search_notes', {
                query: 'Server Architektur',
              }),
            ]),
          };
        }
        return {
          stream: arrayToAsyncGenerator([
            new vscode.LanguageModelTextPart(
              'Laut `knowledge/architektur.md` nutzt ihr Node.js und SQLite.'
            ),
          ]),
        };
      }),
    };

    const participant = new JanusChatParticipant(
      companionManager,
      searchService,
      folderTasksService,
      aiModelService
    );
    const { stream, markdownChunks } = createMockResponseStream();

    await participant.handleRequest(
      {
        command: undefined,
        prompt: 'Was steht in meinen Notizen zur Server Architektur?',
        model: mockModel as any,
      } as any,
      {} as any,
      stream,
      {} as any
    );

    expect(mockModel.sendRequest).toHaveBeenCalledTimes(2);
    expect(searchService.searchWorkspace).toHaveBeenCalledWith('Server Architektur', {
      maxNotes: 8,
      maxTasks: 10,
    });
    expect(markdownChunks.join('')).toContain('Node.js und SQLite');
  });
});

