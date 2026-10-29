import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import * as ac from '@codemirror/autocomplete';
import { LinkCandidate, findLinkCandidatesAcrossRoots } from '../src/companion/noteLinking';
import { clearNoteMetadataCache } from '../src/services/noteMetadataService';
import {
  createLinkAutocompleteSource,
  FILE_TYPE_ICONS,
} from '../src/webviews/markdown/extensions/linkAutocomplete';
import { getSlashCommands } from '../src/webviews/markdown/extensions/slashCommands';
import { insertOrWrapLink, formattingKeymap } from '../src/webviews/markdown/lib/formatting';

describe('Inline File and Note Linking', () => {
  const sampleCandidates: LinkCandidate[] = [
    {
      label: 'Meeting-Notes',
      insertText: 'Meeting-Notes',
      relPath: 'Meeting-Notes.md',
      fileType: 'note',
    },
    {
      label: 'Architecture',
      insertText: 'projects/Architecture',
      relPath: 'projects/Architecture.md',
      fileType: 'note',
    },
    {
      label: 'diagram.png',
      insertText: 'assets/diagram.png',
      relPath: 'assets/diagram.png',
      fileType: 'image',
    },
    {
      label: 'specs.pdf',
      insertText: 'docs/specs.pdf',
      relPath: 'docs/specs.pdf',
      fileType: 'pdf',
    },
    {
      label: 'board.tasks.json',
      insertText: 'board.tasks.json',
      relPath: 'board.tasks.json',
      fileType: 'task',
    },
  ];

  describe('createLinkAutocompleteSource', () => {
    it('returns null when cursor is not preceded by [[', () => {
      const source = createLinkAutocompleteSource(() => sampleCandidates);
      const state = EditorState.create({ doc: 'Hello world' });
      const result = source({
        state,
        pos: 11,
        matchBefore: (regex: RegExp) => {
          const match = 'Hello world'.match(regex);
          if (!match) return null;
          return { from: 0, to: 11, text: match[0] };
        },
      } as any);

      expect(result).toBeNull();
    });

    it('returns completions with type icons and relative path details when preceded by [[', () => {
      const source = createLinkAutocompleteSource(() => sampleCandidates);
      const doc = 'Check this: [[';
      const state = EditorState.create({ doc });
      const result = source({
        state,
        pos: doc.length,
        matchBefore: (regex: RegExp) => {
          const match = doc.match(regex);
          if (!match) return null;
          return { from: 12, to: 14, text: match[0] };
        },
      } as any);

      expect(result).not.toBeNull();
      expect(result?.options.length).toBe(5);

      const noteOption = result?.options.find((o) => o.label === 'Meeting-Notes');
      expect(noteOption).toBeDefined();
      expect(noteOption?.displayLabel).toBe(`${FILE_TYPE_ICONS.note} Meeting-Notes`);
      expect(noteOption?.detail).toBe('Meeting-Notes.md');
      expect(noteOption?.type).toBe('note');

      const imgOption = result?.options.find((o) => o.label === 'diagram.png');
      expect(imgOption).toBeDefined();
      expect(imgOption?.displayLabel).toBe(`${FILE_TYPE_ICONS.image} diagram.png`);
      expect(imgOption?.detail).toBe('assets/diagram.png');
      expect(imgOption?.type).toBe('image');
    });

    it('applies completion by replacing from opening [[ to cursor and closing with ]]', () => {
      const source = createLinkAutocompleteSource(() => sampleCandidates);
      const doc = 'See [[';
      const state = EditorState.create({ doc });
      const result = source({
        state,
        pos: doc.length,
        matchBefore: (regex: RegExp) => {
          const match = doc.match(regex);
          if (!match) return null;
          return { from: 4, to: 6, text: match[0] };
        },
      } as any);

      const candidate = result?.options.find((o) => o.label === 'Meeting-Notes');
      expect(candidate).toBeDefined();

      let dispatchedChanges: any = null;
      let selectionAnchor: number | null = null;
      const mockView = {
        state,
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
          selectionAnchor = tr.selection?.anchor;
        },
      } as unknown as EditorView;

      if (typeof candidate?.apply === 'function') {
        // applyFrom = match.from + 2 = 6, applyTo = 6
        candidate.apply(mockView, candidate, 6, 6);
      }

      expect(dispatchedChanges).toEqual({
        from: 4,
        to: 6,
        insert: '[[Meeting-Notes]]',
      });
      expect(selectionAnchor).toBe(4 + '[[Meeting-Notes]]'.length);
    });

    it('avoids double closing brackets when cursor is followed by ]]', () => {
      const source = createLinkAutocompleteSource(() => sampleCandidates);
      const doc = 'See [[]] later';
      const state = EditorState.create({ doc });
      const result = source({
        state,
        pos: 6,
        matchBefore: (regex: RegExp) => {
          const match = 'See [['.match(regex);
          if (!match) return null;
          return { from: 4, to: 6, text: match[0] };
        },
      } as any);

      const candidate = result?.options.find((o) => o.label === 'diagram.png');
      let dispatchedChanges: any = null;
      const mockView = {
        state,
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
        },
      } as unknown as EditorView;

      if (typeof candidate?.apply === 'function') {
        candidate.apply(mockView, candidate, 6, 6);
      }

      // Should replace from 4 to 8 (including existing ']]')
      expect(dispatchedChanges).toEqual({
        from: 4,
        to: 8,
        insert: '[[assets/diagram.png]]',
      });
    });
  });

  describe('Slash Commands (/link, /verlinken, /note)', () => {
    it('registers /link, /verlinken, and /note in getSlashCommands', () => {
      const commands = getSlashCommands();
      const labels = commands.map((c) => c.label);
      expect(labels).toContain('/link');
      expect(labels).toContain('/verlinken');
      expect(labels).toContain('/note');
    });

    it('replaces /link with [[ and invokes startCompletion', () => {
      const commands = getSlashCommands();
      const linkCmd = commands.find((c) => c.label === '/link');
      expect(linkCmd).toBeDefined();

      let dispatchedChanges: any = null;
      let selectionAnchor: number | null = null;
      const mockView = {
        state: EditorState.create({ doc: '/link' }),
        plugin: () => null,
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
          selectionAnchor = tr.selection?.anchor;
        },
      } as unknown as EditorView;

      if (typeof linkCmd?.apply === 'function') {
        linkCmd.apply(mockView, linkCmd, 0, 5);
      }

      expect(dispatchedChanges).toEqual({
        from: 0,
        to: 5,
        insert: '[[',
      });
      expect(selectionAnchor).toBe(2);
    });

    it('replaces /note with [[ and invokes startCompletion', () => {
      const commands = getSlashCommands();
      const noteCmd = commands.find((c) => c.label === '/note');

      let dispatchedChanges: any = null;
      const mockView = {
        state: EditorState.create({ doc: '/note' }),
        plugin: () => null,
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
        },
      } as unknown as EditorView;

      if (typeof noteCmd?.apply === 'function') {
        noteCmd.apply(mockView, noteCmd, 0, 5);
      }

      expect(dispatchedChanges).toEqual({
        from: 0,
        to: 5,
        insert: '[[',
      });
    });
  });

  describe('insertOrWrapLink & Cmd+K Keybinding', () => {
    it('has Mod-k bound in formattingKeymap', () => {
      const modK = formattingKeymap.find((k) => k.key === 'Mod-k');
      expect(modK).toBeDefined();
      expect(typeof modK?.run).toBe('function');
    });

    it('wraps selected text in [[...]] when text is selected', () => {
      const state = EditorState.create({
        doc: 'Link to Project Alpha here',
        selection: { anchor: 8, head: 21 }, // "Project Alpha"
      });

      let dispatchedChanges: any = null;
      const mockView = {
        state,
        focus: vi.fn(),
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
        },
      } as unknown as EditorView;

      const result = insertOrWrapLink(mockView);
      expect(result).toBe(true);
      expect(dispatchedChanges).toEqual({
        from: 8,
        to: 21,
        insert: '[[Project Alpha]]',
      });
      expect(mockView.focus).toHaveBeenCalled();
    });

    it('unwraps text if already wrapped in [[...]]', () => {
      const state = EditorState.create({
        doc: 'Link to [[Project Alpha]] here',
        selection: { anchor: 8, head: 25 }, // "[[Project Alpha]]"
      });

      let dispatchedChanges: any = null;
      const mockView = {
        state,
        focus: vi.fn(),
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
        },
      } as unknown as EditorView;

      const result = insertOrWrapLink(mockView);
      expect(result).toBe(true);
      expect(dispatchedChanges).toEqual({
        from: 8,
        to: 25,
        insert: 'Project Alpha',
      });
    });

    it('inserts [[ and calls startCompletion when selection is collapsed', () => {
      const state = EditorState.create({
        doc: 'Notes: ',
        selection: { anchor: 7, head: 7 },
      });

      let dispatchedChanges: any = null;
      let selectionAnchor: number | null = null;
      const mockView = {
        state,
        focus: vi.fn(),
        plugin: () => null,
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
          selectionAnchor = tr.selection?.anchor;
        },
      } as unknown as EditorView;

      const result = insertOrWrapLink(mockView);
      expect(result).toBe(true);
      expect(dispatchedChanges).toEqual({
        from: 7,
        insert: '[[',
      });
      expect(selectionAnchor).toBe(9);
    });
  });
});

