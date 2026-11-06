import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { WebviewSyncTracker, toDocumentText, toWebviewText } from '../src/editors/webviewSyncTracker';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';

describe('WebviewSyncTracker', () => {
  it('swallows the echo of the webview edit exactly once', () => {
    const tracker = new WebviewSyncTracker();
    tracker.recordWebviewEdit('abc', 1);
    expect(tracker.shouldForward('abc')).toBe(false);
    // A later genuine change that yields the same text (e.g. undo then redo) is forwarded
    expect(tracker.shouldForward('abc')).toBe(true);
  });

  it('forwards external changes that differ from the webview edit', () => {
    const tracker = new WebviewSyncTracker();
    tracker.recordWebviewEdit('abc', 1);
    expect(tracker.shouldForward('abcX')).toBe(true);
  });

  it('recognizes the echo of a CRLF document as the webview edit', () => {
    const tracker = new WebviewSyncTracker();
    tracker.recordWebviewEdit('a\nb', 1);
    expect(tracker.shouldForward('a\r\nb')).toBe(false);
    expect(tracker.shouldForward('a\r\nb')).toBe(true);
  });

  it('tracks the highest applied seq', () => {
    const tracker = new WebviewSyncTracker();
    tracker.recordWebviewEdit('a', 3);
    tracker.acknowledgeSeq(2);
    expect(tracker.lastAppliedSeq).toBe(3);
    tracker.acknowledgeSeq(undefined);
    expect(tracker.lastAppliedSeq).toBe(3);
  });
});

describe('MarkdownEditorProvider content sync', () => {
  it('acknowledges the seq of updateContent and applies the edit', async () => {
    const provider = new MarkdownEditorProvider({ subscriptions: [] } as any);
    let text = 'old';
    const document: any = {
      uri: vscode.Uri.file('/notes/a.md'),
      getText: () => text,
      positionAt: (o: number) => new vscode.Position(0, o),
    };
    const panel: any = { webview: { postMessage: vi.fn() } };
    vi.spyOn(vscode.workspace, 'applyEdit').mockImplementation(async () => {
      text = 'new';
      return true;
    });

    await provider.handleWebviewMessage({ type: 'updateContent', content: 'new', seq: 4 }, document, panel);

    const tracker = (provider as any).getSyncTracker(panel) as WebviewSyncTracker;
    expect(tracker.lastAppliedSeq).toBe(4);
    expect(tracker.shouldForward('new')).toBe(false);
  });

  it('acknowledges the seq even when the content is unchanged', async () => {
    const provider = new MarkdownEditorProvider({ subscriptions: [] } as any);
    const document: any = { uri: vscode.Uri.file('/notes/a.md'), getText: () => 'same' };
    const panel: any = { webview: { postMessage: vi.fn() } };
    const applySpy = vi.spyOn(vscode.workspace, 'applyEdit');

    await provider.handleWebviewMessage({ type: 'updateContent', content: 'same', seq: 7 }, document, panel);

    expect(applySpy).not.toHaveBeenCalled();
    expect(((provider as any).getSyncTracker(panel) as WebviewSyncTracker).lastAppliedSeq).toBe(7);
  });
});

describe('line ending normalization', () => {
  it('converts document text to webview text and back', () => {
    expect(toWebviewText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
    expect(toDocumentText('a\nb', vscode.EndOfLine.CRLF)).toBe('a\r\nb');
    expect(toDocumentText('a\nb', vscode.EndOfLine.LF)).toBe('a\nb');
    expect(toDocumentText('a\nb', undefined)).toBe('a\nb');
  });
});

describe('MarkdownEditorProvider with a CRLF document', () => {
  function setup(initial: string) {
    let onChange: ((e: any) => void) | undefined;
    vi.spyOn(vscode.workspace, 'onDidChangeTextDocument').mockImplementation(((h: any) => {
      onChange = h;
      return { dispose: () => {} };
    }) as any);
    vi.spyOn(vscode.workspace, 'onDidSaveTextDocument').mockImplementation((() => ({ dispose: () => {} })) as any);
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    let text = initial;
    const document: any = {
      uri: vscode.Uri.file('/workspace/plan.md'),
      eol: vscode.EndOfLine.CRLF,
      isDirty: false,
      getText: () => text,
      positionAt: (n: number) => new vscode.Position(0, n),
    };
    const applied: string[] = [];
    vi.spyOn(vscode.workspace, 'applyEdit').mockImplementation(async (edit: any) => {
      text = edit.entries[0].newText;
      applied.push(text);
      onChange?.({ document });
      return true;
    });
    const panel: any = {
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
    };
    return { provider, document, panel, applied, fire: () => onChange?.({ document }), getText: () => text };
  }

  it('sends the document to the webview with \\n line breaks', async () => {
    const { provider, document, panel } = setup('# A\r\n\r\nB');
    await provider.resolveCustomTextEditor(document, panel, {} as any);
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'init', content: '# A\n\nB' })
    );
    expect(panel.webview.html).toContain('# A\\n\\nB');
    expect(panel.webview.html).not.toContain('\\r');
  });

  it('applies webview edits with the document line endings and does not echo them back', async () => {
    const { provider, document, panel, applied } = setup('# A\r\n\r\nB\r\nC');
    await provider.resolveCustomTextEditor(document, panel, {} as any);
    panel.webview.postMessage.mockClear();

    // The user deleted the line "B" in the webview
    await provider.handleWebviewMessage({ type: 'updateContent', content: '# A\n\nC', seq: 1 }, document, panel);

    expect(applied).toEqual(['# A\r\n\r\nC']);
    const updates = panel.webview.postMessage.mock.calls.map((c: any[]) => c[0]).filter((m: any) => m.type === 'update');
    expect(updates).toEqual([]);
  });

  it('treats unchanged content as applied regardless of line endings', async () => {
    const { provider, document, panel, applied } = setup('# A\r\nB');
    await provider.resolveCustomTextEditor(document, panel, {} as any);
    await provider.handleWebviewMessage({ type: 'updateContent', content: '# A\nB', seq: 3 }, document, panel);
    expect(applied).toEqual([]);
    expect(((provider as any).getSyncTracker(panel) as WebviewSyncTracker).lastAppliedSeq).toBe(3);
  });

  it('forwards external changes with \\n line breaks', async () => {
    const { provider, document, panel, fire } = setup('# A\r\nB');
    await provider.resolveCustomTextEditor(document, panel, {} as any);
    panel.webview.postMessage.mockClear();
    document.getText = () => '# A\r\nB\r\nX';
    fire();
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'update', content: '# A\nB\nX', ackSeq: 0 });
  });
});
