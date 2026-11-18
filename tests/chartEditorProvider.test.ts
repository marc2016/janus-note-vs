import { describe, it, expect, vi, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { ChartEditorProvider } from '../src/editors/chartEditorProvider';

async function openChart(save: () => Promise<boolean>) {
  const provider = new ChartEditorProvider({
    extensionUri: vscode.Uri.file('/extension'),
    subscriptions: [],
  } as unknown as vscode.ExtensionContext);

  const text = JSON.stringify({ version: 1, chartType: 'mermaid', code: 'graph TD; A-->B' });
  const document: any = {
    uri: vscode.Uri.file('/workspace/notes/plan.chart.json'),
    getText: () => text,
    positionAt: (offset: number) => new vscode.Position(0, offset),
    save: vi.fn(save),
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

  await provider.resolveCustomTextEditor(document, panel, {} as vscode.CancellationToken);
  return { document, send: (m: any) => onMessage!(m) };
}

describe('ChartEditorProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('applies chart edits and saves the document immediately', async () => {
    const applyEdit = vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
    const { document, send } = await openChart(async () => true);

    await send({ type: 'updateChart', data: { code: 'graph TD; A-->C' } });

    expect(applyEdit).toHaveBeenCalledTimes(1);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(applyEdit.mock.invocationCallOrder[0]).toBeLessThan(document.save.mock.invocationCallOrder[0]);
  });

  it('shows an error message when saving fails', async () => {
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
    const showError = vi.spyOn(vscode.window, 'showErrorMessage');
    const { send } = await openChart(async () => false);

    await send({ type: 'updateChart', data: { code: 'graph TD; A-->C' } });

    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to update chart'));
  });
});
