import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CalendarViewProvider } from '../src/editors/calendarViewProvider';
import { CalendarDayDetailsViewProvider } from '../src/editors/calendarDayDetailsViewProvider';
import { CalendarService } from '../src/services/calendarService';
import { FolderTasksService } from '../src/services/folderTasksService';

describe('CalendarViewProvider', () => {
  const notesRootUri = vscode.Uri.file('/workspace/notes');
  const mockContext = {
    extensionUri: vscode.Uri.file('/extension'),
  } as unknown as vscode.ExtensionContext;

  let calendarService: CalendarService;
  let folderTasksService: FolderTasksService;
  let mutatedCount: number;
  let provider: CalendarViewProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    folderTasksService = new FolderTasksService();
    calendarService = new CalendarService(folderTasksService);
    mutatedCount = 0;
    provider = new CalendarViewProvider(
      mockContext,
      calendarService,
      folderTasksService,
      () => {
        mutatedCount++;
      }
    );
  });

  it('opens Calendar Month View in ViewColumn.One', async () => {
    vi.spyOn(calendarService, 'loadAllCalendarEntries').mockResolvedValue([
      {
        id: 'ev-1',
        kind: 'note',
        date: '2026-10-24',
        title: 'Meeting Anna',
        notePath: 'meetings/kickoff.md',
      },
    ]);

    const panelSpy = vi.spyOn(vscode.window, 'createWebviewPanel');
    await provider.open(notesRootUri);

    expect(panelSpy).toHaveBeenCalledWith(
      'janus.calendarView',
      'Kalender (Janus Note)',
      vscode.ViewColumn.One,
      expect.any(Object)
    );
  });

  it('opens Day Details panel in ViewColumn.Beside when selecting a day', async () => {
    vi.spyOn(calendarService, 'loadAllCalendarEntries').mockResolvedValue([]);
    const panelSpy = vi.spyOn(vscode.window, 'createWebviewPanel');

    await provider.open(notesRootUri);
    await provider.openDayDetails('2026-10-24');

    expect(panelSpy).toHaveBeenCalledWith(
      'janus.calendarDayDetailsView',
      'Tagesdetails: 2026-10-24',
      expect.objectContaining({ viewColumn: vscode.ViewColumn.Beside }),
      expect.any(Object)
    );
  });

  it('opens linked markdown note in janus.markdownEditor on openNote message', async () => {
    await provider.open(notesRootUri);
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

  it('opens a journal entry at its heading line', async () => {
    await provider.open(notesRootUri);
    const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    await provider.handleMessage({ type: 'openNote', note: 'journal/2026-10-29.md', line: 6, revealLine: true });

    expect(execSpy).toHaveBeenCalledWith(
      'janus.openNoteAtLine',
      expect.objectContaining({ path: '/workspace/notes/journal/2026-10-29.md' }),
      6
    );
  });

  it('handles toggleTask message by mutating task in folder and calling onDidMutate', async () => {
    await provider.open(notesRootUri);
    const folderTasksUri = vscode.Uri.file('/workspace/notes/projects/tasks.json');

    vi.spyOn(folderTasksService, 'loadFolderTasks').mockResolvedValue([
      {
        id: 't-1',
        title: 'Pitch Deck',
        completed: false,
        status: 'todo',
        priority: 'high',
        dueDate: '2026-10-24',
      },
    ]);

    const updateSpy = vi
      .spyOn(folderTasksService, 'updateTaskInFolder')
      .mockResolvedValue(undefined);

    await provider.handleMessage({
      type: 'toggleTask',
      folderUri: folderTasksUri.toString(),
      taskId: 't-1',
      completed: true,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/workspace/notes/projects/tasks.json' }),
      expect.objectContaining({
        id: 't-1',
        completed: true,
        status: 'done',
      })
    );
    expect(mutatedCount).toBe(1);
  });

  describe('day change', () => {
    const setup = async () => {
      vi.spyOn(calendarService, 'loadAllCalendarEntries').mockResolvedValue([]);
      const dayDetails = new CalendarDayDetailsViewProvider(mockContext, calendarService, folderTasksService);
      const withDetails = new CalendarViewProvider(
        mockContext,
        calendarService,
        folderTasksService,
        undefined,
        dayDetails
      );
      const panelSpy = vi.spyOn(vscode.window, 'createWebviewPanel');
      await withDetails.open(notesRootUri);
      const panel = panelSpy.mock.results[panelSpy.mock.results.length - 1].value as vscode.WebviewPanel;
      const postSpy = vi.spyOn(panel.webview, 'postMessage');
      return { dayDetails, withDetails, postSpy };
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 12, 9, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('moves a selection that was today to the new day', async () => {
      const { dayDetails, withDetails, postSpy } = await setup();
      expect(dayDetails.getSelectedDate()).toBe('2026-11-12');

      vi.setSystemTime(new Date(2026, 10, 13, 8, 0));
      await withDetails.checkDayChange();

      expect(dayDetails.getSelectedDate()).toBe('2026-11-13');
      expect(postSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'updateEvents',
          today: '2026-11-13',
          previousToday: '2026-11-12',
          selectedDate: '2026-11-13',
        })
      );
    });

    it('keeps a deliberately selected day and only moves today', async () => {
      const { dayDetails, withDetails, postSpy } = await setup();
      await withDetails.handleMessage({ type: 'selectDay', date: '2026-11-20' });

      vi.setSystemTime(new Date(2026, 10, 13, 8, 0));
      await withDetails.checkDayChange();

      expect(dayDetails.getSelectedDate()).toBe('2026-11-20');
      const last = postSpy.mock.calls[postSpy.mock.calls.length - 1][0];
      expect(last).toMatchObject({ today: '2026-11-13', selectedDate: '2026-11-20' });
      expect(last.previousToday).toBeUndefined();
    });

    it('does nothing while the day is unchanged', async () => {
      const { withDetails, postSpy } = await setup();
      vi.setSystemTime(new Date(2026, 10, 12, 23, 59));
      await withDetails.checkDayChange();
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('keeps the selected day across refreshes', async () => {
      const { withDetails, postSpy } = await setup();
      await withDetails.handleMessage({ type: 'selectDay', date: '2026-11-20' });
      await withDetails.refresh();
      expect(postSpy).toHaveBeenLastCalledWith(expect.objectContaining({ selectedDate: '2026-11-20' }));
    });
  });
});

