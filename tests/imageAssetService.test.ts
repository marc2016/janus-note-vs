import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  droppedImageName,
  imageExtensionForMime,
  pastedImageName,
  sanitizeFileName,
  saveImageNextToNote,
  uniqueName,
  validateImage,
} from '../src/services/imageAssetService';

describe('imageAssetService naming', () => {
  it('sanitizes file names without URL-unsafe characters', () => {
    expect(sanitizeFileName('Sprint Review')).toBe('Sprint-Review');
    expect(sanitizeFileName('Whiteboard Foto.jpg')).toBe('Whiteboard-Foto.jpg');
    expect(sanitizeFileName('Übersicht   Bäume (1).png')).toBe('bersicht-B-ume-1.png');
    expect(sanitizeFileName('--a__b--')).toBe('a__b');
    expect(sanitizeFileName('äöü')).toBe('bild');
  });

  it('maps MIME types to extensions', () => {
    expect(imageExtensionForMime('image/png')).toBe('png');
    expect(imageExtensionForMime('image/jpeg')).toBe('jpg');
    expect(imageExtensionForMime('image/gif')).toBe('gif');
    expect(imageExtensionForMime('image/webp')).toBe('webp');
    expect(imageExtensionForMime('image/svg+xml')).toBe('svg');
    expect(imageExtensionForMime('image/heic')).toBeUndefined();
  });

  it('names pasted images after the note and the local time', () => {
    expect(pastedImageName('Sprint Review', 'image/png', new Date(2026, 9, 29, 7, 12, 5))).toBe(
      'Sprint-Review-20261029-071205.png'
    );
  });

  it('keeps dropped file names and adds a missing extension', () => {
    expect(droppedImageName('skizze.svg', 'image/svg+xml')).toBe('skizze.svg');
    expect(droppedImageName('screenshot', 'image/png')).toBe('screenshot.png');
  });

  it('rejects unsupported types and images over 20 MB', () => {
    expect(validateImage('image/png', 1024)).toBeUndefined();
    expect(validateImage('image/heic', 1024, 'foto.heic')).toContain('Nur PNG, JPEG, GIF, WebP und SVG');
    expect(validateImage('image/png', 25 * 1024 * 1024, 'gross.png')).toContain('höchstens 20 MB');
  });
});

describe('imageAssetService files', () => {
  let files: Set<string>;

  beforeEach(() => {
    vi.restoreAllMocks();
    files = new Set();
    vi.spyOn(vscode.workspace.fs, 'stat').mockImplementation(async (uri: any) => {
      if (!files.has(uri.fsPath)) throw new Error('Not found');
      return {} as any;
    });
    vi.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue();
    vi.spyOn(vscode.workspace.fs, 'writeFile').mockImplementation(async (uri: any) => {
      files.add(uri.fsPath);
    });
  });

  it('appends -2, -3 on collisions', async () => {
    files.add('/n/meetings/assets/skizze.svg');
    files.add('/n/meetings/assets/skizze-2.svg');
    expect(await uniqueName(vscode.Uri.file('/n/meetings/assets'), 'skizze.svg')).toBe('skizze-3.svg');
  });

  it('saves a pasted image into assets next to the note', async () => {
    const result = await saveImageNextToNote(
      vscode.Uri.file('/n/projects/app/Sprint Review.md'),
      { data: new Uint8Array([1, 2, 3]), mime: 'image/png' },
      new Date(2026, 9, 29, 7, 12, 5)
    );
    expect(result).toEqual({ relPath: 'assets/Sprint-Review-20261029-071205.png' });
    expect(files.has('/n/projects/app/assets/Sprint-Review-20261029-071205.png')).toBe(true);
  });

  it('saves a dropped image under a free name without overwriting', async () => {
    files.add('/n/meetings/assets/skizze.svg');
    const write = vi.mocked(vscode.workspace.fs.writeFile);
    const result = await saveImageNextToNote(vscode.Uri.file('/n/meetings/kickoff.md'), {
      data: new Uint8Array([1]),
      mime: 'image/svg+xml',
      fileName: 'skizze.svg',
    });
    expect(result).toEqual({ relPath: 'assets/skizze-2.svg' });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/n/meetings/assets/skizze-2.svg' }), expect.anything());
  });

  it('writes nothing for a rejected image', async () => {
    const write = vi.mocked(vscode.workspace.fs.writeFile);
    const result = await saveImageNextToNote(vscode.Uri.file('/n/meetings/kickoff.md'), {
      data: new Uint8Array(1),
      mime: 'image/heic',
      fileName: 'foto.heic',
    });
    expect('reason' in result).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
});
