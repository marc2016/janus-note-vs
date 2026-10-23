import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { ExportCompendiumViewProvider } from '../src/editors/exportCompendiumViewProvider';

describe('ExportCompendiumViewProvider', () => {
  let mockContext: any;
  let mockPdfExportService: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockContext = {
      extensionUri: vscode.Uri.file('/extension'),
      subscriptions: [],
    };
    mockPdfExportService = {
      exportCompendiumToPdf: vi.fn().mockResolvedValue('/out/compendium.pdf'),
    };
  });

  it('shows warning when opening with zero notes', async () => {
    const showWarningSpy = vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as any);
    const provider = new ExportCompendiumViewProvider(mockContext, mockPdfExportService);

    await provider.open('Empty Folder', []);
    expect(showWarningSpy).toHaveBeenCalledWith('Keine Notizen zum Exportieren ausgewählt.');
  });

  it('creates a webview panel and sends init data when notes are provided', async () => {
    let createdPanel: any = null;
    vi.spyOn(vscode.window, 'createWebviewPanel').mockImplementation((...args: any[]) => {
      createdPanel = {
        title: args[1],
        webview: {
          asWebviewUri: (uri: any) => uri,
          postMessage: vi.fn(),
          onDidReceiveMessage: vi.fn(),
        },
        iconPath: null,
        onDidDispose: vi.fn(),
        reveal: vi.fn(),
        dispose: vi.fn(),
      };
      return createdPanel;
    });

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
      return Buffer.from('# Custom Note Title\nBody', 'utf-8');
    });

    const provider = new ExportCompendiumViewProvider(mockContext, mockPdfExportService);
    const note1 = vscode.Uri.file('/workspace/notes/test1.md');

    await provider.open('My Project', [note1], vscode.Uri.file('/workspace/notes'));

    expect(createdPanel).not.toBeNull();
    expect(createdPanel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        data: expect.objectContaining({
          title: 'My Project',
          includeToc: true,
          notes: expect.arrayContaining([
            expect.objectContaining({
              title: 'Custom Note Title',
            }),
          ]),
        }),
      })
    );
  });

  it('handles cancel message by disposing the panel', async () => {
    let createdPanel: any = null;
    vi.spyOn(vscode.window, 'createWebviewPanel').mockImplementation((...args: any[]) => {
      createdPanel = {
        title: args[1],
        webview: {
          asWebviewUri: (uri: any) => uri,
          postMessage: vi.fn(),
          onDidReceiveMessage: vi.fn(),
        },
        onDidDispose: vi.fn(),
        dispose: vi.fn(),
      };
      return createdPanel;
    });

    const provider = new ExportCompendiumViewProvider(mockContext, mockPdfExportService);
    await provider.open('Test', [vscode.Uri.file('/notes/test.md')]);

    await provider.handleMessage({ type: 'cancel' });
    expect(createdPanel.dispose).toHaveBeenCalled();
  });
});

