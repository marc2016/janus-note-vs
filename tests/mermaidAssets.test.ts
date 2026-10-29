import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';

const existsSync = vi.hoisted(() => vi.fn());
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: (p: any) => existsSync(p) ?? actual.existsSync(p) };
});
import { findLocalMermaidScript } from '../src/services/pdfExportService';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';

describe('shipped Mermaid script', () => {
  it('prefers the copy in dist/webviews for the PDF export', () => {
    existsSync.mockImplementation((p: unknown) => String(p).replace(/\\/g, '/').endsWith('/webviews/mermaid.min.js'));
    const url = findLocalMermaidScript();
    expect(url).toMatch(/^file:\/\/.*\/webviews\/mermaid\.min\.js$/);
    existsSync.mockReset();
  });

  it('passes the script URI to the editor webview', () => {
    const provider = new MarkdownEditorProvider({ extensionUri: vscode.Uri.file('/ext') } as any);
    const webview = { asWebviewUri: (uri: vscode.Uri) => vscode.Uri.parse(`webview-resource:${uri.fsPath}`) } as any;
    const html: string = (provider as any).getHtmlForWebview(webview, { getText: () => '# Notiz' });
    const json = JSON.parse(html.match(/<script id="initial-data" type="application\/json">(.*?)<\/script>/s)![1]);
    expect(json).toEqual({ content: '# Notiz', mermaidScriptUri: expect.stringContaining('/ext/dist/webviews/mermaid.min.js') });
  });
});
