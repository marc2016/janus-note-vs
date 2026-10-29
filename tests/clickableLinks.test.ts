import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { DecorationSet } from '@codemirror/view';
import {
  buildDecorations,
  livePreview,
  syntaxVisibilityCompartment,
  syntaxVisibilityFacet,
} from '../src/webviews/markdown/extensions/livePreview';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import { CompanionManager } from '../src/companion/companionManager';

function collectDecorations(decoSet: DecorationSet, docLength: number) {
  const items: {
    from: number;
    to: number;
    className?: string;
    attributes?: Record<string, string>;
  }[] = [];

  decoSet.between(0, docLength, (from, to, value) => {
    items.push({
      from,
      to,
      className: (value.spec as any)?.class,
      attributes: (value.spec as any)?.attributes,
    });
  });

  return items;
}

function createMockView(doc: string, cursorHead: number, cursorAnchor: number, mode: 'auto' | 'visible' | 'hidden' = 'auto') {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursorAnchor, head: cursorHead },
    extensions: [
      markdown(),
      livePreview(mode),
    ],
  });

  return {
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }],
  } as any;
}

describe('Clickable Editor Links & Delimiter Concealing', () => {
  describe('Wiki-Links Decoration & Syntax Visibility', () => {
    it('conceals [[ and ]] delimiters in auto mode when cursor is outside the wiki-link', () => {
      const doc = 'Check this note: [[Meeting-Notes]] for details.';
      // Cursor is at index 0 (outside link)
      const view = createMockView(doc, 0, 0, 'auto');
      const decos = collectDecorations(buildDecorations(view), doc.length);

      const linkStart = doc.indexOf('[[');
      const linkEnd = doc.indexOf(']]') + 2;

      // Opening brackets concealed
      const openDelim = decos.find((d) => d.from === linkStart && d.to === linkStart + 2);
      expect(openDelim?.className).toBe('cm-syntax-hidden');

      // Link text marked clickable
      const linkText = decos.find(
        (d) => d.from === linkStart + 2 && d.to === linkEnd - 2
      );
      expect(linkText?.className).toBe('cm-link-text');
      expect(linkText?.attributes?.['data-link-target']).toBe('Meeting-Notes');
      expect(linkText?.attributes?.['data-link-type']).toBe('wiki');

      // Closing brackets concealed
      const closeDelim = decos.find((d) => d.from === linkEnd - 2 && d.to === linkEnd);
      expect(closeDelim?.className).toBe('cm-syntax-hidden');
    });

    it('reveals [[ and ]] delimiters in auto mode when cursor is inside the link', () => {
      const doc = 'Check this note: [[Meeting-Notes]] for details.';
      // Cursor is inside "Meeting-Notes" at index 22
      const insidePos = doc.indexOf('Meeting');
      const view = createMockView(doc, insidePos, insidePos, 'auto');
      const decos = collectDecorations(buildDecorations(view), doc.length);

      const linkStart = doc.indexOf('[[');
      const linkEnd = doc.indexOf(']]') + 2;

      // Delimiters are NOT hidden
      const hiddenDelims = decos.filter(
        (d) => (d.from === linkStart || d.to === linkEnd) && d.className === 'cm-syntax-hidden'
      );
      expect(hiddenDelims).toHaveLength(0);

      // Link text is marked as editing
      const linkText = decos.find(
        (d) => d.from === linkStart + 2 && d.to === linkEnd - 2
      );
      expect(linkText?.className).toContain('cm-link-editing');
    });

    it('handles wiki-links with aliases: hides [[Target| and reveals only alias in auto mode', () => {
      const doc = 'See [[Meeting-Notes|Team Sync]] for details.';
      const view = createMockView(doc, 0, 0, 'auto');
      const decos = collectDecorations(buildDecorations(view), doc.length);

      const linkStart = doc.indexOf('[[');
      const pipePos = doc.indexOf('|');
      const linkEnd = doc.indexOf(']]') + 2;

      // Prefix [[Meeting-Notes| is hidden
      const prefix = decos.find((d) => d.from === linkStart && d.to === pipePos + 1);
      expect(prefix?.className).toBe('cm-syntax-hidden');

      // Alias text is clickable
      const alias = decos.find((d) => d.from === pipePos + 1 && d.to === linkEnd - 2);
      expect(alias?.className).toBe('cm-link-text');
      expect(alias?.attributes?.['data-link-target']).toBe('Meeting-Notes');

      // Closing ]] is hidden
      const closing = decos.find((d) => d.from === linkEnd - 2 && d.to === linkEnd);
      expect(closing?.className).toBe('cm-syntax-hidden');
    });

    it('keeps delimiters visible when syntax visibility mode is "visible"', () => {
      const doc = 'See [[Meeting-Notes]] here.';
      const view = createMockView(doc, 0, 0, 'visible');
      const decos = collectDecorations(buildDecorations(view), doc.length);

      const hidden = decos.filter((d) => d.className?.includes('cm-syntax-hidden'));
      expect(hidden).toHaveLength(0);

      const linkText = decos.find((d) => d.className?.includes('cm-link-text'));
      expect(linkText).toBeDefined();
    });

    it('keeps delimiters hidden even when cursor is inside when mode is "hidden"', () => {
      const doc = 'See [[Meeting-Notes]] here.';
      const insidePos = doc.indexOf('Meeting');
      const view = createMockView(doc, insidePos, insidePos, 'hidden');
      const decos = collectDecorations(buildDecorations(view), doc.length);

      const hidden = decos.filter((d) => d.className === 'cm-syntax-hidden');
      expect(hidden.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Markdown Links & Bare URLs Decoration', () => {
    it('conceals [ and ](...) for standard markdown links in auto mode when cursor outside', () => {
      const doc = 'Go to [Documentation](https://janus.example/docs) now.';
      const view = createMockView(doc, 0, 0, 'auto');
      const decos = collectDecorations(buildDecorations(view), doc.length);

      const matchStart = doc.indexOf('[');
      const labelEnd = doc.indexOf(']');
      const matchEnd = doc.indexOf(')') + 1;

      // Opening [ concealed
      const openBracket = decos.find((d) => d.from === matchStart && d.to === matchStart + 1);
      expect(openBracket?.className).toBe('cm-syntax-hidden');

      // Label text marked
      const labelText = decos.find((d) => d.from === matchStart + 1 && d.to === labelEnd);
      expect(labelText?.className).toBe('cm-link-text');
      expect(labelText?.attributes?.['data-link-target']).toBe('https://janus.example/docs');
      expect(labelText?.attributes?.['data-link-type']).toBe('external');

      // Closing ](...) concealed
      const closeTarget = decos.find((d) => d.from === labelEnd && d.to === matchEnd);
      expect(closeTarget?.className).toBe('cm-syntax-hidden');
    });

    it('reveals markdown link syntax when cursor enters markdown link', () => {
      const doc = 'Go to [Documentation](https://janus.example/docs) now.';
      const insidePos = doc.indexOf('Docu');
      const view = createMockView(doc, insidePos, insidePos, 'auto');
      const decos = collectDecorations(buildDecorations(view), doc.length);

      const hidden = decos.filter(
        (d) => d.from >= doc.indexOf('[') && d.to <= doc.indexOf(')') + 1 && d.className === 'cm-syntax-hidden'
      );
      expect(hidden).toHaveLength(0);

      const labelText = decos.find(
        (d) => d.from === doc.indexOf('Documentation') && d.to === doc.indexOf(']')
      );
      expect(labelText?.className).toContain('cm-link-editing');
    });

    it('decorates bare external URLs as clickable links', () => {
      const doc = 'Visit https://github.com/janus-note for code.';
      const view = createMockView(doc, 0, 0, 'auto');
      const decos = collectDecorations(buildDecorations(view), doc.length);

      const urlStart = doc.indexOf('https://');
      const urlEnd = doc.indexOf(' for code');

      const urlDeco = decos.find((d) => d.from === urlStart && d.to === urlEnd);
      expect(urlDeco?.className).toBe('cm-link-text');
      expect(urlDeco?.attributes?.['data-link-target']).toBe('https://github.com/janus-note');
      expect(urlDeco?.attributes?.['data-link-type']).toBe('external');
    });
  });

  describe('MarkdownEditorProvider openLink Navigation & Missing Note Prompt', () => {
    it('opens external URLs with vscode.env.openExternal', async () => {
      const companionManager = new CompanionManager();
      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      const openExternalSpy = vi.spyOn(vscode.env, 'openExternal').mockResolvedValue(true);
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: 'https://github.com/janus-note' },
        mockDoc,
        mockPanel
      );

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({ scheme: 'https', authority: 'github.com' })
      );
      expect(execSpy).not.toHaveBeenCalled();
    });

    it('opens mailto links with vscode.env.openExternal', async () => {
      const companionManager = new CompanionManager();
      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      const openExternalSpy = vi.spyOn(vscode.env, 'openExternal').mockResolvedValue(true);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: 'mailto:support@example.com' },
        mockDoc,
        mockPanel
      );

      expect(openExternalSpy).toHaveBeenCalledWith(
        expect.objectContaining({ scheme: 'mailto', path: 'support@example.com' })
      );
    });

    it('resolves raw note targets (wiki-link name) and opens existing notes in Janus Markdown editor', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(
        vscode.Uri.file('/workspace/notes')
      );

      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      // Existing notes
      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['alpha.md', vscode.FileType.File],
        ['Meeting-Notes.md', vscode.FileType.File],
      ]);
      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.path.includes('Meeting-Notes.md')) {
          return {} as any;
        }
        throw new Error('Not found');
      });
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: 'Meeting-Notes' },
        mockDoc,
        mockPanel
      );

      expect(execSpy).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.objectContaining({ path: '/workspace/notes/Meeting-Notes.md' }),
        'janus.markdownEditor'
      );
    });

    it('prompts confirmation when clicking non-existent note, and creates & opens note on "Erstellen"', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(
        vscode.Uri.file('/workspace/notes')
      );

      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['alpha.md', vscode.FileType.File],
      ]);
      vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));
      const confirmSpy = vi
        .spyOn(vscode.window, 'showInformationMessage')
        .mockResolvedValue('Erstellen' as any);
      const writeFileSpy = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue(undefined);
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: 'Brand-New-Idea' },
        mockDoc,
        mockPanel
      );

      expect(confirmSpy).toHaveBeenCalledWith(
        "Notiz 'Brand-New-Idea' existiert nicht. Jetzt erstellen?",
        'Erstellen',
        'Abbrechen'
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/workspace/notes/Brand-New-Idea.md' }),
        Buffer.from('# Brand-New-Idea\n\n', 'utf-8')
      );
      expect(execSpy).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.objectContaining({ path: '/workspace/notes/Brand-New-Idea.md' }),
        'janus.markdownEditor'
      );
    });

    it('does not create or open note if user cancels the missing-note prompt', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(
        vscode.Uri.file('/workspace/notes')
      );

      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['alpha.md', vscode.FileType.File],
      ]);
      vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));
      vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Abbrechen' as any);
      const writeFileSpy = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue(undefined);
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: 'Cancelled-Note' },
        mockDoc,
        mockPanel
      );

      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(execSpy).not.toHaveBeenCalled();
    });

    it('shows error message if clicked target is a non-existent non-markdown file', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(
        vscode.Uri.file('/workspace/notes')
      );

      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));
      const errorSpy = vi.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined as any);
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: '/workspace/notes/missing.pdf' },
        mockDoc,
        mockPanel
      );

      expect(errorSpy).toHaveBeenCalledWith("Datei 'missing.pdf' existiert nicht.");
      expect(execSpy).not.toHaveBeenCalled();
    });

    it('opens code files with vscode.window.showTextDocument selecting the target line', async () => {
      const companionManager = new CompanionManager();
      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
      const fakeLineRange = new vscode.Range(new vscode.Position(24, 0), new vscode.Position(24, 30));
      const fakeTextDoc = {
        uri: vscode.Uri.file('/workspace/src/app.ts'),
        lineCount: 100,
        lineAt: vi.fn().mockReturnValue({ range: fakeLineRange }),
      };
      const mockEditor = {
        revealRange: vi.fn(),
        setDecorations: vi.fn(),
      };
      const openTextDocSpy = vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(fakeTextDoc as any);
      const showTextDocSpy = vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(mockEditor as any);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: '/workspace/src/app.ts:25' },
        mockDoc,
        mockPanel
      );

      expect(openTextDocSpy).toHaveBeenCalledWith(vscode.Uri.file('/workspace/src/app.ts'));
      expect(showTextDocSpy).toHaveBeenCalledWith(fakeTextDoc, {
        selection: fakeLineRange,
        preview: false,
      });
      expect(mockEditor.revealRange).toHaveBeenCalledWith(fakeLineRange, vscode.TextEditorRevealType.InCenter);
      expect(mockEditor.setDecorations).toHaveBeenCalled();
    });

    it('sets pending line reveal and dispatches revealLine when the target markdown webview becomes ready', async () => {
      const companionManager = new CompanionManager();
      vi.spyOn(companionManager, 'getNotesRootUri').mockReturnValue(
        vscode.Uri.file('/workspace/notes')
      );

      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      const targetDoc = {
        uri: vscode.Uri.file('/workspace/notes/target.md'),
        getText: () => '# Target\nLine 2\nLine 3',
      } as any;
      const targetPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
      vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      // Trigger openLink targeting target.md with line 18
      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: '/workspace/notes/target.md:18' },
        mockDoc,
        mockPanel
      );

      // Target webview initializes and sends 'ready'
      await provider.handleWebviewMessage(
        { type: 'ready' },
        targetDoc,
        targetPanel
      );

      expect(targetPanel.webview.postMessage).toHaveBeenCalledWith({
        type: 'revealLine',
        line: 18,
      });
    });

    it('dispatches revealLine immediately when opening a markdown file whose webview is already active', async () => {
      const companionManager = new CompanionManager();
      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      const targetUri = vscode.Uri.file('/workspace/notes/beta.md');
      const targetPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      (provider as any)._activePanels.set(targetUri.toString(), targetPanel);
      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
      vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: '/workspace/notes/beta.md', lineNumber: 35 },
        mockDoc,
        mockPanel
      );

      expect(targetPanel.webview.postMessage).toHaveBeenCalledWith({
        type: 'revealLine',
        line: 35,
      });
    });
  });

  describe('clickableLinks CodeMirror Extension DOM Event Handling', () => {
    it('intercepts mousedown on .cm-link-text, prevents default, and fires onOpenLink on mouseup', async () => {
      const { clickableLinks } = await import('../src/webviews/markdown/extensions/clickableLinks');
      const onOpenLink = vi.fn();
      const ext: any = clickableLinks({ onOpenLink });
      const handlers = ext.domEventHandlers;

      const mockSpan = {
        getAttribute: (attr: string) =>
          attr === 'data-link-target' ? 'Meeting-Notes' : attr === 'data-link-type' ? 'wiki' : null,
        closest: (sel: string) => (sel === '.cm-link-text' ? mockSpan : null),
      };

      const mousedownEvent = {
        button: 0,
        altKey: false,
        clientX: 100,
        clientY: 200,
        target: mockSpan,
        preventDefault: vi.fn(),
      } as any;

      const downHandled = handlers.mousedown(mousedownEvent, {} as any);
      expect(downHandled).toBe(true);
      expect(mousedownEvent.preventDefault).toHaveBeenCalled();

      const mouseupEvent = {
        button: 0,
        clientX: 102,
        clientY: 201,
        target: mockSpan,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      const upHandled = handlers.mouseup(mouseupEvent, {} as any);
      expect(upHandled).toBe(true);
      expect(onOpenLink).toHaveBeenCalledWith('Meeting-Notes', 'wiki');
    });

    it('intercepts click on .cm-link-text and fires onOpenLink', async () => {
      const { clickableLinks } = await import('../src/webviews/markdown/extensions/clickableLinks');
      const onOpenLink = vi.fn();
      const ext: any = clickableLinks({ onOpenLink });
      const handlers = ext.domEventHandlers;

      const mockSpan = {
        getAttribute: (attr: string) =>
          attr === 'data-link-target' ? 'https://example.com' : attr === 'data-link-type' ? 'external' : null,
        closest: (sel: string) => (sel === '.cm-link-text' ? mockSpan : null),
      };

      const clickEvent = {
        button: 0,
        altKey: false,
        target: mockSpan,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      const clickHandled = handlers.click(clickEvent, {} as any);
      expect(clickHandled).toBe(true);
      expect(onOpenLink).toHaveBeenCalledWith('https://example.com', 'external');
    });

    it('bypasses link navigation when Alt key is held (allowing caret placement for editing)', async () => {
      const { clickableLinks } = await import('../src/webviews/markdown/extensions/clickableLinks');
      const onOpenLink = vi.fn();
      const ext: any = clickableLinks({ onOpenLink });
      const handlers = ext.domEventHandlers;

      const mockSpan = {
        getAttribute: (attr: string) => (attr === 'data-link-target' ? 'Meeting-Notes' : null),
        closest: (sel: string) => (sel === '.cm-link-text' ? mockSpan : null),
      };

      const mousedownEvent = {
        button: 0,
        altKey: true,
        clientX: 100,
        clientY: 200,
        target: mockSpan,
        preventDefault: vi.fn(),
      } as any;

      const downHandled = handlers.mousedown(mousedownEvent, {} as any);
      expect(downHandled).toBe(false);
      expect(mousedownEvent.preventDefault).not.toHaveBeenCalled();

      const clickEvent = {
        button: 0,
        altKey: true,
        target: mockSpan,
        preventDefault: vi.fn(),
      } as any;

      const clickHandled = handlers.click(clickEvent, {} as any);
      expect(clickHandled).toBe(false);
      expect(onOpenLink).not.toHaveBeenCalled();
    });

    it('ignores clicks on non-link elements', async () => {
      const { clickableLinks } = await import('../src/webviews/markdown/extensions/clickableLinks');
      const onOpenLink = vi.fn();
      const ext: any = clickableLinks({ onOpenLink });
      const handlers = ext.domEventHandlers;

      const plainSpan = {
        getAttribute: () => null,
        closest: () => null,
      };

      const mousedownEvent = {
        button: 0,
        altKey: false,
        clientX: 50,
        clientY: 50,
        target: plainSpan,
        preventDefault: vi.fn(),
      } as any;

      expect(handlers.mousedown(mousedownEvent, {} as any)).toBe(false);
      expect(onOpenLink).not.toHaveBeenCalled();
    });

    it('does not open link if user was dragging to select text (dist >= 10px)', async () => {
      const { clickableLinks } = await import('../src/webviews/markdown/extensions/clickableLinks');
      const onOpenLink = vi.fn();
      const ext: any = clickableLinks({ onOpenLink });
      const handlers = ext.domEventHandlers;

      const mockSpan = {
        getAttribute: (attr: string) => (attr === 'data-link-target' ? 'Meeting-Notes' : null),
        closest: (sel: string) => (sel === '.cm-link-text' ? mockSpan : null),
      };

      handlers.mousedown(
        {
          button: 0,
          altKey: false,
          clientX: 10,
          clientY: 10,
          target: mockSpan,
          preventDefault: vi.fn(),
        } as any,
        {} as any
      );

      const upHandled = handlers.mouseup(
        {
          button: 0,
          clientX: 50, // Moved 40px
          clientY: 10,
          target: mockSpan,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as any,
        {} as any
      );

      expect(upHandled).toBe(false);
      expect(onOpenLink).not.toHaveBeenCalled();
    });
  });
});

