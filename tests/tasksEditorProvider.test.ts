import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { TasksEditorProvider } from '../src/editors/tasksEditorProvider';

describe('TasksEditorProvider', () => {
  it('applies updateTasks edits and saves the document to disk', async () => {
    const provider = new TasksEditorProvider({
      extensionUri: vscode.Uri.file('/extension'),
      subscriptions: [],
    } as unknown as vscode.ExtensionContext);

    const text = JSON.stringify({ version: 1, title: 'Aufgaben', tasks: [] });
    const save = vi.fn(async () => true);
    const document: any = {
      uri: vscode.Uri.file('/workspace/notes/projects/tasks.json'),
      getText: () => text,
      positionAt: (offset: number) => new vscode.Position(0, offset),
      save,
    };

    let onMessage: ((message: any) => Promise<void>) | undefined;
    const panel: any = {
      active: false,
      webview: {
        options: {},
        html: '',
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: 'vscode-resource:',
        postMessage: vi.fn(),
        onDidReceiveMessage: (handler: any) => {
          onMessage = handler;
          return { dispose: () => {} };
        },
      },
      onDidChangeViewState: () => ({ dispose: () => {} }),
      onDidDispose: () => ({ dispose: () => {} }),
    };

    const applyEditSpy = vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);

    await provider.resolveCustomTextEditor(document, panel, {} as vscode.CancellationToken);
    await onMessage!({
      type: 'updateTasks',
      tasks: [
        {
          id: 't1',
          title: 'Bericht schreiben',
          completed: false,
          status: 'todo',
          dueDate: '2026-11-03',
          scheduledDate: '2026-10-30',
        },
      ],
    });

    expect(applyEditSpy).toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  describe('highlighting a task', () => {
    function open(uriPath: string) {
      const provider = new TasksEditorProvider({ extensionUri: vscode.Uri.file('/extension'), subscriptions: [] } as any);
      const document: any = {
        uri: vscode.Uri.file(uriPath),
        getText: () => JSON.stringify({ version: 1, title: 'Aufgaben', tasks: [] }),
      };
      let onMessage: ((message: any) => Promise<void>) | undefined;
      const panel: any = {
        active: false,
        webview: {
          options: {},
          html: '',
          asWebviewUri: (uri: vscode.Uri) => uri,
          cspSource: 'vscode-resource:',
          postMessage: vi.fn(),
          onDidReceiveMessage: (handler: any) => {
            onMessage = handler;
            return { dispose: () => {} };
          },
        },
        onDidChangeViewState: () => ({ dispose: () => {} }),
        onDidDispose: () => ({ dispose: () => {} }),
      };
      return { provider, document, panel, ready: () => onMessage!({ type: 'ready' }) };
    }

    it('delivers a highlight requested before the list is ready once it reports ready', async () => {
      const { provider, document, panel, ready } = open('/workspace/notes/a/tasks.json');
      await provider.resolveCustomTextEditor(document, panel, {} as vscode.CancellationToken);
      TasksEditorProvider.highlightTask(document.uri, 't-7f3a9k');
      expect(panel.webview.postMessage).not.toHaveBeenCalledWith({ type: 'highlightTask', taskId: 't-7f3a9k' });
      await ready();
      expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'highlightTask', taskId: 't-7f3a9k' });
    });

    it('highlights immediately in a list that is already open and ready', async () => {
      const { provider, document, panel, ready } = open('/workspace/notes/b/tasks.json');
      await provider.resolveCustomTextEditor(document, panel, {} as vscode.CancellationToken);
      await ready();
      TasksEditorProvider.highlightTask(document.uri, 't-abcdef');
      expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: 'highlightTask', taskId: 't-abcdef' });
    });
  });
});

