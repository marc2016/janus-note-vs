import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { EditorState } from '@codemirror/state';
import { livePreview } from '../src/webviews/markdown/extensions/livePreview';
import { mermaidBlockAt, mermaidDiagrams } from '../src/webviews/markdown/extensions/mermaidBlocks';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';

const doc = '# Plan\n\nText\n\n```mermaid\ngraph TD; A-->B\n```\n';
const blockFrom = doc.indexOf('```mermaid');
const renderer = { render: vi.fn(async () => '<svg/>'), validate: vi.fn(async () => {}) };

describe('KI button on mermaid diagrams', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('resolves the block for a widget at the block start or right after its end', () => {
    const state = EditorState.create({ doc, extensions: [livePreview('auto'), mermaidDiagrams(renderer, { onAiEdit: vi.fn() })] });
    const blockTo = doc.indexOf('```\n', blockFrom + 3) + 3;
    expect(mermaidBlockAt(state, blockFrom)?.from).toBe(blockFrom);
    expect(mermaidBlockAt(state, blockTo + 1)?.from).toBe(blockFrom);
    expect(mermaidBlockAt(state, 0)).toBeUndefined();
  });

  it('opens the chat with the diagram as context', async () => {
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    const document = { uri: vscode.Uri.file('/workspace/project-plan.md'), getText: () => doc } as any;

    await provider.handleWebviewMessage({ type: 'editDiagramWithAi', blockFrom }, document, { webview: { postMessage: vi.fn() } } as any);

    expect(exec).toHaveBeenCalledWith('janus.editDiagramWithAi', {
      noteUri: document.uri.toString(),
      code: 'graph TD; A-->B',
      line: 5,
    });
  });
});

import { TransactionSpec } from '@codemirror/state';
import { applyMermaidReplacement } from '../src/webviews/markdown/extensions/mermaidBlocks';

function fakeView(text: string) {
  const view = {
    state: EditorState.create({ doc: text, extensions: [livePreview('auto'), mermaidDiagrams(renderer)] }),
    dispatch(spec: TransactionSpec) {
      view.state = view.state.update(spec).state;
    },
  };
  return view;
}

describe('applying a diagram proposal in the editor', () => {
  const codeFrom = doc.indexOf('graph');
  const codeTo = codeFrom + 'graph TD; A-->B'.length;
  const request = { codeFrom, codeTo, baseCode: 'graph TD; A-->B', newCode: 'graph TD; A-->B-->C' };

  it('replaces the code in one change', async () => {
    const view = fakeView(doc);
    expect(await applyMermaidReplacement(view, request, renderer)).toBe('ok');
    expect(view.state.doc.toString()).toBe(doc.replace('A-->B', 'A-->B-->C'));
  });

  it('finds the block when text above it was added', async () => {
    const view = fakeView(`Neu\n${doc}`);
    expect(await applyMermaidReplacement(view, request, renderer)).toBe('ok');
    expect(view.state.doc.toString()).toContain('A-->B-->C');
  });

  it('does not overwrite a block that changed', async () => {
    const changed = doc.replace('A-->B', 'A-->X');
    const view = fakeView(changed);
    expect(await applyMermaidReplacement(view, request, renderer)).toBe('changed');
    expect(view.state.doc.toString()).toBe(changed);
  });

  it('does not insert invalid Mermaid', async () => {
    const view = fakeView(doc);
    const invalid = { validate: vi.fn(async () => { throw new Error('Parse error'); }) };
    expect(await applyMermaidReplacement(view, request, invalid)).toBe('invalid');
    expect(view.state.doc.toString()).toBe(doc);
  });

  it('reports a missing diagram', async () => {
    const view = fakeView('# Plan\n\nKein Diagramm\n');
    expect(await applyMermaidReplacement(view, request, renderer)).toBe('missing');
  });
});

describe('MarkdownEditorProvider.replaceMermaidCode', () => {
  const uri = vscode.Uri.file('/workspace/project-plan.md');

  const setup = (text: string) => {
    vi.restoreAllMocks();
    (vscode.workspace as any).openTextDocument = vi.fn(async () => ({ uri, getText: () => text }));
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    const panel = { webview: { postMessage: vi.fn() } } as any;
    (provider as any)._activePanels.set(uri.toString(), panel);
    (provider as any)._readyPanels.add(uri.toString());
    return { provider, panel, document: { uri, getText: () => text } as any };
  };

  it('round-trips through the editor webview', async () => {
    const { provider, panel, document } = setup(doc);
    const pending = provider.replaceMermaidCode(uri, 'graph TD; A-->B', 'graph TD; A-->C', 5);
    await vi.waitFor(() => expect(panel.webview.postMessage).toHaveBeenCalled());
    const request = panel.webview.postMessage.mock.calls[0][0];
    expect(request).toMatchObject({ type: 'replaceMermaidCode', baseCode: 'graph TD; A-->B', newCode: 'graph TD; A-->C' });
    expect(doc.slice(request.codeFrom, request.codeTo)).toBe('graph TD; A-->B');

    await provider.handleWebviewMessage({ type: 'mermaidCodeReplaced', requestId: request.requestId, result: 'ok' }, document, panel);
    expect(await pending).toBe('ok');
  });

  it('refuses without asking the editor when the block changed', async () => {
    const { provider, panel } = setup(doc.replace('A-->B', 'A-->X'));
    expect(await provider.replaceMermaidCode(uri, 'graph TD; A-->B', 'graph TD; A-->C', 5)).toBe('changed');
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('reports missing when the editor does not answer', async () => {
    const { provider } = setup(doc);
    expect(await provider.replaceMermaidCode(uri, 'graph TD; A-->B', 'graph TD; A-->C', 5, 20)).toBe('missing');
  });
});

import { openChatForDiagram } from '../src/extension';

describe('janus.editDiagramWithAi', () => {
  it('attaches the diagram to the chat and focuses it', async () => {
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const chat = { setDiagramContext: vi.fn(), focusInput: vi.fn() } as any;
    const diagram = { noteUri: 'file:///workspace/project-plan.md', code: 'graph TD; A-->B', line: 5 };

    await openChatForDiagram(chat, diagram);

    expect(chat.setDiagramContext).toHaveBeenCalledWith(diagram);
    expect(exec).toHaveBeenCalledWith('janus.chatView.focus');
    expect(chat.focusInput).toHaveBeenCalled();
    expect(chat.focusInput.mock.invocationCallOrder[0]).toBeGreaterThan(exec.mock.invocationCallOrder[0]);
  });
});

describe('editDiagramWithAi for a freshly inserted block', () => {
  it('waits until the block has reached the document', async () => {
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    let text = '# Plan\n\n';
    const document = { uri: vscode.Uri.file('/workspace/plan.md'), getText: () => text } as any;
    setTimeout(() => {
      text = '# Plan\n\n```mermaid\ngraph TD\n    A[Neues Diagramm]\n```\n';
    }, 120);

    await provider.handleWebviewMessage({ type: 'editDiagramWithAi', blockFrom: 8 }, document, { webview: { postMessage: vi.fn() } } as any);

    expect(exec).toHaveBeenCalledWith('janus.editDiagramWithAi', {
      noteUri: document.uri.toString(),
      code: 'graph TD\n    A[Neues Diagramm]',
      line: 3,
    });
  });
});
