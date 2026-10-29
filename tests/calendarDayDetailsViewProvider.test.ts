import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CalendarDayDetailsViewProvider } from '../src/editors/calendarDayDetailsViewProvider';
import { CalendarService } from '../src/services/calendarService';
import { FolderTasksService } from '../src/services/folderTasksService';

describe('CalendarDayDetailsViewProvider', () => {
  const notesRootUri = vscode.Uri.file('/workspace/notes');
  const mockContext = {
    extensionUri: vscode.Uri.file('/extension'),
  } as unknown as vscode.ExtensionContext;

  let calendarService: CalendarService;
  let folderTasksService: FolderTasksService;
  let mutatedCount: number;
  let provider: CalendarDayDetailsViewProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    folderTasksService = new FolderTasksService();
    calendarService = new CalendarService(folderTasksService);
    mutatedCount = 0;
    provider = new CalendarDayDetailsViewProvider(
      mockContext,
      calendarService,
      folderTasksService,
      () => {
        mutatedCount++;
      }
    );
  });

  it('resolves webview view with initial day-details html and handles ready message', async () => {
    const postMessageSpy = vi.fn();
    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        asWebviewUri: (uri: vscode.Uri) => uri,
        postMessage: postMessageSpy,
        onDidReceiveMessage: vi.fn(),
      },
      show: vi.fn(),
      onDidDispose: vi.fn(),
    } as unknown as vscode.WebviewView;

    provider.setNotesRootUri(notesRootUri);
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    expect(mockWebviewView.webview.html).toContain('initial-data');
    expect(mockWebviewView.webview.html).toContain('day-details');
  });

  it('updates selectedDate and reveals sidebar view when setSelectedDate is called', async () => {
    const showSpy = vi.fn();
    const postMessageSpy = vi.fn();
    const mockWebviewView = {
      title: '',
      webview: {
        options: {},
        html: '',
        asWebviewUri: (uri: vscode.Uri) => uri,
        postMessage: postMessageSpy,
        onDidReceiveMessage: vi.fn(),
      },
      show: showSpy,
      onDidDispose: vi.fn(),
    } as unknown as vscode.WebviewView;

    provider.setNotesRootUri(notesRootUri);
    await provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    await provider.setSelectedDate('2026-10-24', true);
    expect(showSpy).toHaveBeenCalledWith(true);
    expect(mockWebviewView.title).toBe('Tagesdetails: 2026-10-24');
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'updateDayDetails',
        date: '2026-10-24',
      })
    );
  });

  describe('daily note action', () => {
    const makeView = (postMessage: ReturnType<typeof vi.fn>) =>
      ({
        title: '',
        webview: {
          options: {},
          html: '',
          asWebviewUri: (uri: vscode.Uri) => uri,
          postMessage,
          onDidReceiveMessage: vi.fn(),
        },
        show: vi.fn(),
        onDidDispose: vi.fn(),
      }) as unknown as vscode.WebviewView;

    beforeEach(() => {
      vi.spyOn(calendarService, 'loadAllCalendarEntries').mockResolvedValue([]);
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockRejectedValue(new Error('Not found'));
    });

    it('creates the daily note of the selected day and then offers to open it', async () => {
      const existing = new Set<string>();
      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: any) => {
        if (!existing.has(uri.fsPath)) throw new Error('Not found');
        return {} as any;
      });
      vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();
      const write = vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(async (uri: any) => {
        existing.add(uri.fsPath);
      });
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
      const postMessage = vi.fn();

      provider.setNotesRootUri(notesRootUri);
      await provider.resolveWebviewView(makeView(postMessage), {} as any, {} as any);
      await provider.setSelectedDate('2026-11-02', false);
      expect(postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ dailyNote: { date: '2026-11-02', exists: false } })
      );

      await provider.handleMessage({ type: 'openDailyNote', date: '2026-11-02' });

      const notePath = '/workspace/notes/journal/2026-11-02.md';
      expect(write).toHaveBeenCalledWith(expect.objectContaining({ fsPath: notePath }), expect.anything());
      expect(execSpy).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.objectContaining({ fsPath: notePath }),
        'janus.markdownEditor'
      );
      expect(postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ dailyNote: { date: '2026-11-02', exists: true } })
      );
    });

    it('opens an existing daily note unchanged', async () => {
      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
      const write = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      provider.setNotesRootUri(notesRootUri);
      await provider.handleMessage({ type: 'openDailyNote', date: '2026-10-29' });

      expect(write).not.toHaveBeenCalled();
      expect(execSpy).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.objectContaining({ fsPath: '/workspace/notes/journal/2026-10-29.md' }),
        'janus.markdownEditor'
      );
    });
  });

  it('handles openNote message from sidebar view', async () => {
    provider.setNotesRootUri(notesRootUri);
    const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    await provider.handleMessage({
      type: 'openNote',
      note: 'meetings/kickoff.md',
    });

    expect(execSpy).toHaveBeenCalledWith(
      'vscode.openWith',
      expect.objectContaining({ path: '/workspace/notes/meetings/kickoff.md' }),
      'janus.markdownEditor'
    );
  });

  it('toggles a scheduled task entry in the folder tasks.json and keeps its dates', async () => {
    provider.setNotesRootUri(notesRootUri);
    const folderTasksUri = vscode.Uri.file('/workspace/notes/projects/tasks.json');
    const task = {
      id: 't1',
      title: 'Bericht schreiben',
      completed: false,
      status: 'todo' as const,
      priority: 'medium' as const,
      scheduledDate: '2026-10-30',
      dueDate: '2026-11-03',
      createdAt: '2026-10-01T00:00:00.000Z',
    };
    vi.spyOn(folderTasksService, 'loadAllTasks').mockResolvedValue([
      { folder: 'projects', uri: folderTasksUri, tasks: [task] },
    ]);
    vi.spyOn(folderTasksService, 'loadFolderTasks').mockResolvedValue([task]);
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
    const updateSpy = vi.spyOn(folderTasksService, 'updateTaskInFolder').mockResolvedValue(undefined);

    const entries = await calendarService.loadAllCalendarEntries(notesRootUri);
    const scheduled = entries.find((e) => e.dateKind === 'scheduled')!;
    expect(scheduled.date).toBe('2026-10-30');

    await provider.handleMessage({
      type: 'toggleTask',
      folderUri: scheduled.folderUri,
      taskId: scheduled.taskId,
      completed: true,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/workspace/notes/projects/tasks.json' }),
      expect.objectContaining({
        id: 't1',
        completed: true,
        status: 'done',
        scheduledDate: '2026-10-30',
        dueDate: '2026-11-03',
      })
    );
    expect(mutatedCount).toBe(1);
  });
});
