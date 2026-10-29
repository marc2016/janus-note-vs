import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  dailyNoteContent,
  dailyNotePath,
  isDailyNotePath,
  openOrCreateDailyNote,
} from '../src/services/dailyNoteService';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';

const root = vscode.Uri.file('/workspace/notes');
const templatesDir = '/workspace/notes/.templates';

describe('daily note location', () => {
  it('uses journal/YYYY-MM-DD.md with the local date', () => {
    expect(dailyNotePath(root, new Date(2026, 9, 29, 23, 59)).fsPath).toBe('/workspace/notes/journal/2026-10-29.md');
  });

  it('recognizes daily note paths', () => {
    expect(isDailyNotePath('journal/2026-10-29.md')).toBe('2026-10-29');
    expect(isDailyNotePath('journal\\2026-10-29.md')).toBe('2026-10-29');
    expect(isDailyNotePath('journal/2026-13-40.md')).toBeUndefined();
    expect(isDailyNotePath('projects/2026-10-29.md')).toBeUndefined();
    expect(isDailyNotePath('journal/notes.md')).toBeUndefined();
  });
});

describe('dailyNoteContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the default frontmatter and heading without a template', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockRejectedValue(new Error('Not found'));

    const content = await dailyNoteContent(root, new Date(2026, 9, 29), new Date(2026, 9, 29, 7, 15));

    expect(content.split('\n').slice(0, 4)).toEqual(['---', 'date: 2026-10-29', '---', '# Donnerstag, 29.10.2026']);
  });

  it('fills the tagesnotiz template for the note date', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: any) =>
      uri.fsPath === templatesDir ? [['Tagesnotiz.md', vscode.FileType.File]] : []
    );
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('# {{weekday}}, {{date:DD.MM.YYYY}}\n{{title}} {{time}}\n\n## Notizen\n')
    );

    const content = await dailyNoteContent(root, new Date(2026, 9, 30), new Date(2026, 9, 29, 7, 15));

    expect(content).toBe('# Freitag, 30.10.2026\n2026-10-30 07:15\n\n## Notizen\n');
  });
});

describe('openOrCreateDailyNote', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockRejectedValue(new Error('Not found'));
  });

  it('creates and opens a missing daily note', async () => {
    vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('Not found'));
    const mkdir = vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();
    const write = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    const uri = await openOrCreateDailyNote(root, new Date(2026, 9, 29));

    expect(uri.fsPath).toBe('/workspace/notes/journal/2026-10-29.md');
    expect(mkdir).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/workspace/notes/journal' }));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ fsPath: uri.fsPath }), expect.anything());
    expect(Buffer.from(write.mock.calls[0][1] as Uint8Array).toString('utf8')).toContain('# Donnerstag, 29.10.2026');
    expect(exec).toHaveBeenCalledWith('vscode.openWith', uri, MarkdownEditorProvider.viewType);
  });

  it('opens an existing daily note without writing to it', async () => {
    vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
    const write = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    await openOrCreateDailyNote(root, new Date(2026, 9, 29));

    expect(write).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith(
      'vscode.openWith',
      expect.objectContaining({ fsPath: '/workspace/notes/journal/2026-10-29.md' }),
      MarkdownEditorProvider.viewType
    );
  });
});
