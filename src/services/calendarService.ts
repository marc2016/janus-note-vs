import * as vscode from 'vscode';
import * as path from 'path';
import { FolderTasksService } from './folderTasksService';
import { isMarkdownNote } from '../companion/companionPaths';
import { DAILY_NOTE_TEMPLATE, isDailyNotePath } from './dailyNotePaths';
import { findSortedLinks } from './sortedLinkScan';
import { listTemplates } from './noteTemplateService';

export type CalendarEntryKind = 'note' | 'task' | 'journal';
export type TaskDateKind = 'due' | 'scheduled';

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
  dateKind?: TaskDateKind;
  taskId?: string;
  completed?: boolean;
  // For journal entries: the block was already sorted (`-> [[…]]` line)
  sorted?: boolean;
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

export interface NoteEventOptions {
  /** Heading patterns of the `tagesnotiz` template; matching daily note headings are not journal entries. */
  dailyTemplateHeadings?: RegExp[];
}

const JOURNAL_HEADING_RE = /^(#{1,2})\s+(.+?)\s*$/;
const HEADING_TIME_RE = /\s*\((\d{2}:\d{2})\)$/;

/**
 * Turns the template's `#`/`##` heading texts into patterns; `{{…}}` placeholders match any text.
 * The template's title (first `#` heading) is left out: it becomes the note's title, which is never
 * a journal entry, and a placeholder title like `# {{weekday}}` would otherwise match every heading.
 */
export function templateHeadingPatterns(templateText: string): RegExp[] {
  const patterns: RegExp[] = [];
  let inCode = false;
  let titleSeen = false;
  for (const line of templateText.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode;
      continue;
    }
    const match = !inCode && line.match(JOURNAL_HEADING_RE);
    if (!match) continue;
    if (match[1] === '#' && !titleSeen) {
      titleSeen = true;
      continue;
    }
    const source = match[2]
      .split(/\{\{[^}]*\}\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.+');
    patterns.push(new RegExp(`^${source}$`));
  }
  return patterns;
}

/**
 * Journal entries of a daily note: its `#` and `##` headings outside frontmatter and fenced code,
 * without the title (first `#` heading) and without headings that match the daily note template.
 */
export function extractJournalEntries(
  content: string,
  date: string,
  noteUri: vscode.Uri,
  noteRelPath: string,
  templateHeadings: RegExp[] = []
): CalendarEntry[] {
  const lines = content.split(/\r?\n/);
  const fm = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  const firstBodyLine = fm ? fm[0].split(/\r?\n/).length - (fm[0].endsWith('\n') ? 1 : 0) : 0;
  const sortedHeadingLines = new Set(
    findSortedLinks(content)
      .map((link) => link.headingLine)
      .filter((line): line is number => line !== undefined)
  );
  const entries: CalendarEntry[] = [];
  let inCode = false;
  let titleSeen = false;
  for (let i = firstBodyLine; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = line.match(JOURNAL_HEADING_RE);
    if (!match) continue;
    if (match[1] === '#' && !titleSeen) {
      titleSeen = true;
      continue;
    }
    const text = match[2];
    if (templateHeadings.some((pattern) => pattern.test(text))) continue;
    const timeMatch = text.match(HEADING_TIME_RE);
    const title = timeMatch ? text.slice(0, timeMatch.index).trim() : text;
    if (!title) continue;
    entries.push({
      id: `journal-${noteRelPath}-${i + 1}`,
      kind: 'journal',
      date,
      time: timeMatch?.[1],
      title,
      noteUri: noteUri.toString(),
      notePath: noteRelPath,
      line: i + 1,
      sorted: sortedHeadingLines.has(i),
    });
  }
  return entries;
}

export function extractNoteEventsFromMarkdown(
  content: string,
  noteUri: vscode.Uri,
  notesRootUri?: vscode.Uri,
  options: NoteEventOptions = {}
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

  // Daily notes (journal/YYYY-MM-DD.md) appear on their date even without a date in the content
  const dailyNoteDate = isDailyNotePath(noteRelPath);
  if (dailyNoteDate && !events.some((e) => e.date === dailyNoteDate)) {
    events.push({
      id: `ev-daily-${noteRelPath}`,
      kind: 'note',
      date: dailyNoteDate,
      title: headingMatch ? headingMatch[1].trim() : 'Tagesnotiz',
      noteUri: noteUri.toString(),
      notePath: noteRelPath,
      line: 1,
    });
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

  // A daily note's own date in a heading (e.g. `# Donnerstag, 29.10.2026`) is not an appointment
  if (dailyNoteDate) {
    const appointments = events.filter(
      (e) => !(e.date === dailyNoteDate && e.id.startsWith(`ev-${noteRelPath}-`) && /^#+\s/.test(lines[(e.line ?? 0) - 1] ?? ''))
    );
    const journal = extractJournalEntries(content, dailyNoteDate, noteUri, noteRelPath, options.dailyTemplateHeadings);
    if (journal.length === 0) return appointments;
    // The journal entries represent the note; drop its whole-note and frontmatter-date entries
    const wholeNoteIds = new Set([`ev-daily-${noteRelPath}`, `ev-fm-${noteRelPath}-${dailyNoteDate}`]);
    return [...appointments.filter((e) => !wholeNoteIds.has(e.id)), ...journal];
  }
  return events;
}

export class CalendarService {
  constructor(private readonly folderTasksService: FolderTasksService = new FolderTasksService()) {}

  /** Heading patterns of the `tagesnotiz` template, or none when it does not exist. */
  async loadDailyTemplateHeadings(notesRootUri: vscode.Uri): Promise<RegExp[]> {
    try {
      const template = (await listTemplates(notesRootUri)).find((t) => t.name.toLowerCase() === DAILY_NOTE_TEMPLATE);
      if (!template) return [];
      const text = Buffer.from(await vscode.workspace.fs.readFile(template.uri)).toString('utf-8');
      return templateHeadingPatterns(text);
    } catch {
      return [];
    }
  }

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
   * Loads and aggregates all calendar entries (notes + tasks with due/scheduled dates) across notesRootUri.
   */
  async loadAllCalendarEntries(notesRootUri: vscode.Uri): Promise<CalendarEntry[]> {
    const entries: CalendarEntry[] = [];

    // 1. Scan all Markdown notes
    const options: NoteEventOptions = { dailyTemplateHeadings: await this.loadDailyTemplateHeadings(notesRootUri) };
    const noteUris = await this.findMarkdownNotes(notesRootUri);
    for (const noteUri of noteUris) {
      try {
        const rawBytes = await vscode.workspace.fs.readFile(noteUri);
        const content = Buffer.from(rawBytes).toString('utf-8');
        const noteEvents = extractNoteEventsFromMarkdown(content, noteUri, notesRootUri, options);
        entries.push(...noteEvents);
      } catch {
        // Skip unreadable files gracefully
      }
    }

    // 2. Load all tasks with a due and/or scheduled date (one entry per date)
    try {
      const taskGroups = await this.folderTasksService.loadAllTasks(notesRootUri);
      for (const group of taskGroups) {
        const folderUri = group.uri.toString();
        for (const task of group.tasks) {
          const dates: Array<[TaskDateKind, string | undefined]> = [
            ['due', task.dueDate],
            ['scheduled', task.scheduledDate],
          ];
          for (const [dateKind, date] of dates) {
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
            entries.push({
              id: `task-${dateKind}-${folderUri}-${task.id}`,
              kind: 'task',
              dateKind,
              date,
              title: task.title,
              taskId: task.id,
              completed: task.completed,
              priority: task.priority || 'medium',
              notePath: task.note,
              folder: group.folder,
              folderUri,
            });
          }
        }
      }
    } catch {
      // Skip if task service fails
    }

    // 3. Sort entries chronologically: date asc, time asc (all-day/no-time first), title asc.
    //    Journal entries come after appointments and tasks of their day, in the order of the note.
    entries.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const journalCmp = Number(a.kind === 'journal') - Number(b.kind === 'journal');
      if (journalCmp !== 0) return journalCmp;
      if (a.kind === 'journal' && b.kind === 'journal') {
        return (a.notePath ?? '').localeCompare(b.notePath ?? '') || (a.line ?? 0) - (b.line ?? 0);
      }
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

