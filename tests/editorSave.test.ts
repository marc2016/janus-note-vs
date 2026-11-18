import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { MarkdownEditorProvider, getAutoSaveConfig } from '../src/editors/markdownEditorProvider';
import { __setConfigStore } from './__mocks__/vscode';

function setup() {
  const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
  let text = 'Alt';
  const order: string[] = [];
  const document = {
    uri: vscode.Uri.file('/workspace/plan.md'),
    isDirty: false,
    getText: () => text,
    positionAt: (n: number) => new vscode.Position(0, n),
    save: vi.fn(async () => {
      order.push(`save:${text}`);
      document.isDirty = false;
      return true;
    }),
  } as any;
  vi.spyOn(vscode.workspace, 'applyEdit').mockImplementation(async (edit: any) => {
    // Applying the edit takes a moment, like the real WorkspaceEdit
    await new Promise((r) => setTimeout(r, 20));
    text = edit.entries?.[0]?.newText ?? edit.entries?.[0]?.[2] ?? text;
    document.isDirty = true;
    order.push(`edit:${text}`);
    return true;
  });
  const panel = { webview: { postMessage: vi.fn() } } as any;
  return { provider, document, panel, order, getText: () => text };
}

describe('saving from the editor', () => {
  it('saves only after the edit sent just before has been applied', async () => {
    const { provider, document, panel, order } = setup();
    const edit = provider.receiveWebviewMessage({ type: 'updateContent', content: 'Alt Ende', seq: 1 }, document, panel);
    const save = provider.receiveWebviewMessage({ type: 'save' }, document, panel);
    await Promise.all([edit, save]);

    expect(order).toEqual(['edit:Alt Ende', 'save:Alt Ende']);
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: 'dirtyState', dirty: false });
  });

  it('reports the dirty state when the editor is ready', async () => {
    const { provider, document, panel } = setup();
    document.isDirty = true;
    await provider.handleWebviewMessage({ type: 'ready' }, document, panel, () => {}, async () => {}, async () => {});
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'dirtyState', dirty: true });
  });
});

describe('dirty state events', () => {
  it('reports changes and saves of the note, also from outside the editor', async () => {
    let onChange: ((e: any) => void) | undefined;
    let onSave: ((d: any) => void) | undefined;
    vi.spyOn(vscode.workspace, 'onDidChangeTextDocument').mockImplementation(((h: any) => {
      onChange = h;
      return { dispose: () => {} };
    }) as any);
    vi.spyOn(vscode.workspace, 'onDidSaveTextDocument').mockImplementation(((h: any) => {
      onSave = h;
      return { dispose: () => {} };
    }) as any);
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    const uri = vscode.Uri.file('/workspace/plan.md');
    const document = { uri, isDirty: false, getText: () => 'x' } as any;
    const panel = {
      webview: {
        options: {},
        html: '',
        asWebviewUri: (u: any) => u,
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      },
      onDidDispose: vi.fn(),
      onDidChangeViewState: vi.fn(() => ({ dispose: () => {} })),
      active: false,
    } as any;
    await provider.resolveCustomTextEditor(document, panel, {} as any);

    onChange!({ document: { uri, isDirty: true, getText: () => 'xy' } });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'dirtyState', dirty: true });

    onSave!({ uri, isDirty: false });
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: 'dirtyState', dirty: false });
  });
});

describe('auto-save settings', () => {
  function openEditor() {
    let onConfig: ((e: any) => void) | undefined;
    vi.spyOn(vscode.workspace, 'onDidChangeConfiguration').mockImplementation(((h: any) => {
      onConfig = h;
      return { dispose: () => {} };
    }) as any);
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    const uri = vscode.Uri.file('/workspace/plan.md');
    const document = { uri, isDirty: false, getText: () => 'x' } as any;
    const panel = {
      webview: {
        options: {},
        html: '',
        asWebviewUri: (u: any) => u,
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
      },
      onDidDispose: vi.fn(),
      onDidChangeViewState: vi.fn(() => ({ dispose: () => {} })),
      active: false,
    } as any;
    return { provider, uri, document, panel, fireConfig: (e: any) => onConfig!(e) };
  }

  it('defaults to afterDelay with 1000 ms', () => {
    __setConfigStore({});
    expect(getAutoSaveConfig(vscode.Uri.file('/workspace/plan.md'))).toEqual({ mode: 'afterDelay', delay: 1000 });
  });

  it('falls back to afterDelay for unknown values and clamps the delay', () => {
    __setConfigStore({ 'janus.autoSave': 'sometimes', 'janus.autoSaveDelay': 50 });
    expect(getAutoSaveConfig(vscode.Uri.file('/workspace/plan.md'))).toEqual({ mode: 'afterDelay', delay: 250 });
  });

  it('sends the auto-save settings with init', async () => {
    __setConfigStore({ 'janus.autoSave': 'onFocusChange', 'janus.autoSaveDelay': 2000 });
    const { provider, document, panel } = openEditor();
    await provider.resolveCustomTextEditor(document, panel, {} as any);
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'init', autoSave: { mode: 'onFocusChange', delay: 2000 } })
    );
  });

  it('pushes changed auto-save settings to the open editor', async () => {
    __setConfigStore({});
    const { provider, document, panel, fireConfig } = openEditor();
    await provider.resolveCustomTextEditor(document, panel, {} as any);

    __setConfigStore({ 'janus.autoSave': 'off' });
    fireConfig({ affectsConfiguration: (section: string) => section === 'janus.autoSave' });
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({
      type: 'autoSaveConfig',
      autoSave: { mode: 'off', delay: 1000 },
    });
  });

  it('does not push auto-save settings for unrelated configuration changes', async () => {
    __setConfigStore({});
    const { provider, document, panel, fireConfig } = openEditor();
    await provider.resolveCustomTextEditor(document, panel, {} as any);
    panel.webview.postMessage.mockClear();

    fireConfig({ affectsConfiguration: (section: string) => section === 'editor.fontSize' });
    expect(panel.webview.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'autoSaveConfig' }));
  });
});
