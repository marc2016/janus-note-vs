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
});
