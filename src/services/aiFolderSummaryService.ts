import * as vscode from 'vscode';
import * as path from 'path';
import { AiModelService } from './aiModelService';
import { isMarkdownNote } from '../companion/companionPaths';
import { FolderTasksService } from './folderTasksService';

export interface FolderSummaryOptions {
  includeSubfolders?: boolean;
}

export interface SelectionItem {
  uri: vscode.Uri;
  isFolder: boolean;
}

export interface SelectionSummaryOptions {
  includeSubfolders?: boolean;
}

export interface DiscoveredNote {
  uri: vscode.Uri;
  relativePath: string;
  title: string;
  content: string;
}

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.vscode',
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
]);

const MAX_NOTES_FOR_SUMMARY = 30;
const MAX_NOTE_CONTENT_LENGTH = 1500;

export class AiFolderSummaryService {
  constructor(
    private readonly aiModelService: AiModelService,
    private readonly folderTasksService: FolderTasksService = new FolderTasksService()
  ) {}

  /**
   * Extracts note title from markdown content, falling back to clean filename.
   */
  public extractTitle(rawContent: string, fallbackName: string): string {
    const lines = rawContent.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
    return fallbackName.replace(/\.md$/i, '');
  }

  /**
   * Extracts preview snippet (first non-empty, non-heading paragraph).
   */
  public extractSnippet(rawContent: string, maxLength: number = 160): string {
    const lines = rawContent.split(/\r?\n/);
    const textLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) {
        continue;
      }
      textLines.push(trimmed);
      if (textLines.join(' ').length >= maxLength) {
        break;
      }
    }
    const joined = textLines.join(' ');
    if (joined.length <= maxLength) {
      return joined;
    }
    return joined.slice(0, maxLength).trimEnd() + '…';
  }

  /**
   * Scans folder for Markdown notes. If includeSubfolders is true, recursively traverses subdirectories.
   */
  public async discoverNotes(
    folderUri: vscode.Uri,
    includeSubfolders: boolean = false
  ): Promise<vscode.Uri[]> {
    const notes: vscode.Uri[] = [];

    const scan = async (dirUri: vscode.Uri, depth: number) => {
      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(dirUri);
      } catch {
        return;
      }

      entries.sort((a, b) => a[0].localeCompare(b[0]));

      for (const [name, fileType] of entries) {
        if (name.startsWith('.') || IGNORED_DIRECTORIES.has(name)) {
          continue;
        }

        const entryUri = vscode.Uri.joinPath(dirUri, name);
        if (fileType === vscode.FileType.Directory) {
          if (includeSubfolders) {
            await scan(entryUri, depth + 1);
          }
        } else if (fileType === vscode.FileType.File && isMarkdownNote(name)) {
          notes.push(entryUri);
        }
      }
    };

    await scan(folderUri, 0);
    return notes;
  }

  /**
   * Builds the prompt and calls the active AI model to synthesize folder notes.
   */
  public async generateFolderSummary(
    folderUri: vscode.Uri,
    options: FolderSummaryOptions = {},
    token?: vscode.CancellationToken
  ): Promise<string> {
    const includeSubfolders = !!options.includeSubfolders;
    const noteUris = await this.discoverNotes(folderUri, includeSubfolders);

    if (noteUris.length === 0) {
      return 'In diesem Ordner wurden keine Markdown-Notizen gefunden.';
    }

    const folderName = path.basename(folderUri.fsPath) || 'Ordner';
    const notesToProcess = noteUris.slice(0, MAX_NOTES_FOR_SUMMARY);

    const notesData: DiscoveredNote[] = [];
    for (const noteUri of notesToProcess) {
      try {
        const rawBytes = await vscode.workspace.fs.readFile(noteUri);
        const rawContent = Buffer.from(rawBytes).toString('utf-8');
        const relativePath = path.relative(folderUri.fsPath, noteUri.fsPath) || path.basename(noteUri.fsPath);
        const title = this.extractTitle(rawContent, path.basename(noteUri.fsPath));
        const truncated =
          rawContent.length > MAX_NOTE_CONTENT_LENGTH
            ? rawContent.slice(0, MAX_NOTE_CONTENT_LENGTH) + '\n[...Inhalt gekürzt...]'
            : rawContent;
        notesData.push({
          uri: noteUri,
          relativePath,
          title,
          content: truncated,
        });
      } catch {
        // Skip unreadable files
      }
    }

    let tasksContext = '';
    try {
      const tasksUri = vscode.Uri.joinPath(folderUri, 'tasks.json');
      const tasks = await this.folderTasksService.loadFolderTasks(tasksUri);
      if (tasks && tasks.length > 0) {
        const open = tasks.filter((t) => !t.completed);
        const completed = tasks.filter((t) => t.completed);
        tasksContext = [
          `\nStatus der Ordner-Aufgaben (${open.length} offen, ${completed.length} erledigt):`,
          ...open.slice(0, 10).map((t) => `- [ ] ${t.title}${t.priority ? ` [Prio: ${t.priority}]` : ''}`),
        ].join('\n');
      }
    } catch {
      // No tasks companion
    }

    const systemPrompt = [
      'Du bist ein strukturierter KI-Assistent in Janus Note.',
      'Erstelle eine präzise, übersichtliche und nützliche Zusammenfassung für den gegebenen Ordner.',
      'Verwende Markdown und folgende Abschnitte (auf Deutsch):',
      '### 🎯 Kerninhalte & Themen',
      '### 📌 Wichtige Meilensteine & Entscheidungen',
      '### ⚡ Offene Punkte & nächste Schritte',
      'Halte dich an die Fakten aus den Notizen und Aufgaben. Falls ein Abschnitt nicht zutrifft, fasse ihn kurz zusammen oder lasse ihn weg.',
    ].join('\n');

    const notesSummaryText = notesData
      .map((n) => `--- Notiz: ${n.relativePath} ("${n.title}") ---\n${n.content}`)
      .join('\n\n');

    const userPrompt = [
      `Ordner: ${folderName}`,
      `Umfang: ${includeSubfolders ? 'Mit Unterordnern' : 'Nur direkter Ordner'}`,
      `Gefundene Notizen (${notesData.length}):`,
      '',
      notesSummaryText,
      tasksContext ? `\n${tasksContext}` : '',
    ].join('\n');

    const response = await this.aiModelService.completePrompt(systemPrompt, userPrompt, token);
    return response.trim();
  }

  /**
   * Builds the prompt and calls the active AI model to synthesize a custom multi-item selection.
   */
  public async generateSelectionSummary(
    items: SelectionItem[],
    options: SelectionSummaryOptions = {},
    token?: vscode.CancellationToken
  ): Promise<string> {
    const includeSubfolders = !!options.includeSubfolders;
    const discoveredUris: vscode.Uri[] = [];
    const foldersToCheckTasks = new Set<string>();

    for (const item of items) {
      if (item.isFolder) {
        foldersToCheckTasks.add(item.uri.fsPath);
        const folderNotes = await this.discoverNotes(item.uri, includeSubfolders);
        discoveredUris.push(...folderNotes);
      } else if (isMarkdownNote(item.uri.fsPath)) {
        discoveredUris.push(item.uri);
        foldersToCheckTasks.add(path.dirname(item.uri.fsPath));
      }
    }

    const uniqueUris: vscode.Uri[] = [];
    const seenPaths = new Set<string>();
    for (const uri of discoveredUris) {
      if (!seenPaths.has(uri.fsPath)) {
        seenPaths.add(uri.fsPath);
        uniqueUris.push(uri);
      }
    }

    if (uniqueUris.length === 0) {
      return 'In der aktuellen Auswahl wurden keine Markdown-Notizen gefunden.';
    }

    const notesToProcess = uniqueUris.slice(0, MAX_NOTES_FOR_SUMMARY);
    const notesData: DiscoveredNote[] = [];
    for (const noteUri of notesToProcess) {
      try {
        const rawBytes = await vscode.workspace.fs.readFile(noteUri);
        const rawContent = Buffer.from(rawBytes).toString('utf-8');
        const baseName = path.basename(noteUri.fsPath);
        const title = this.extractTitle(rawContent, baseName);
        const truncated =
          rawContent.length > MAX_NOTE_CONTENT_LENGTH
            ? rawContent.slice(0, MAX_NOTE_CONTENT_LENGTH) + '\n[...Inhalt gekürzt...]'
            : rawContent;
        notesData.push({
          uri: noteUri,
          relativePath: baseName,
          title,
          content: truncated,
        });
      } catch {
        // Skip unreadable files
      }
    }

    let tasksContext = '';
    const allTasks: any[] = [];
    for (const folderPath of foldersToCheckTasks) {
      try {
        const tasksUri = vscode.Uri.joinPath(vscode.Uri.file(folderPath), 'tasks.json');
        const tasks = await this.folderTasksService.loadFolderTasks(tasksUri);
        if (tasks && tasks.length > 0) {
          allTasks.push(...tasks);
        }
      } catch {}
    }

    if (allTasks.length > 0) {
      const open = allTasks.filter((t) => !t.completed);
      const completed = allTasks.filter((t) => t.completed);
      tasksContext = [
        `\nStatus der Aufgaben in der Auswahl (${open.length} offen, ${completed.length} erledigt):`,
        ...open.slice(0, 10).map((t) => `- [ ] ${t.title}${t.priority ? ` [Prio: ${t.priority}]` : ''}`),
      ].join('\n');
    }

    const systemPrompt = [
      'Du bist ein strukturierter KI-Assistent in Janus Note.',
      'Erstelle eine präzise, übersichtliche und nützliche Zusammenfassung für die ausgewählten Notizen und Ordner.',
      'Verwende Markdown und folgende Abschnitte (auf Deutsch):',
      '### 🎯 Kerninhalte & Themen',
      '### 📌 Wichtige Meilensteine & Entscheidungen',
      '### ⚡ Offene Punkte & nächste Schritte',
      'Halte dich an die Fakten aus den Notizen und Aufgaben. Falls ein Abschnitt nicht zutrifft, fasse ihn kurz zusammen oder lasse ihn weg.',
    ].join('\n');

    const notesSummaryText = notesData
      .map((n) => `--- Notiz: ${n.title} (${path.basename(n.uri.fsPath)}) ---\n${n.content}`)
      .join('\n\n');

    const userPrompt = [
      `Umfang: Auswahl von ${items.length} Elementen (${uniqueUris.length} Notizen insgesamt)`,
      `Unterordner: ${includeSubfolders ? 'Einbezogen' : 'Nicht einbezogen'}`,
      `Notizen:`,
      '',
      notesSummaryText,
      tasksContext ? `\n${tasksContext}` : '',
    ].join('\n');

    const response = await this.aiModelService.completePrompt(systemPrompt, userPrompt, token);
    return response.trim();
  }
}

