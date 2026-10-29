import * as vscode from 'vscode';
import * as path from 'path';

export const IMAGE_ASSETS_FOLDER = 'assets';
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const pad = (n: number) => String(n).padStart(2, '0');

export function imageExtensionForMime(mime: string): string | undefined {
  return EXTENSION_BY_MIME[mime.toLowerCase()];
}

/** Keeps letters, digits, `.`, `_` and `-`; everything else (spaces, umlauts) becomes `-`. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+(\.[^.]+)$/, '$1');
  return cleaned || 'bild';
}

/** `<note>-YYYYMMDD-HHmmss.<ext>` for a pasted image, using local time. */
export function pastedImageName(noteBaseName: string, mime: string, now: Date): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes()
  )}${pad(now.getSeconds())}`;
  return `${sanitizeFileName(noteBaseName)}-${stamp}.${imageExtensionForMime(mime) ?? 'png'}`;
}

/** Name for a dropped file: its sanitized name, with the extension of its MIME type if it has none. */
export function droppedImageName(fileName: string, mime: string): string {
  const sanitized = sanitizeFileName(fileName);
  return /\.[A-Za-z0-9]+$/.test(sanitized) ? sanitized : `${sanitized}.${imageExtensionForMime(mime) ?? 'png'}`;
}

/** Returns a German reason when the image cannot be added, otherwise undefined. */
export function validateImage(mime: string, size: number, fileName?: string): string | undefined {
  const label = fileName ? `„${fileName}“` : 'Das Bild';
  if (!imageExtensionForMime(mime)) {
    return `${label} wurde nicht eingefügt: Nur PNG, JPEG, GIF, WebP und SVG werden unterstützt.`;
  }
  if (size > MAX_IMAGE_BYTES) {
    return `${label} wurde nicht eingefügt: Bilder dürfen höchstens 20 MB groß sein.`;
  }
  return undefined;
}

/** Appends `-2`, `-3`, … before the extension until no file with that name exists in `dir`. */
export async function uniqueName(dir: vscode.Uri, name: string): Promise<string> {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? name : `${base}-${i}${ext}`;
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(dir, candidate));
    } catch {
      return candidate;
    }
  }
}

export type SaveImageResult = { relPath: string } | { reason: string };

/** Validates and writes an image into `<noteDir>/assets`, returning the link path relative to the note. */
export async function saveImageNextToNote(
  noteUri: vscode.Uri,
  image: { data: Uint8Array; mime: string; fileName?: string },
  now: Date = new Date()
): Promise<SaveImageResult> {
  const reason = validateImage(image.mime, image.data.byteLength, image.fileName);
  if (reason) {
    return { reason };
  }
  const assetsDir = vscode.Uri.file(path.join(path.dirname(noteUri.fsPath), IMAGE_ASSETS_FOLDER));
  await vscode.workspace.fs.createDirectory(assetsDir);

  const noteBaseName = path.basename(noteUri.fsPath).replace(/\.(md|markdown)$/i, '');
  const desired = image.fileName
    ? droppedImageName(image.fileName, image.mime)
    : pastedImageName(noteBaseName, image.mime, now);
  const name = await uniqueName(assetsDir, desired);
  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(assetsDir, name), image.data);
  return { relPath: `${IMAGE_ASSETS_FOLDER}/${name}` };
}
