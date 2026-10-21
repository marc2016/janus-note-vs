import * as vscode from 'vscode';
import * as path from 'path';
import { FolderTasksService } from './folderTasksService';
import { isMarkdownNote } from '../companion/companionPaths';

export type CalendarEntryKind = 'note' | 'task';

export interface CalendarEntry {
  id: string;
  kind: CalendarEntryKind;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  title: string;
  // For note events:
  noteUri?: string;
  notePath?: string;
  line?: number;
  snippet?: string;
  // For tasks:
  taskId?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  folder?: string;
  folderUri?: string;
}

export function padZero(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}

export function normalizeDate(year: number, month: number, day: number): string | null {
  if (year < 100) {
    year += 2000;
  }
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${year}-${padZero(month)}-${padZero(day)}`;
}

export function cleanEventTitle(rawLine: string, dateToken: string, timeToken?: string): string {
  let cleaned = rawLine;

  // Remove the date token
  cleaned = cleaned.replace(dateToken, ' ');

  // Remove the time token if present
  if (timeToken) {
    cleaned = cleaned.replace(timeToken, ' ');
    cleaned = cleaned.replace(/\bUhr\b/i, ' ');
  }

  // Remove markdown list markers, headings, blockquotes, checkboxes
  cleaned = cleaned.replace(/^[\s>*#+-]+/, '');
  cleaned = cleaned.replace(/^\[[ xX]?\]\s*/, '');

  // Remove trailing/leading punctuation often surrounding dates (colons, hyphens, parentheses)
  cleaned = cleaned.replace(/^[\s:\-–—|@)]+/, '');
  cleaned = cleaned.replace(/[\s:\-–—|@(]+$/, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

export function extractNoteEventsFromMarkdown(
  content: string,
  noteUri: vscode.Uri,
  notesRootUri?: vscode.Uri
): CalendarEntry[] {
  const events: CalendarEntry[] = [];
  const fileName = path.basename(noteUri.fsPath);
  const noteRelPath = notesRootUri
    ? path.relative(notesRootUri.fsPath, noteUri.fsPath).replace(/\\/g, '/')
    : fileName;

  // Derive default fallback title from note's first heading or filename
  const headingMatch = content.match(/^#+\s+(.+)$/m);
  const fallbackNoteTitle = headingMatch ? headingMatch[1].trim() : fileName.replace(/\.[^.]+$/, '');

  // 1. Check YAML frontmatter (e.g. date: 2026-10-24)
  let bodyStartIndex = 0;
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    bodyStartIndex = fmMatch[0].length;
    const fmContent = fmMatch[1];
    const fmDateMatch = fmContent.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})["']?/m);
    if (fmDateMatch) {
      const dateStr = fmDateMatch[1];
      const parts = dateStr.split('-').map(Number);
      const validDate = normalizeDate(parts[0], parts[1], parts[2]);
      if (validDate) {
        events.push({
          id: `ev-fm-${noteRelPath}-${validDate}`,
          kind: 'note',
          date: validDate,
          title: fallbackNoteTitle,
          noteUri: noteUri.toString(),
          notePath: noteRelPath,
          line: 1,
          snippet: `date: ${validDate}`,
        });
      }
    }
  }

  // 2. Scan lines
  const lines = content.split(/\r?\n/);
  let inCodeBlock = false;
  let currentByteIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineIndex = i + 1;
    const line = lines[i];
    const lineStart = currentByteIndex;
    currentByteIndex += line.length + 1;

    // Skip frontmatter lines
    if (lineStart < bodyStartIndex && fmMatch) {
      continue;
    }

    // Toggle fenced code blocks
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      continue;
    }

    // Skip lines that are just Markdown links or image embeds with URL timestamps
    // Mask URLs to avoid extracting dates inside URLs (e.g. https://.../2026-10-24/...)
    const lineWithoutUrls = line.replace(/https?:\/\/[^\s)]+/g, '');

    // Check optional time on the line
    let foundTime: string | undefined;
    let timeRawToken: string | undefined;
    const timeMatch = lineWithoutUrls.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*Uhr)?\b/i);
    if (timeMatch) {
      foundTime = `${padZero(Number(timeMatch[1]))}:${timeMatch[2]}`;
      timeRawToken = timeMatch[0];
    }

    // Regex 1: ISO Date (e.g. 2026-10-24 or @2026-10-24)
    const isoMatch = lineWithoutUrls.match(/(?:@|\b)(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      const validDate = normalizeDate(year, month, day);

      if (validDate) {
        const rawToken = isoMatch[0];
        let title = cleanEventTitle(lineWithoutUrls, rawToken, timeRawToken);
        if (!title) {
          title = fallbackNoteTitle;
        }

        events.push({
          id: `ev-${noteRelPath}-${lineIndex}-${validDate}`,
          kind: 'note',
          date: validDate,
          time: foundTime,
          title,
          noteUri: noteUri.toString(),
          notePath: noteRelPath,
          line: lineIndex,
          snippet: line.trim(),
        });
        continue;
      }
    }

    // Regex 2: German Date (e.g. 24.10.2026 or 24.10.26)
    const germanMatch = lineWithoutUrls.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b/);
    if (germanMatch) {
      const day = Number(germanMatch[1]);
      const month = Number(germanMatch[2]);
      let year = Number(germanMatch[3]);
      if (year < 100) year += 2000;
      const validDate = normalizeDate(year, month, day);

      if (validDate) {
        const rawToken = germanMatch[0];
        let title = cleanEventTitle(lineWithoutUrls, rawToken, timeRawToken);
        if (!title) {
          title = fallbackNoteTitle;
        }

        events.push({
          id: `ev-${noteRelPath}-${lineIndex}-${validDate}`,
          kind: 'note',
          date: validDate,
          time: foundTime,
          title,
          noteUri: noteUri.toString(),
          notePath: noteRelPath,
          line: lineIndex,
          snippet: line.trim(),
        });
      }
    }
  }

  return events;
}

export class CalendarService {
  constructor(private readonly folderTasksService: FolderTasksService = new FolderTasksService()) {}

  /**
   * Recursively discovers all Markdown notes inside notesRootUri.
   */
  async findMarkdownNotes(notesRootUri: vscode.Uri): Promise<vscode.Uri[]> {
    const results: vscode.Uri[] = [];

    const scanDir = async (dirUri: vscode.Uri) => {
      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(dirUri);
      } catch {
        return;
      }

      entries.sort((a, b) => a[0].localeCompare(b[0]));

      for (const [name, fileType] of entries) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'dist') {
          continue;
        }

        const entryUri = vscode.Uri.joinPath(dirUri, name);
        if (fileType === vscode.FileType.Directory) {
          await scanDir(entryUri);
        } else if (fileType === vscode.FileType.File && isMarkdownNote(name)) {
          results.push(entryUri);
        }
      }
    };

    await scanDir(notesRootUri);
    return results;
  }

  /**
   * Loads and aggregates all calendar entries (notes + tasks with dueDate) across notesRootUri.
   */
  async loadAllCalendarEntries(notesRootUri: vscode.Uri): Promise<CalendarEntry[]> {
    const entries: CalendarEntry[] = [];

    // 1. Scan all Markdown notes
    const noteUris = await this.findMarkdownNotes(notesRootUri);
    for (const noteUri of noteUris) {
      try {
        const rawBytes = await vscode.workspace.fs.readFile(noteUri);
        const content = Buffer.from(rawBytes).toString('utf-8');
        const noteEvents = extractNoteEventsFromMarkdown(content, noteUri, notesRootUri);
        entries.push(...noteEvents);
      } catch {
        // Skip unreadable files gracefully
      }
    }

    // 2. Load all tasks with dueDate
    try {
      const taskGroups = await this.folderTasksService.loadAllTasks(notesRootUri);
      for (const group of taskGroups) {
        for (const task of group.tasks) {
          if (task.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
            entries.push({
              id: `task-${task.id}`,
              kind: 'task',
              date: task.dueDate,
              title: task.title,
              taskId: task.id,
              completed: task.completed,
              priority: task.priority || 'medium',
              notePath: task.note,
              folder: group.folder,
              folderUri: group.uri.toString(),
            });
          }
        }
      }
    } catch {
      // Skip if task service fails
    }

    // 3. Sort entries chronologically: date asc, time asc (all-day/no-time first), title asc
    entries.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      if (a.time && b.time) {
        const timeCmp = a.time.localeCompare(b.time);
        if (timeCmp !== 0) return timeCmp;
      } else if (a.time) {
        return 1;
      } else if (b.time) {
        return -1;
      }
      return a.title.localeCompare(b.title);
    });

    return entries;
  }

  /**
   * Counts total scheduled entries (or upcoming entries).
   */
  async countCalendarEntries(notesRootUri: vscode.Uri): Promise<number> {
    const all = await this.loadAllCalendarEntries(notesRootUri);
    return all.length;
  }
}