describe('frontmatter titles and aliases as link candidates', () => {
  const root = vscode.Uri.file('/workspace/notes');
  const files: Record<string, string> = {
    '/workspace/notes/knowledge/rest-schnittstelle.md': '---\naliases: [API]\n---\n',
    '/workspace/notes/2026-10-29-sync.md': '---\ntitle: Wöchentlicher Sync\n---\n',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    clearNoteMetadataCache();
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
      if (uri.fsPath === '/workspace/notes') {
        return [
          ['2026-10-29-sync.md', vscode.FileType.File],
          ['knowledge', vscode.FileType.Directory],
        ];
      }
      if (uri.fsPath === '/workspace/notes/knowledge') return [['rest-schnittstelle.md', vscode.FileType.File]];
      return [];
    });
    vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: any) => Buffer.from(files[uri.fsPath] ?? ''));
  });

  it('adds an alias entry that inserts the alias and a title entry that inserts the file link', async () => {
    const candidates = await findLinkCandidatesAcrossRoots([root], 6, root);

    expect(candidates).toContainEqual({
      label: 'API',
      insertText: 'API',
      relPath: 'knowledge/rest-schnittstelle.md',
      fileType: 'note',
      matchedBy: 'alias',
    });
    expect(candidates).toContainEqual({
      label: 'Wöchentlicher Sync',
      insertText: '2026-10-29-sync',
      relPath: '2026-10-29-sync.md',
      fileType: 'note',
      matchedBy: 'title',
    });
  });

  it('inserts [[API]] when the alias completion is applied and shows the hint', async () => {
    const candidates = await findLinkCandidatesAcrossRoots([root], 6, root);
    const source = createLinkAutocompleteSource(() => candidates);
    const doc = 'See [[AP';
    const state = EditorState.create({ doc });
    const result = source({
      state,
      pos: doc.length,
      matchBefore: () => ({ from: 4, to: doc.length, text: '[[AP' }),
    } as any);

    const option = result?.options.find((o) => o.label === 'API');
    expect(option?.detail).toBe('knowledge/rest-schnittstelle.md · Alias');

    let changes: any = null;
    const view = { state, dispatch: (tr: any) => (changes = tr.changes) } as unknown as EditorView;
    (option!.apply as any)(view, option, 6, doc.length);
    expect(changes).toEqual({ from: 4, to: doc.length, insert: '[[API]]' });
  });
});
