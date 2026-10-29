import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  applyTemplate,
  createTemplate,
  listTemplates,
} from '../src/services/noteTemplateService';

// Thursday, 2026-10-29 07:12
const now = new Date(2026, 9, 29, 7, 12, 5);

describe('applyTemplate', () => {
  it('fills every supported placeholder and keeps frontmatter', () => {
    const template = [
      '---',
      'date: {{date}}',
      '---',
      '# {{title}}',
      'Erstellt am {{weekday}}, {{date:DD.MM.YYYY}} um {{ time }}',
    ].join('\n');

    expect(applyTemplate(template, { title: 'Sprint 12', now })).toBe(
      ['---', 'date: 2026-10-29', '---', '# Sprint 12', 'Erstellt am Donnerstag, 29.10.2026 um 07:12'].join('\n')
    );
  });

  it('matches names case-insensitively and allows spaces', () => {
    expect(applyTemplate('{{ TITLE }} {{Date : dd.mm.yyyy}}', { title: 'A', now })).toBe('A 29.10.2026');
  });

  it('keeps unknown placeholders and unsupported date formats', () => {
    expect(applyTemplate('{{teilnehmer}} {{date:YYYY/MM}} {{title:x}}', { title: 'A', now })).toBe(
      '{{teilnehmer}} {{date:YYYY/MM}} {{title:x}}'
    );
  });
});

describe('template files', () => {
  const root = vscode.Uri.file('/workspace/notes');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists only Markdown files in .templates, sorted by name', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri: any) =>
      uri.fsPath === '/workspace/notes/.templates'
        ? [
            ['projekt.md', vscode.FileType.File],
            ['bild.png', vscode.FileType.File],
            ['Meeting.md', vscode.FileType.File],
            ['alt', vscode.FileType.Directory],
          ]
        : []
    );

    const templates = await listTemplates(root);
    expect(templates.map((t) => [t.name, t.uri.fsPath])).toEqual([
      ['Meeting', '/workspace/notes/.templates/Meeting.md'],
      ['projekt', '/workspace/notes/.templates/projekt.md'],
    ]);
  });

  it('returns no templates when the folder does not exist', async () => {
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockRejectedValue(new Error('Not found'));
    expect(await listTemplates(root)).toEqual([]);
  });

  it('creates a template with example content in a new folder', async () => {
    const mkdir = vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();
    vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('Not found'));
    const write = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();

    const result = await createTemplate(root, 'meeting');

    expect(mkdir).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/workspace/notes/.templates' }));
    expect(result).toEqual(expect.objectContaining({ fsPath: '/workspace/notes/.templates/meeting.md' }));
    const content = Buffer.from(write.mock.calls[0][1] as Uint8Array).toString('utf8');
    expect(content).toContain('{{title}}');
    expect(content).toContain('{{date}}');
  });

  it('does not overwrite an existing template', async () => {
    vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();
    vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
    const write = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue();

    expect(await createTemplate(root, 'meeting')).toBe('exists');
    expect(write).not.toHaveBeenCalled();
  });
});
