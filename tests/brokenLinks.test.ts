import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  createMissingNote,
  findBrokenLinks,
  missingNoteLocation,
  rankNotesBySimilarity,
  removeBrokenLinks,
  retargetBrokenLinks,
  scanBrokenLinks,
} from '../src/services/brokenLinkService';
import { repairBrokenLinksCommand, repairLinkInNote } from '../src/commands/brokenLinksCommand';

const root = '/notes';
const rootUri = vscode.Uri.file(root);
let files: Record<string, string>;

/** Backs workspace.fs with an in-memory notes collection. */
function mockFileSystem() {
  vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
    const prefix = `${uri.fsPath}/`;
    const entries = new Map<string, vscode.FileType>();
    for (const filePath of Object.keys(files)) {
      if (!filePath.startsWith(prefix)) continue;
      const [name, ...rest] = filePath.slice(prefix.length).split('/');
      entries.set(name, rest.length > 0 ? vscode.FileType.Directory : vscode.FileType.File);
    }
    return [...entries];
  });
  vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async (uri: any) => {
    if (!(uri.fsPath in files)) throw new Error('Not found');
    return Buffer.from(files[uri.fsPath]);
  });
  vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(async (uri: any, content: any) => {
    files[uri.fsPath] = Buffer.from(content).toString('utf-8');
  });
  vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: any) => {
    if (uri.fsPath in files) return { type: vscode.FileType.File } as any;
    throw new Error('Not found');
  });
  vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue(undefined);
}

const names = async () => (await findBrokenLinks([rootUri], rootUri)).map((t) => t.name);
const targetNamed = async (name: string) => (await findBrokenLinks([rootUri], rootUri)).find((t) => t.name === name)!;

beforeEach(() => {
  vi.restoreAllMocks();
  (vscode.workspace as any).textDocuments = [];
  (vscode.workspace as any).workspaceFolders = undefined;
  files = {};
  mockFileSystem();
});

describe('findBrokenLinks', () => {
  it('finds missing wiki and Markdown link targets', async () => {
    files[`${root}/plan.md`] = '[[kickof]] und [Ideen](ideen.md) und [[plan]]';
    expect((await names()).sort()).toEqual(['ideen', 'kickof']);
  });

  it('ignores external, anchor-only, non-note and code links', async () => {
    files[`${root}/plan.md`] = [
      '[Docs](https://example.com) [Oben](#oben) [Diagramm](diagramm.png)',
      '```',
      '[[kickof]]',
      '```',
      'Inline `[[kickof]]`',
    ].join('\n');
    expect(await names()).toEqual([]);
  });

  it('groups references by target ignoring case and .md, most frequent spelling first', async () => {
    files[`${root}/plan.md`] = '[[Roadmap]]\n\n[[Roadmap]]';
    files[`${root}/index.md`] = '[Roadmap](roadmap.md)\n[[ideen]]';
    const targets = await findBrokenLinks([rootUri], rootUri);

    expect(targets.map((t) => [t.name, t.references.length])).toEqual([
      ['Roadmap', 3],
      ['ideen', 1],
    ]);
    expect(new Set(targets[0].references.map((r) => r.sourceUri.fsPath))).toEqual(
      new Set([`${root}/plan.md`, `${root}/index.md`])
    );
  });
});

