import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { NoteGraphViewProvider } from '../src/editors/noteGraphViewProvider';
import { CompanionManager } from '../src/companion/companionManager';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import * as notesRootCommands from '../src/commands/notesRootCommands';
import * as noteGraphService from '../src/services/noteGraphService';

describe('NoteGraphViewProvider', () => {
  const notesRoot = vscode.Uri.file('/workspace/notes');
  const mockContext = { extensionUri: vscode.Uri.file('/extension') } as unknown as vscode.ExtensionContext;

  let provider: NoteGraphViewProvider;
  let buildSpy: ReturnType<typeof vi.fn>;
  let watcherHandlers: { change?: (uri: vscode.Uri) => void };
  let disposePanel: (() => void) | undefined;
  let postMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();

    const companionManager = new CompanionManager();
    vi.spyOn(companionManager, 'getAllNotesRoots').mockReturnValue([notesRoot]);
    vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(notesRoot);
    vi.spyOn(notesRootCommands, 'checkNotesRootStatus').mockResolvedValue({
      isInitialized: true,
      hasNonNoteFiles: false,
      hasLinkedFolders: false,
      notesRootUri: notesRoot,
      includedFolderUris: [],
    });
    buildSpy = vi.fn().mockResolvedValue({ nodes: [], edges: [] });
    vi.spyOn(noteGraphService, 'buildNoteGraph').mockImplementation(buildSpy as any);

    watcherHandlers = {};
    vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockReturnValue({
      onDidCreate: () => ({ dispose: () => {} }),
      onDidChange: (handler: (uri: vscode.Uri) => void) => {
        watcherHandlers.change = handler;
        return { dispose: () => {} };
      },
      onDidDelete: () => ({ dispose: () => {} }),
      dispose: () => {},
    } as any);

    postMessage = vi.fn().mockResolvedValue(true);
    disposePanel = undefined;
    vi.spyOn(vscode.window, 'createWebviewPanel').mockImplementation(
      (_viewType: string, title: string) =>
        ({
          title,
          webview: {
            html: '',
            asWebviewUri: (uri: vscode.Uri) => uri,
            postMessage,
            onDidReceiveMessage: () => ({ dispose: () => {} }),
          },
          reveal: vi.fn(),
          onDidDispose: (listener: () => void) => {
            disposePanel = listener;
            return { dispose: () => {} };
          },
          dispose: () => {},
        }) as any
    );

    provider = new NoteGraphViewProvider(mockContext, companionManager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates one panel and reveals it on repeated open', async () => {
    const createSpy = vi.mocked(vscode.window.createWebviewPanel);

    await provider.open();
    await provider.open();

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith('janus.noteGraph', 'Notiz-Netzwerk', vscode.ViewColumn.One, expect.any(Object));
    expect(provider.getActivePanel()!.reveal).toHaveBeenCalledTimes(1);
  });

  it('shows a message and opens no panel when the notes root is not initialized', async () => {
    vi.mocked(notesRootCommands.checkNotesRootStatus).mockResolvedValue({
      isInitialized: false,
      hasNonNoteFiles: false,
      hasLinkedFolders: false,
      includedFolderUris: [],
    });
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

    await provider.open();

    expect(infoSpy).toHaveBeenCalled();
    expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
  });

  it('posts graph data on ready and opens notes in the Janus editor', async () => {
    const executeSpy = vi.spyOn(vscode.commands, 'executeCommand');
    await provider.open();

    await provider.handleMessage({ type: 'ready' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'graphData', data: { nodes: [], edges: [] } });

    const noteUri = vscode.Uri.file('/workspace/notes/plan.md');
    await provider.handleMessage({ type: 'openNote', uri: noteUri.toString() });
    expect(executeSpy).toHaveBeenCalledWith('vscode.openWith', noteUri, MarkdownEditorProvider.viewType);
  });

  it('coalesces a burst of note changes into one rebuild and ignores files outside the roots', async () => {
    await provider.open();

    watcherHandlers.change!(vscode.Uri.file('/workspace/notes/a.md'));
    watcherHandlers.change!(vscode.Uri.file('/workspace/notes/b.md'));
    watcherHandlers.change!(vscode.Uri.file('/workspace/src/readme.md'));
    await vi.advanceTimersByTimeAsync(600);

    expect(buildSpy).toHaveBeenCalledTimes(1);

    watcherHandlers.change!(vscode.Uri.file('/workspace/src/readme.md'));
    await vi.advanceTimersByTimeAsync(600);
    expect(buildSpy).toHaveBeenCalledTimes(1);
  });

  it('stops rebuilding after the panel is closed', async () => {
    await provider.open();
    watcherHandlers.change!(vscode.Uri.file('/workspace/notes/a.md'));

    disposePanel!();
    await vi.advanceTimersByTimeAsync(600);
    watcherHandlers.change!(vscode.Uri.file('/workspace/notes/a.md'));
    await vi.advanceTimersByTimeAsync(600);

    expect(buildSpy).not.toHaveBeenCalled();
    expect(provider.getActivePanel()).toBeUndefined();
  });

  it('discards a slower, outdated build', async () => {
    await provider.open();
    let resolveSlow!: (v: any) => void;
    buildSpy
      .mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)))
      .mockResolvedValueOnce({ nodes: [{ id: 'new' }], edges: [] });

    const slow = provider.handleMessage({ type: 'ready' });
    await provider.handleMessage({ type: 'ready' });
    resolveSlow({ nodes: [{ id: 'old' }], edges: [] });
    await slow;

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: 'graphData', data: { nodes: [{ id: 'new' }], edges: [] } });
  });
});
