import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { CalendarViewProvider } from '../src/editors/calendarViewProvider';
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
});

