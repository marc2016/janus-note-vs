import { describe, it, expect, vi, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import { TasksEditorProvider } from '../src/editors/tasksEditorProvider';

function setup(isDirty: boolean) {
  const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
  const document = {
    uri: vscode.Uri.file('/workspace/notes/projects/plan.md'),
    isDirty,
    getText: () => '- [ ] Angebot ^t-7f3a9k',
    save: vi.fn(async () => true),
  } as any;
  const panel = { webview: { postMessage: vi.fn() } } as any;
  const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
  return { provider, document, panel, exec };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('clicking the marker of a linked task line', () => {
  it('opens the task list of the note folder', async () => {
    const { provider, document, panel, exec } = setup(false);
    vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
    await provider.receiveWebviewMessage({ type: 'openLinkedTask', taskId: 't-7f3a9k' }, document, panel);
    expect(document.save).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith(
      'vscode.openWith',
      expect.objectContaining({ fsPath: '/workspace/notes/projects/tasks.json' }),
      TasksEditorProvider.viewType
    );
  });

  it('asks the task list to highlight the clicked task', async () => {
    const { provider, document, panel } = setup(false);
    vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
    const highlight = vi.spyOn(TasksEditorProvider, 'highlightTask');
    await provider.receiveWebviewMessage({ type: 'openLinkedTask', taskId: 't-7f3a9k' }, document, panel);
    expect(highlight).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/workspace/notes/projects/tasks.json' }),
      't-7f3a9k'
    );
  });

  it('saves an unsaved note first so the task exists', async () => {
    const { provider, document, panel, exec } = setup(true);
    vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
    await provider.receiveWebviewMessage({ type: 'openLinkedTask', taskId: 't-7f3a9k' }, document, panel);
    expect(document.save).toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith('vscode.openWith', expect.anything(), TasksEditorProvider.viewType);
  });

  it('shows a hint instead of opening when no task list exists after saving', async () => {
    vi.useFakeTimers();
    const { provider, document, panel, exec } = setup(false);
    vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('missing'));
    const info = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);
    const done = provider.receiveWebviewMessage({ type: 'openLinkedTask', taskId: 't-7f3a9k' }, document, panel);
    await vi.advanceTimersByTimeAsync(3000);
    await done;
    expect(exec).not.toHaveBeenCalledWith('vscode.openWith', expect.anything(), expect.anything());
    expect(info).toHaveBeenCalled();
  });
});
