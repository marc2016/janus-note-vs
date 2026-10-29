import * as vscode from 'vscode';
import { isMarkdownNote } from '../companion/companionPaths';

export const TEMPLATES_FOLDER = '.templates';

export interface NoteTemplate {
  name: string;
  uri: vscode.Uri;
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const EXAMPLE_TEMPLATE = `---
date: {{date}}
---
# {{title}}

## Notizen

## Aufgaben
- [ ]
`;

const pad = (n: number) => String(n).padStart(2, '0');

function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Replaces `{{title}}`, `{{date}}`, `{{date:DD.MM.YYYY}}`, `{{time}}` and `{{weekday}}`
 * (case-insensitive, spaces inside the braces allowed). Unknown placeholders stay unchanged.
 */
export function applyTemplate(text: string, values: { title: string; now: Date }): string {
  const { title, now } = values;
  return text.replace(/\{\{\s*([a-z]+)\s*(?::\s*([^}]*?))?\s*\}\}/gi, (match, rawName: string, arg?: string) => {
    const name = rawName.toLowerCase();
    if (name === 'title' && arg === undefined) return title;
    if (name === 'time' && arg === undefined) return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (name === 'weekday' && arg === undefined) return WEEKDAYS[now.getDay()];
    if (name === 'date') {
      if (arg === undefined) return formatIsoDate(now);
      if (arg.toUpperCase() === 'DD.MM.YYYY') {
        return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
      }
    }
    return match;
  });
}

export function templatesFolderUri(notesRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(notesRoot, TEMPLATES_FOLDER);
}

/** Lists the Markdown files directly inside `<notesRoot>/.templates`, sorted by name. */
export async function listTemplates(notesRoot: vscode.Uri): Promise<NoteTemplate[]> {
  const folder = templatesFolderUri(notesRoot);
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(folder);
  } catch {
    return [];
  }
  return entries
    .filter(([name, type]) => type === vscode.FileType.File && isMarkdownNote(name))
    .map(([name]) => ({ name: name.replace(/\.(md|markdown)$/i, ''), uri: vscode.Uri.joinPath(folder, name) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function ensureTemplatesFolder(notesRoot: vscode.Uri): Promise<vscode.Uri> {
  const folder = templatesFolderUri(notesRoot);
  await vscode.workspace.fs.createDirectory(folder);
  return folder;
}

/** Creates `<name>.md` with example content; never overwrites an existing template. */
export async function createTemplate(notesRoot: vscode.Uri, name: string): Promise<vscode.Uri | 'exists'> {
  const folder = await ensureTemplatesFolder(notesRoot);
  const fileName = /\.md$/i.test(name) ? name : `${name}.md`;
  const uri = vscode.Uri.joinPath(folder, fileName);
  try {
    await vscode.workspace.fs.stat(uri);
    return 'exists';
  } catch {
    // Free name
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(EXAMPLE_TEMPLATE, 'utf8'));
  return uri;
}
