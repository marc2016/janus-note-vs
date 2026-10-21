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
});