describe('repair actions', () => {
  it('creates a path target below the notes root without changing linking notes', async () => {
    files[`${root}/meetings/sync.md`] = 'Siehe [[projects/roadmap]]';
    const target = await targetNamed('projects/roadmap');
    const uri = missingNoteLocation(target, rootUri)!;
    await createMissingNote(uri);

    expect(uri.fsPath).toBe(`${root}/projects/roadmap.md`);
    expect(files[`${root}/projects/roadmap.md`]).toBe('# roadmap\n\n');
    expect(files[`${root}/meetings/sync.md`]).toBe('Siehe [[projects/roadmap]]');
    expect(await names()).toEqual([]);
  });

  it('creates a name-only target in the picked folder so all references resolve', async () => {
    files[`${root}/meetings/sync.md`] = '[[Roadmap]]';
    files[`${root}/projects/plan.md`] = '[[Roadmap]]';
    const target = await targetNamed('Roadmap');

    expect(missingNoteLocation(target, rootUri)).toBeUndefined();
    const uri = missingNoteLocation(target, rootUri, vscode.Uri.file(`${root}/knowledge`))!;
    await createMissingNote(uri);

    expect(files[`${root}/knowledge/Roadmap.md`]).toBe('# Roadmap\n\n');
    expect(await names()).toEqual([]);
  });

  it('ranks similar note names first', () => {
    const notes = ['/notes/archiv.md', '/notes/meetings/kickoff.md', '/notes/kick.md', '/notes/projekt-kickoff-alt.md'].map(
      (p) => vscode.Uri.file(p)
    );
    expect(rankNotesBySimilarity('kickof', notes)[0].fsPath).toBe('/notes/meetings/kickoff.md');
  });

  it('retargets wiki and Markdown links, keeping label and suffix', async () => {
    files[`${root}/meetings/kickoff.md`] = '# Kickoff';
    files[`${root}/projects/plan.md`] = 'A [[kickof]] B [Start](kickof.md#agenda) C';
    const scan = await scanBrokenLinks([rootUri], rootUri);
    const target = scan.targets.find((t) => t.key === 'kickof')!;

    const { result, skipped } = await retargetBrokenLinks(target, vscode.Uri.file(`${root}/meetings/kickoff.md`), scan, rootUri);

    expect(skipped).toBe(0);
    expect(result.updatedLinks).toBe(2);
    expect(files[`${root}/projects/plan.md`]).toBe('A [[kickoff]] B [Start](../meetings/kickoff.md#agenda) C');
    expect(await names()).toEqual([]);
  });

  it('removes links, keeping their visible text', async () => {
    files[`${root}/plan.md`] = '- [[ideen]]\n- [[ideen|Ideensammlung]]\n- [Ideen-Liste](ideen.md)\n- [[plan]]';
    await removeBrokenLinks(await targetNamed('ideen'));

    expect(files[`${root}/plan.md`]).toBe('- ideen\n- Ideensammlung\n- Ideen-Liste\n- [[plan]]');
  });

  it('keeps unsaved changes of an open linking note', async () => {
    files[`${root}/plan.md`] = '[[ideen]]';
    const unsaved = 'Neu getippt\n[[ideen]]';
    const doc = {
      uri: vscode.Uri.file(`${root}/plan.md`),
      isDirty: true,
      getText: () => unsaved,
      positionAt: (offset: number) => {
        const before = unsaved.slice(0, offset).split('\n');
        return new vscode.Position(before.length - 1, before[before.length - 1].length);
      },
      save: vi.fn(async () => true),
    };
    (vscode.workspace as any).textDocuments = [doc];
    const applySpy = vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
    const writeSpy = vi.spyOn(vscode.workspace.fs, 'writeFile');

    await removeBrokenLinks(await targetNamed('ideen'));

    const edit = applySpy.mock.calls[0][0] as any;
    expect(edit.entries).toEqual([
      expect.objectContaining({ newText: 'ideen', range: expect.objectContaining({ start: new vscode.Position(1, 0) }) }),
    ]);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe('repairBrokenLinksCommand', () => {
  const companionManager = { getNotesRootUri: () => rootUri, getAllNotesRoots: () => [rootUri] } as any;

  it('informs the user when no links are broken', async () => {
    files[`${root}/plan.md`] = '[[plan]]';
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const pickSpy = vi.spyOn(vscode.window, 'showQuickPick');

    await repairBrokenLinksCommand(companionManager);

    expect(infoSpy).toHaveBeenCalledWith('Keine defekten Links gefunden.');
    expect(pickSpy).not.toHaveBeenCalled();
  });

  it('shows the list again with the remaining targets after a repair', async () => {
    files[`${root}/plan.md`] = '[[a]] [[b]] [[c]]';
    const lists: string[][] = [];
    vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) => {
      if (items[0]?.target) {
        lists.push(items.map((i: any) => i.label));
        return lists.length === 1 ? items.find((i: any) => i.label === 'b') : undefined;
      }
      return items.find((i: any) => i.action === 'remove');
    });

    await repairBrokenLinksCommand(companionManager);

    expect(lists).toEqual([['a', 'b', 'c'], ['a', 'c']]);
    expect(files[`${root}/plan.md`]).toBe('[[a]] b [[c]]');
  });

  it('creates a name-only note in the preselected folder and opens it in the Janus editor', async () => {
    files[`${root}/meetings/sync.md`] = '[[Roadmap]]';
    files[`${root}/plan.md`] = '# Plan';
    const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    let folderItems: any[] = [];
    let round = 0;
    vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) => {
      if (items[0]?.target) return round++ === 0 ? items[0] : undefined;
      if (items[0]?.action) return items.find((i: any) => i.action === 'create');
      folderItems = items;
      return items[0];
    });

    await repairBrokenLinksCommand(companionManager);

    expect(folderItems[0].label).toBe('meetings');
    expect(files[`${root}/meetings/Roadmap.md`]).toBe('# Roadmap\n\n');
    expect(execSpy).toHaveBeenCalledWith(
      'vscode.openWith',
      expect.objectContaining({ fsPath: `${root}/meetings/Roadmap.md` }),
      'janus.markdownEditor'
    );
  });

  it('opens a reference at its line without writing files', async () => {
    files[`${root}/plan.md`] = 'Eins\n\n[[ideen]]';
    const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    const writeSpy = vi.spyOn(vscode.workspace.fs, 'writeFile');
    let round = 0;
    vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) => {
      if (items[0]?.target) return round++ === 0 ? items[0] : undefined;
      if (items[0]?.action) return items.find((i: any) => i.action === 'open');
      return items[0];
    });

    await repairBrokenLinksCommand(companionManager);

    expect(execSpy).toHaveBeenCalledWith('janus.openNoteAtLine', expect.objectContaining({ fsPath: `${root}/plan.md` }), 3);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe('repairLinkInNote (click on a missing link)', () => {
  const companionManager = { getNotesRootUri: () => rootUri, getAllNotesRoots: () => [rootUri] } as any;

  beforeEach(() => {
    files[`${root}/meetings/kickoff.md`] = '# Kickoff';
    files[`${root}/plan.md`] = 'A [[kickof]] B [Start](kickof.md#agenda)';
    files[`${root}/other.md`] = '[[kickof]]';
  });

  it('retargets the links in the clicked note only', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async (items: any) => items[0]);

    await repairLinkInNote(companionManager, vscode.Uri.file(`${root}/plan.md`), 'kickof', 'retarget');

    expect(files[`${root}/plan.md`]).toBe('A [[kickoff]] B [Start](meetings/kickoff.md#agenda)');
    expect(files[`${root}/other.md`]).toBe('[[kickof]]');
  });

  it('removes the links in the clicked note only', async () => {
    await repairLinkInNote(companionManager, vscode.Uri.file(`${root}/plan.md`), 'kickof.md', 'remove');

    expect(files[`${root}/plan.md`]).toBe('A kickof B Start');
    expect(files[`${root}/other.md`]).toBe('[[kickof]]');
  });
});
