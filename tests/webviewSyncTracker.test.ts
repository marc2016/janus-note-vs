import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { WebviewSyncTracker } from '../src/editors/webviewSyncTracker';
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
