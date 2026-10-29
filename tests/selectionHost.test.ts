import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { EditorState, TransactionSpec } from '@codemirror/state';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import { formatSummaryCallout } from '../src/services/markdownScan';
import { insertAfterAnchor } from '../src/webviews/markdown/extensions/selectionActions';
import { openChatForSelection } from '../src/extension';

const uri = vscode.Uri.file('/workspace/plan.md');
const panel = () => ({ webview: { postMessage: vi.fn() } }) as any;

describe('selection messages on the host', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('opens the chat summary for a selection', async () => {
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    const document = { uri, getText: () => 'x' } as any;
    await provider.handleWebviewMessage({ type: 'summarizeSelection', text: 'Markiert', fromLine: 12, toLine: 15 }, document, panel());
    expect(exec).toHaveBeenCalledWith('janus.summarizeSelection', {
      noteUri: uri.toString(),
      text: 'Markiert',
      fromLine: 12,
      toLine: 15,
    });
  });

  it('opens the diagram chat with the selected text as source', async () => {
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    const text = 'Absatz\n```mermaid\ngraph TD\n    A[Neues Diagramm]\n```';
    const document = { uri, getText: () => text } as any;
    await provider.handleWebviewMessage({ type: 'diagramFromSelection', blockFrom: 7, text: 'Absatz' }, document, panel());
    expect(exec).toHaveBeenCalledWith('janus.editDiagramWithAi', {
      noteUri: uri.toString(),
      code: 'graph TD\n    A[Neues Diagramm]',
      line: 2,
      sourceText: 'Absatz',
    });
  });

  it('focuses the chat, then summarizes', async () => {
    const order: string[] = [];
    vi.spyOn(vscode.commands, 'executeCommand').mockImplementation(async () => {
      order.push('focus');
    });
    const chat = {
      focusInput: vi.fn(() => order.push('input')),
      startSelectionSummary: vi.fn(async () => {
        order.push('summary');
      }),
    } as any;
    const selection = { noteUri: uri.toString(), text: 'Text', fromLine: 1, toLine: 1 };
    await openChatForSelection(chat, selection);
    expect(order).toEqual(['focus', 'input', 'summary']);
    expect(chat.startSelectionSummary).toHaveBeenCalledWith(selection);
  });
});

describe('inserting a summary', () => {
  it('formats a callout', () => {
    expect(formatSummaryCallout('Kurz gesagt.\n\n- Punkt')).toBe('> [!NOTE]\n> **Zusammenfassung:** Kurz gesagt.\n>\n> - Punkt');
  });

  const view = (doc: string) => {
    const v = {
      state: EditorState.create({ doc }),
      dispatch(spec: TransactionSpec) {
        v.state = v.state.update(spec).state;
      },
    };
    return v;
  };

  it('inserts after the last selected line, at the occurrence nearest to the line', () => {
    const v = view('Satz eins\nfolgt hier.\nWeiter\n\nSatz eins\nfolgt hier.\nEnde');
    expect(insertAfterAnchor(v, { anchorText: 'Satz eins\nfolgt hier.', insert: '> [!NOTE]', line: 5 })).toBe('ok');
    expect(v.state.doc.toString()).toBe('Satz eins\nfolgt hier.\nWeiter\n\nSatz eins\nfolgt hier.\n\n> [!NOTE]\nEnde');
  });

  it('inserts nothing when the selected text changed', () => {
    const v = view('Satz geändert');
    expect(insertAfterAnchor(v, { anchorText: 'Satz eins', insert: '> x', line: 1 })).toBe('changed');
    expect(v.state.doc.toString()).toBe('Satz geändert');
  });

  it('round-trips through the editor and refuses changed text early', async () => {
    (vscode.workspace as any).openTextDocument = vi.fn(async () => ({ uri, getText: () => 'Satz eins' }));
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    const p = panel();
    (provider as any)._activePanels.set(uri.toString(), p);
    (provider as any)._readyPanels.add(uri.toString());

    const pending = provider.insertAfterText(uri, 'Satz eins', '> [!NOTE]', 1);
    await vi.waitFor(() => expect(p.webview.postMessage).toHaveBeenCalled());
    const request = p.webview.postMessage.mock.calls[0][0];
    expect(request).toMatchObject({ type: 'insertAfterText', anchorText: 'Satz eins', insert: '> [!NOTE]', line: 1 });
    await provider.handleWebviewMessage({ type: 'textInserted', requestId: request.requestId, result: 'ok' }, { uri } as any, p);
    expect(await pending).toBe('ok');

    expect(await provider.insertAfterText(uri, 'Gibt es nicht', '> x', 1)).toBe('changed');
  });
});

import { openChatForDiagram } from '../src/extension';

describe('diagram from a selection in the chat', () => {
  it('requests the diagram right away when the selected text is known', async () => {
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const chat = { setDiagramContext: vi.fn(), focusInput: vi.fn(), processUserMessage: vi.fn(async () => {}) } as any;
    await openChatForDiagram(chat, { noteUri: uri.toString(), code: 'graph TD', line: 3, sourceText: 'Markiert' });
    expect(chat.processUserMessage).toHaveBeenCalledWith('Erstelle ein Diagramm aus dem markierten Text.');
  });

  it('waits for a description for /ki-diagramm and the KI button', async () => {
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const chat = { setDiagramContext: vi.fn(), focusInput: vi.fn(), processUserMessage: vi.fn(async () => {}) } as any;
    await openChatForDiagram(chat, { noteUri: uri.toString(), code: 'graph TD', line: 3 });
    expect(chat.processUserMessage).not.toHaveBeenCalled();
  });
});

