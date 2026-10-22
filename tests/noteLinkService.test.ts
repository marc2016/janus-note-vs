import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  extractDocumentLinks,
  findBacklinks,
  resolveCompanionSummary,
  getNoteLinksData,
  parseLinkTargetAndLine,
  resolveOutgoingLink,
} from '../src/services/noteLinkService';
import { CompanionManager } from '../src/companion/companionManager';
import { __setConfigStore } from './__mocks__/vscode';

describe('noteLinkService', () => {
  const notesRootUri = vscode.Uri.file('/workspace/notes');
  let companionManager: CompanionManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    companionManager = new CompanionManager();
    __setConfigStore({
      'janus.notesRoot': 'notes',
      'janus.initialized': true,
    });
    (vscode.workspace as any).workspaceFolders = [
      { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 },
    ];
  });

  describe('extractDocumentLinks', () => {
    it('extracts wiki-links including aliased and section links', () => {
      const text = `
# Project Overview
See [[Meeting-Notes]] and [[specs/architecture.md|System Architecture]] or [[Roadmap#Q3|Q3 Plan]].
`;
      const links = extractDocumentLinks(text);
      expect(links).toEqual([
        {
          raw: '[[Meeting-Notes]]',
          target: 'Meeting-Notes',
          label: 'Meeting-Notes',
          type: 'wiki',
        },
        {
          raw: '[[specs/architecture.md|System Architecture]]',
          target: 'specs/architecture.md',
          label: 'System Architecture',
          type: 'wiki',
        },
        {
          raw: '[[Roadmap#Q3|Q3 Plan]]',
          target: 'Roadmap',
          label: 'Q3 Plan',
          type: 'wiki',
        },
      ]);
    });

    it('extracts standard markdown links while ignoring external URLs and images', () => {
      const text = `
Check [Design Doc](specs/design.md) and [API Guide](./api.md#endpoints).
Ignore ![Diagram](diagram.png) and [Google](https://google.com) and [Mail](mailto:test@example.com).
`;
      const links = extractDocumentLinks(text);
      expect(links).toEqual([
        {
          raw: '[Design Doc](specs/design.md)',
          target: 'specs/design.md',
          label: 'Design Doc',
          type: 'markdown',
        },
        {
          raw: '[API Guide](./api.md#endpoints)',
          target: './api.md',
          label: 'API Guide',
          type: 'markdown',
        },
      ]);
    });

    it('deduplicates repeated references to the same target', () => {
      const text = 'First [[Meeting-Notes]] and second [[meeting-notes|Again]].';
      const links = extractDocumentLinks(text);
      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('Meeting-Notes');
    });
  });

  describe('findBacklinks', () => {
    it('discovers notes in notesRoot that link to the target note via wiki-link or markdown link', async () => {
      const targetNoteUri = vscode.Uri.file('/workspace/notes/NoteA.md');

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
        if (uri.fsPath === '/workspace/notes') {
          return [
            ['NoteA.md', vscode.FileType.File],
            ['NoteB.md', vscode.FileType.File],
            ['NoteC.md', vscode.FileType.File],
            ['sub', vscode.FileType.Directory],
          ];
        }
        if (uri.fsPath === '/workspace/notes/sub') {
          return [['NoteD.md', vscode.FileType.File]];
        }
        return [];
      });

      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
        if (uri.fsPath.endsWith('NoteB.md')) {
          return Buffer.from('References [[NoteA]] in text.', 'utf-8');
        }
        if (uri.fsPath.endsWith('NoteC.md')) {
          return Buffer.from('Unrelated note content.', 'utf-8');
        }
        if (uri.fsPath.endsWith('NoteD.md')) {
          return Buffer.from('Links via [Note A](../NoteA.md).', 'utf-8');
        }
        return Buffer.from('', 'utf-8');
      });

      const backlinks = await findBacklinks(targetNoteUri, notesRootUri);
      expect(backlinks).toHaveLength(2);
      expect(backlinks.map((b) => b.title)).toEqual(['NoteB', 'NoteD']);
      expect(backlinks.map((b) => b.relativePath)).toEqual(['NoteB.md', 'sub/NoteD.md']);
    });
  });

  describe('resolveCompanionSummary & getNoteLinksData', () => {
    it('resolves folder tasks.json and note chart companion status with open and total task counts', async () => {
      const noteUri = vscode.Uri.file('/workspace/notes/projekt-alpha/alpha.md');

      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
        if (uri.fsPath.endsWith('projekt-alpha/tasks.json')) {
          return {} as any;
        }
        throw new Error('Not found');
      });

      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
        if (uri.fsPath.endsWith('projekt-alpha/tasks.json')) {
          return Buffer.from(
            JSON.stringify({
              version: 1,
              title: 'Alpha Tasks',
              tasks: [
                { id: '1', title: 'T1', completed: false, status: 'todo', priority: 'high', createdAt: '' },
                { id: '2', title: 'T2', completed: false, status: 'in_progress', priority: 'medium', createdAt: '' },
                { id: '3', title: 'T3', completed: false, status: 'todo', priority: 'low', createdAt: '' },
                { id: '4', title: 'T4', completed: true, status: 'done', priority: 'medium', createdAt: '' },
                { id: '5', title: 'T5', completed: true, status: 'done', priority: 'low', createdAt: '' },
              ],
            }),
            'utf-8'
          );
        }
        return Buffer.from('', 'utf-8');
      });

      vi.spyOn(companionManager, 'getCompanionStatus').mockResolvedValue({
        noteUri,
        tasksUri: vscode.Uri.file('/workspace/notes/projekt-alpha/alpha.tasks.json'),
        chartUri: vscode.Uri.file('/workspace/notes/projekt-alpha/alpha.chart.json'),
        tasksExist: false,
        chartExist: true,
        chart: {
          version: 1,
          title: 'Alpha Chart',
          chartType: 'mermaid',
          code: 'graph TD; A-->B',
        },
      });

      const summary = await resolveCompanionSummary(noteUri, companionManager);
      expect(summary.tasks).toBeDefined();
      expect(summary.tasks?.openCount).toBe(3);
      expect(summary.tasks?.completedCount).toBe(2);
      expect(summary.tasks?.totalCount).toBe(5);
      expect(summary.tasks?.label).toBe('Ordner-Aufgaben: projekt-alpha (3 offen, 5 gesamt)');
      expect(summary.chart?.exists).toBe(true);
    });

    it('aggregates outgoing links, backlinks, and companions in getNoteLinksData', async () => {
      const noteUri = vscode.Uri.file('/workspace/notes/alpha.md');

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['alpha.md', vscode.FileType.File],
        ['beta.md', vscode.FileType.File],
      ]);

      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
        if (uri.fsPath.endsWith('beta.md') || uri.fsPath.endsWith('alpha.md')) {
          return {} as any;
        }
        throw new Error('Not found');
      });

      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
        if (uri.fsPath.endsWith('beta.md')) {
          return Buffer.from('Backlink to [[alpha]]', 'utf-8');
        }
        return Buffer.from('', 'utf-8');
      });

      const data = await getNoteLinksData(
        noteUri,
        'Outgoing link to [[beta]] and [[missing-note]]',
        companionManager
      );

      expect(data.outgoingLinks).toHaveLength(2);
      expect(data.outgoingLinks[0].title).toBe('beta');
      expect(data.outgoingLinks[0].exists).toBe(true);
      expect(data.outgoingLinks[1].title).toBe('missing-note');
      expect(data.outgoingLinks[1].exists).toBe(false);
      expect(data.backlinks).toHaveLength(1);
      expect(data.backlinks[0].title).toBe('beta');
    });
  });

  describe('MarkdownEditorProvider link messaging (openLink & addLink)', () => {
    it('opens note, tasks, and chart targets in their respective Janus editors on openLink', async () => {
      const { MarkdownEditorProvider } = await import('../src/editors/markdownEditorProvider');
      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => '# Alpha\n',
        positionAt: (offset: number) => offset,
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
      const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: 'file:///workspace/notes/beta.md' },
        mockDoc,
        mockPanel
      );
      expect(execSpy).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.objectContaining({ path: '/workspace/notes/beta.md' }),
        'janus.markdownEditor'
      );

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: 'file:///workspace/notes/alpha.tasks.json' },
        mockDoc,
        mockPanel
      );
      expect(execSpy).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.objectContaining({ path: '/workspace/notes/alpha.tasks.json' }),
        'janus.tasksEditor'
      );

      await provider.handleWebviewMessage(
        { type: 'openLink', targetUri: 'file:///workspace/notes/alpha.chart.json' },
        mockDoc,
        mockPanel
      );
      expect(execSpy).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.objectContaining({ path: '/workspace/notes/alpha.chart.json' }),
        'janus.chartEditor'
      );
    });

    it('presents QuickPick of workspace notes on addLink and appends [[Selected Note]] to document', async () => {
      const { MarkdownEditorProvider } = await import('../src/editors/markdownEditorProvider');
      const provider = new MarkdownEditorProvider(
        { extensionUri: vscode.Uri.file('/ext') } as any,
        companionManager
      );
      let docContent = '# Alpha\n';
      const mockDoc = {
        uri: vscode.Uri.file('/workspace/notes/alpha.md'),
        getText: () => docContent,
        positionAt: (offset: number) => offset,
      } as any;
      const mockPanel = {
        webview: { postMessage: vi.fn() },
      } as any;

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['alpha.md', vscode.FileType.File],
        ['Meeting-Notes.md', vscode.FileType.File],
      ]);
      vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) => items[0]);
      const applyEditSpy = vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);

      await provider.handleWebviewMessage({ type: 'addLink' }, mockDoc, mockPanel);
      expect(applyEditSpy).toHaveBeenCalled();
    });
  });

  describe('findLinkCandidatesInRoot and candidate formatting', () => {
    it('determines file types correctly', async () => {
      const { determineFileType } = await import('../src/companion/noteLinking');
      expect(determineFileType('note.md')).toBe('note');
      expect(determineFileType('note.markdown')).toBe('note');
      expect(determineFileType('todo.tasks.json')).toBe('task');
      expect(determineFileType('tasks.json')).toBe('task');
      expect(determineFileType('arch.chart.json')).toBe('chart');
      expect(determineFileType('screenshot.png')).toBe('image');
      expect(determineFileType('photo.JPG')).toBe('image');
      expect(determineFileType('icon.svg')).toBe('image');
      expect(determineFileType('spec.pdf')).toBe('pdf');
      expect(determineFileType('data.csv')).toBe('file');
    });

    it('formats link candidates with clean label and insertText', async () => {
      const { createLinkCandidate } = await import('../src/companion/noteLinking');
      const noteCandidate = createLinkCandidate('projects/Alpha.md');
      expect(noteCandidate).toEqual({
        label: 'Alpha',
        insertText: 'projects/Alpha',
        relPath: 'projects/Alpha.md',
        fileType: 'note',
      });

      const rootNote = createLinkCandidate('inbox.md');
      expect(rootNote).toEqual({
        label: 'inbox',
        insertText: 'inbox',
        relPath: 'inbox.md',
        fileType: 'note',
      });

      const imgCandidate = createLinkCandidate('assets/diagram.png');
      expect(imgCandidate).toEqual({
        label: 'diagram.png',
        insertText: 'assets/diagram.png',
        relPath: 'assets/diagram.png',
        fileType: 'image',
      });
    });

    it('discovers files in root and subdirectories while skipping ignored directories', async () => {
      const { findLinkCandidatesInRoot } = await import('../src/companion/noteLinking');

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: vscode.Uri) => {
        if (uri.path === '/workspace/notes') {
          return [
            ['inbox.md', vscode.FileType.File],
            ['assets', vscode.FileType.Directory],
            ['node_modules', vscode.FileType.Directory],
            ['.git', vscode.FileType.Directory],
          ];
        }
        if (uri.path === '/workspace/notes/assets') {
          return [
            ['diagram.png', vscode.FileType.File],
            ['report.pdf', vscode.FileType.File],
            ['board.tasks.json', vscode.FileType.File],
          ];
        }
        return [];
      });

      const candidates = await findLinkCandidatesInRoot(notesRootUri);
      expect(candidates.map((c) => c.relPath)).toEqual([
        'inbox.md',
        'assets/board.tasks.json',
        'assets/diagram.png',
        'assets/report.pdf',
      ]);
      expect(candidates[0].fileType).toBe('note');
      expect(candidates[1].fileType).toBe('task');
      expect(candidates[2].fileType).toBe('image');
      expect(candidates[3].fileType).toBe('pdf');
    });
  });

  describe('Line Target Parsing & Line-Aware Backlinks', () => {
    it('parseLinkTargetAndLine extracts target and line numbers across formats', () => {
      expect(parseLinkTargetAndLine('src/auth/login.ts:42')).toEqual({
        cleanTarget: 'src/auth/login.ts',
        lineNumber: 42,
      });

      expect(parseLinkTargetAndLine('src/auth/login.ts:42:15')).toEqual({
        cleanTarget: 'src/auth/login.ts',
        lineNumber: 42,
      });

      expect(parseLinkTargetAndLine('src/auth/login.ts#L42')).toEqual({
        cleanTarget: 'src/auth/login.ts',
        lineNumber: 42,
      });

      expect(parseLinkTargetAndLine('src/auth/login.ts#L42-L50')).toEqual({
        cleanTarget: 'src/auth/login.ts',
        lineNumber: 42,
      });

      expect(parseLinkTargetAndLine('[[notes/guide.md:15]]')).toEqual({
        cleanTarget: 'notes/guide.md',
        lineNumber: 15,
      });

      expect(parseLinkTargetAndLine('[[notes/guide#L25]]')).toEqual({
        cleanTarget: 'notes/guide',
        lineNumber: 25,
      });

      expect(parseLinkTargetAndLine('notes/guide.md#section-heading')).toEqual({
        cleanTarget: 'notes/guide.md',
        lineNumber: undefined,
      });

      expect(parseLinkTargetAndLine('C:\\workspace\\notes\\doc.md:88')).toEqual({
        cleanTarget: 'C:\\workspace\\notes\\doc.md',
        lineNumber: 88,
      });
    });

    it('extractDocumentLinks extracts target line numbers', () => {
      const text = `
See [[src/service.ts:42]] and [Handler](src/handler.ts#L88) and regular [[Meeting-Notes]].
`;
      const links = extractDocumentLinks(text);
      expect(links).toHaveLength(3);

      const serviceLink = links.find((l) => l.target === 'src/service.ts');
      const handlerLink = links.find((l) => l.target === 'src/handler.ts');
      const regularLink = links.find((l) => l.target === 'Meeting-Notes');

      expect(serviceLink?.lineNumber).toBe(42);
      expect(handlerLink?.lineNumber).toBe(88);
      expect(regularLink?.lineNumber).toBeUndefined();
    });

    it('resolveOutgoingLink attaches lineNumber to resolved item', async () => {
      const sourceNote = vscode.Uri.file('/workspace/notes/test.md');
      const targetFile = vscode.Uri.file('/workspace/notes/src/service.ts');

      vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri) => {
        if (uri.fsPath === targetFile.fsPath) {
          return { type: vscode.FileType.File } as any;
        }
        throw new Error('Not found');
      });

      const resolved = await resolveOutgoingLink(
        {
          raw: '[[src/service.ts:42]]',
          target: 'src/service.ts:42',
          label: 'Service',
          type: 'wiki',
        },
        sourceNote,
        vscode.Uri.file('/workspace/notes')
      );

      expect(resolved.exists).toBe(true);
      expect(resolved.lineNumber).toBe(42);
    });

    it('findBacklinks records 1-based origin line numbers of incoming references', async () => {
      const targetNoteUri = vscode.Uri.file('/workspace/notes/Target.md');

      vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
        if (uri.fsPath === '/workspace/notes') {
          return [
            ['Target.md', vscode.FileType.File],
            ['SourceA.md', vscode.FileType.File],
            ['SourceB.md', vscode.FileType.File],
          ];
        }
        return [];
      });

      vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri) => {
        if (uri.fsPath.endsWith('SourceA.md')) {
          return Buffer.from('# Source A\nLine 2\nLine 3 references [[Target]]\nLine 4', 'utf-8');
        }
        if (uri.fsPath.endsWith('SourceB.md')) {
          return Buffer.from('Line 1\nLine 2\nLine 3\nLine 4\nLine 5 links to [Target](Target.md)\n', 'utf-8');
        }
        return Buffer.from('', 'utf-8');
      });

      const backlinks = await findBacklinks(targetNoteUri, notesRootUri);
      expect(backlinks).toHaveLength(2);

      const a = backlinks.find((b) => b.title === 'SourceA');
      const b = backlinks.find((b) => b.title === 'SourceB');

      expect(a?.lineNumber).toBe(3);
      expect(b?.lineNumber).toBe(5);
    });
  });
});
