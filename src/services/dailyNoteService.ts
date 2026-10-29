import * as vscode from 'vscode';
import { MarkdownEditorProvider } from '../editors/markdownEditorProvider';
import { applyTemplate, listTemplates } from './noteTemplateService';

export const DAILY_NOTES_FOLDER = 'journal';
export const DAILY_NOTE_TEMPLATE = 'tagesnotiz';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as `YYYY-MM-DD`. */
export function formatDailyNoteDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` into a local date, or returns undefined for anything else. */
export function parseDailyNoteDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : undefined;
}

export function dailyNotePath(notesRoot: vscode.Uri, date: Date): vscode.Uri {
  return vscode.Uri.joinPath(notesRoot, DAILY_NOTES_FOLDER, `${formatDailyNoteDate(date)}.md`);
}

/** Returns the date of a daily note path relative to the notes root (`journal/2026-10-29.md` -> `2026-10-29`). */
export function isDailyNotePath(relPath: string): string | undefined {
  const match = /^journal\/(\d{4}-\d{2}-\d{2})\.md$/i.exec(relPath.replace(/\\/g, '/'));
  return match && parseDailyNoteDate(match[1]) ? match[1] : undefined;
}

/** Content of a new daily note: the `tagesnotiz` template filled for `date`, or the default heading. */
export async function dailyNoteContent(notesRoot: vscode.Uri, date: Date, now: Date): Promise<string> {
  const iso = formatDailyNoteDate(date);
  const template = (await listTemplates(notesRoot)).find((t) => t.name.toLowerCase() === DAILY_NOTE_TEMPLATE);
  if (template) {
    try {
      const text = Buffer.from(await vscode.workspace.fs.readFile(template.uri)).toString('utf8');
      // Date placeholders describe the note's day, {{time}} the moment of creation
      const forDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), now.getHours(), now.getMinutes());
      return applyTemplate(text, { title: iso, now: forDate });
    } catch {
      // Unreadable template: fall back to the default content
    }
  }
  const heading = `${WEEKDAYS[date.getDay()]}, ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  return `---\ndate: ${iso}\n---\n# ${heading}\n\n`;
}

/** Opens the daily note of `date`, creating `journal/` and the note first if it does not exist. */
export async function openOrCreateDailyNote(notesRoot: vscode.Uri, date: Date): Promise<vscode.Uri> {
  const uri = dailyNotePath(notesRoot, date);
  let exists = true;
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    exists = false;
  }

  if (!exists) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(notesRoot, DAILY_NOTES_FOLDER));
    const content = await dailyNoteContent(notesRoot, date, new Date());
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    await vscode.commands.executeCommand('janus.refreshNotesTree');
  }

  await vscode.commands.executeCommand('vscode.openWith', uri, MarkdownEditorProvider.viewType);
  return uri;
}

export async function dailyNoteExists(notesRoot: vscode.Uri, date: Date): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(dailyNotePath(notesRoot, date));
    return true;
  } catch {
    return false;
  }
}
