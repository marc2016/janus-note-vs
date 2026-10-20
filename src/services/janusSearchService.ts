import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';
import { FolderTasksService } from './folderTasksService';
import { findMarkdownNotesInRoot } from './noteLinkService';
import { extractMeaningfulInboxBody } from './aiInboxSorterService';
import { TaskItem, TaskPriority, TaskStatus } from '../models/tasks';

export interface NoteSearchMatch {
  title: string;
  relativePath: string;
  uri: vscode.Uri;
  score: number;
  snippet: string;
  headings: string[];
}

export interface TaskSearchMatch {
  id: string;
  title: string;
  completed: boolean;
  status: TaskStatus;
  priority: TaskPriority;
  folder: string;
  note?: string;
  tasksUri: vscode.Uri;
  score: number;
}

export interface WorkspaceOverviewNote {
  title: string;
  relativePath: string;
  uri: vscode.Uri;
  preview: string;
}

export interface WorkspaceSearchResult {
  query: string;
  tokens: string[];
  notesRootUri?: vscode.Uri;
  noteMatches: NoteSearchMatch[];
  taskMatches: TaskSearchMatch[];
  fallbackOverview?: {
    totalNotes: number;
    totalOpenTasks: number;
    notes: WorkspaceOverviewNote[];
    openTasks: TaskSearchMatch[];
  };
}

export interface SummarizeNoteEntry {
  title: string;
  relativePath: string;
  uri: vscode.Uri;
  content: string;
}

export interface SummarizeContextResult {
  targetType: 'note' | 'folder';
  targetLabel: string;
  targetUri: vscode.Uri;
  notes: SummarizeNoteEntry[];
  tasks: TaskItem[];
  tasksUri?: vscode.Uri;
}

export interface InboxContextResult {
  inboxUri: vscode.Uri;
  exists: boolean;
  isEmpty: boolean;
  rawContent: string;
  meaningfulContent: string;
}

const STOPWORDS = new Set([
  // German stopwords & conversational fillers
  'wo',
  'was',
  'wie',
  'wann',
  'wer',
  'warum',
  'welche',
  'welcher',
  'welches',
  'welchen',
  'steht',
  'stehen',
  'stand',
  'etwas',
  'gib',
  'gibt',
  'es',
  'mir',
  'uns',
  'wir',
  'ich',
  'du',
  'mein',
  'meine',
  'meinen',
  'meiner',
  'meinem',
  'dein',
  'deine',
  'unser',
  'unsere',
  'in',
  'im',
  'ins',
  'zu',
  'zum',
  'zur',
  'von',
  'vom',
  'mit',
  'auf',
  'fuer',
  'für',
  'ueber',
  'über',
  'aus',
  'bei',
  'nach',
  'vor',
  'unter',
  'und',
  'oder',
  'aber',
  'auch',
  'noch',
  'schon',
  'mal',
  'bitte',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'ist',
  'sind',
  'war',
  'waren',
  'haben',
  'hat',
  'hatten',
  'wird',
  'werden',
  'wurde',
  'notiz',
  'notizen',
  'ordner',
  'datei',
  'dateien',
  'suche',
  'suchen',
  'finde',
  'finden',
  'zeig',
  'zeige',
  'alle',
  'alles',
  'dazu',
  'thema',
  // English stopwords & conversational fillers
  'what',
  'where',
  'when',
  'who',
  'why',
  'how',
  'which',
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'about',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'my',
  'our',
  'your',
  'me',
  'we',
  'note',
  'notes',
  'folder',
  'search',
  'find',
  'show',
  'all',
  'any',
  'some',
  'please',
]);

function stripExtension(filename: string): string {
  return filename.replace(/\.(md|markdown)$/i, '');
}

/**
 * Extracts normalized search tokens from a natural-language query or keyword string.
 */
export function tokenizeSearchQuery(query: string): string[] {
  const normalized = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  const rawTokens = normalized.split(/\s+/);
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const token of rawTokens) {
    const clean = token.replace(/^[-_]+|[-_]+$/g, '');
    if (!clean) {
      continue;
    }
    if (clean.length < 2 && !/^\d+$/.test(clean)) {
      continue;
    }
    if (STOPWORDS.has(clean)) {
      continue;
    }
    if (!seen.has(clean)) {
      seen.add(clean);
      tokens.push(clean);
    }
  }

  return tokens;
}

/**
 * Extracts Markdown headings (`#` .. `######`) from raw Markdown content.
 */
export function extractMarkdownHeadings(content: string): string[] {
  const headings: string[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (match) {
      headings.push(match[1].trim());
    }
  }
  return headings;
}

/**
 * Extracts a contextual snippet around the best matching paragraph or heading.
 */
export function extractRelevantSnippet(
  content: string,
  tokens: string[],
  maxLength: number = 380
): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  const blocks = trimmed
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (blocks.length === 0) {
    return trimmed.slice(0, maxLength);
  }

  if (tokens.length === 0) {
    const preview = blocks.slice(0, 2).join('\n\n');
    return preview.length > maxLength ? `${preview.slice(0, maxLength - 3)}...` : preview;
  }

  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < blocks.length; i++) {
    const lowerBlock = blocks[i].toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (lowerBlock.includes(token)) {
        score += /^#{1,6}\s+/.test(blocks[i]) ? 3 : 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // If the best block is a heading, include the following paragraph for context
  let snippet = blocks[bestIdx];
  if (/^#{1,6}\s+/.test(snippet) && bestIdx + 1 < blocks.length) {
    snippet = `${snippet}\n${blocks[bestIdx + 1]}`;
  } else if (bestIdx > 0 && /^#{1,6}\s+/.test(blocks[bestIdx - 1])) {
    snippet = `${blocks[bestIdx - 1]}\n${snippet}`;
  }

  if (snippet.length > maxLength) {
    return `${snippet.slice(0, maxLength - 3)}...`;
  }
  return snippet;
}

export class JanusSearchService {
  constructor(
    private readonly companionManager: CompanionManager = new CompanionManager(),
    private readonly folderTasksService: FolderTasksService = new FolderTasksService()
  ) {}

  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Searches all Markdown notes and folder `tasks.json` files inside `notesRoot`.
   */
  public async searchWorkspace(
    query: string,
    options?: {
      maxNotes?: number;
      maxTasks?: number;
      contextUri?: vscode.Uri;
    }
  ): Promise<WorkspaceSearchResult> {
    const maxNotes = options?.maxNotes ?? 8;
    const maxTasks = options?.maxTasks ?? 10;
    const notesRootUri = this.companionManager.getNotesRootUri(options?.contextUri);
    const tokens = tokenizeSearchQuery(query);
    const fullPhrase = tokens.length > 1 ? tokens.join(' ') : '';

    if (!notesRootUri) {
      return {
        query,
        tokens,
        noteMatches: [],
        taskMatches: [],
      };
    }

    const [noteUris, taskGroups] = await Promise.all([
      findMarkdownNotesInRoot(notesRootUri),
      this.folderTasksService.loadAllTasks(notesRootUri),
    ]);

    const allNotesData: Array<{
      title: string;
      relativePath: string;
      uri: vscode.Uri;
      content: string;
      headings: string[];
    }> = [];

    for (const uri of noteUris) {
      let content = '';
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        content = Buffer.from(bytes).toString('utf-8');
      } catch {
        continue;
      }

      const relPath = path.relative(notesRootUri.fsPath, uri.fsPath).replace(/\\/g, '/');
      const headings = extractMarkdownHeadings(content);
      const baseTitle = stripExtension(path.basename(uri.fsPath));
      const h1Title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const title = h1Title || baseTitle;

      allNotesData.push({
        title,
        relativePath: relPath,
        uri,
        content,
        headings,
      });
    }

    const noteMatches: NoteSearchMatch[] = [];
    const taskMatches: TaskSearchMatch[] = [];

    if (tokens.length > 0) {
      for (const note of allNotesData) {
        const titleLower = `${note.title} ${stripExtension(path.basename(note.uri.fsPath))}`.toLowerCase();
        const pathLower = note.relativePath.toLowerCase();
        const headingsLower = note.headings.join(' \n ').toLowerCase();
        const bodyLower = note.content.toLowerCase();

        let score = 0;

        if (fullPhrase) {
          if (titleLower.includes(fullPhrase)) score += 12;
          if (headingsLower.includes(fullPhrase)) score += 8;
          if (bodyLower.includes(fullPhrase)) score += 5;
        }

        for (const token of tokens) {
          if (titleLower === token) {
            score += 10;
          } else if (titleLower.includes(token)) {
            score += 5;
          }

          if (pathLower.includes(token)) {
            score += 4;
          }

          if (headingsLower.includes(token)) {
            score += 6;
          }

          // Count occurrences in body (capped at 3 occurrences per token)
          let idx = bodyLower.indexOf(token);
          let count = 0;
          while (idx !== -1 && count < 3) {
            count++;
            idx = bodyLower.indexOf(token, idx + token.length);
          }
          score += count * 2;
        }

        if (score > 0) {
          noteMatches.push({
            title: note.title,
            relativePath: note.relativePath,
            uri: note.uri,
            score,
            snippet: extractRelevantSnippet(note.content, tokens),
            headings: note.headings,
          });
        }
      }

      for (const group of taskGroups) {
        for (const task of group.tasks) {
          const titleLower = task.title.toLowerCase();
          const folderLower = group.folder.toLowerCase();
          const noteLower = (task.note || '').toLowerCase();

          let score = 0;
          if (fullPhrase && titleLower.includes(fullPhrase)) {
            score += 10;
          }

          for (const token of tokens) {
            if (titleLower.includes(token)) score += 6;
            if (folderLower.includes(token)) score += 3;
            if (noteLower.includes(token)) score += 3;
          }

          if (score > 0) {
            taskMatches.push({
              id: task.id,
              title: task.title,
              completed: task.completed,
              status: task.status,
              priority: task.priority || 'medium',
              folder: group.folder,
              note: task.note,
              tasksUri: group.uri,
              score,
            });
          }
        }
      }
    }

    noteMatches.sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath));
    taskMatches.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    const limitedNotes = noteMatches.slice(0, maxNotes);
    const limitedTasks = taskMatches.slice(0, maxTasks);

    let fallbackOverview: WorkspaceSearchResult['fallbackOverview'];
    if (limitedNotes.length === 0 && limitedTasks.length === 0) {
      const openTasks: TaskSearchMatch[] = [];
      for (const group of taskGroups) {
        for (const task of group.tasks) {
          if (!task.completed && task.status !== 'done') {
            openTasks.push({
              id: task.id,
              title: task.title,
              completed: task.completed,
              status: task.status,
              priority: task.priority || 'medium',
              folder: group.folder,
              note: task.note,
              tasksUri: group.uri,
              score: 1,
            });
          }
        }
      }

      fallbackOverview = {
        totalNotes: allNotesData.length,
        totalOpenTasks: openTasks.length,
        notes: allNotesData.slice(0, maxNotes).map((n) => ({
          title: n.title,
          relativePath: n.relativePath,
          uri: n.uri,
          preview: extractRelevantSnippet(n.content, [], 200),
        })),
        openTasks: openTasks.slice(0, maxTasks),
      };
    }

    return {
      query,
      tokens,
      notesRootUri,
      noteMatches: limitedNotes,
      taskMatches: limitedTasks,
      fallbackOverview,
    };
  }

  /**
   * Resolves a target note or folder path (or falls back to the active editor note)
   * and aggregates its Markdown notes and folder tasks for `/summarize`.
   */
  public async getSummarizeContext(
    targetPrompt?: string,
    activeDocUri?: vscode.Uri
  ): Promise<SummarizeContextResult | null> {
    const notesRootUri = this.companionManager.getNotesRootUri(activeDocUri);
    const cleanPrompt = (targetPrompt || '').trim();

    // 1. Try resolving explicit path/name inside notesRoot if provided
    if (cleanPrompt && notesRootUri) {
      const candidateRel = cleanPrompt.replace(/^(\.\/|\/)+/, '').replace(/\\/g, '/');
      const directCandidateUri = vscode.Uri.joinPath(
        notesRootUri,
        ...candidateRel.split('/').filter(Boolean)
      );

      // Check if candidate is a directory
      try {
        const stat = await vscode.workspace.fs.stat(directCandidateUri);
        if (stat.type === vscode.FileType.Directory) {
          return this.collectFolderSummarizeContext(directCandidateUri, notesRootUri);
        }
        if (stat.type === vscode.FileType.File && isMarkdownNote(directCandidateUri.fsPath)) {
          return this.collectSingleNoteSummarizeContext(directCandidateUri, notesRootUri);
        }
      } catch {
        // Try appending .md
        const mdCandidateUri = vscode.Uri.file(`${directCandidateUri.fsPath}.md`);
        if (await this.fileExists(mdCandidateUri)) {
          return this.collectSingleNoteSummarizeContext(mdCandidateUri, notesRootUri);
        }
      }

      // Fuzzy match against existing folders or notes by basename / path substring
      const allNotes = await findMarkdownNotesInRoot(notesRootUri);
      const lowerQuery = candidateRel.toLowerCase();

      // Check matching folder prefix
      const folderNotes = allNotes.filter((u) => {
        const relDir = path
          .dirname(path.relative(notesRootUri.fsPath, u.fsPath))
          .replace(/\\/g, '/')
          .toLowerCase();
        return relDir === lowerQuery || relDir.endsWith(`/${lowerQuery}`);
      });

      if (folderNotes.length > 0) {
        const matchedFolderUri = vscode.Uri.file(path.dirname(folderNotes[0].fsPath));
        return this.collectFolderSummarizeContext(matchedFolderUri, notesRootUri);
      }

      // Check matching note basename
      const matchedNote = allNotes.find((u) => {
        const rel = path.relative(notesRootUri.fsPath, u.fsPath).replace(/\\/g, '/').toLowerCase();
        const base = stripExtension(path.basename(u.fsPath)).toLowerCase();
        return rel === lowerQuery || base === lowerQuery || base.includes(lowerQuery);
      });

      if (matchedNote) {
        return this.collectSingleNoteSummarizeContext(matchedNote, notesRootUri);
      }
    }

    // 2. Fallback to active document
    const effectiveActiveUri = activeDocUri || vscode.window.activeTextEditor?.document.uri;
    if (effectiveActiveUri && isMarkdownNote(effectiveActiveUri.fsPath)) {
      return this.collectSingleNoteSummarizeContext(effectiveActiveUri, notesRootUri);
    }

    return null;
  }

  private async collectSingleNoteSummarizeContext(
    noteUri: vscode.Uri,
    notesRootUri?: vscode.Uri
  ): Promise<SummarizeContextResult> {
    const bytes = await vscode.workspace.fs.readFile(noteUri);
    const content = Buffer.from(bytes).toString('utf-8');
    const relPath = notesRootUri
      ? path.relative(notesRootUri.fsPath, noteUri.fsPath).replace(/\\/g, '/')
      : path.basename(noteUri.fsPath);
    const title = stripExtension(path.basename(noteUri.fsPath));

    const folderDir = path.dirname(noteUri.fsPath);
    const tasksUri = vscode.Uri.file(path.join(folderDir, 'tasks.json'));
    const hasTasks = await this.fileExists(tasksUri);
    const tasks = hasTasks ? await this.folderTasksService.loadFolderTasks(tasksUri) : [];

    return {
      targetType: 'note',
      targetLabel: relPath,
      targetUri: noteUri,
      notes: [
        {
          title,
          relativePath: relPath,
          uri: noteUri,
          content,
        },
      ],
      tasks,
      tasksUri: hasTasks ? tasksUri : undefined,
    };
  }

  private async collectFolderSummarizeContext(
    folderUri: vscode.Uri,
    notesRootUri: vscode.Uri
  ): Promise<SummarizeContextResult> {
    const noteUris = await findMarkdownNotesInRoot(folderUri);
    const notes: SummarizeNoteEntry[] = [];

    for (const uri of noteUris) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(bytes).toString('utf-8');
        const relPath = path.relative(notesRootUri.fsPath, uri.fsPath).replace(/\\/g, '/');
        notes.push({
          title: stripExtension(path.basename(uri.fsPath)),
          relativePath: relPath,
          uri,
          content,
        });
      } catch {
        // Ignore unreadable files
      }
    }

    const tasksUri = vscode.Uri.joinPath(folderUri, 'tasks.json');
    const hasTasks = await this.fileExists(tasksUri);
    const tasks = hasTasks ? await this.folderTasksService.loadFolderTasks(tasksUri) : [];
    const relFolder =
      path.relative(notesRootUri.fsPath, folderUri.fsPath).replace(/\\/g, '/') ||
      path.basename(folderUri.fsPath);

    return {
      targetType: 'folder',
      targetLabel: relFolder,
      targetUri: folderUri,
      notes,
      tasks,
      tasksUri: hasTasks ? tasksUri : undefined,
    };
  }

  /**
   * Reads `<notesRoot>/inbox.md` and returns its structured content for `/inbox`.
   */
  public async getInboxContext(contextUri?: vscode.Uri): Promise<InboxContextResult | null> {
    const notesRootUri = this.companionManager.getNotesRootUri(contextUri);
    if (!notesRootUri) {
      return null;
    }

    const inboxUri = vscode.Uri.joinPath(notesRootUri, 'inbox.md');
    const exists = await this.fileExists(inboxUri);
    if (!exists) {
      return {
        inboxUri,
        exists: false,
        isEmpty: true,
        rawContent: '',
        meaningfulContent: '',
      };
    }

    const bytes = await vscode.workspace.fs.readFile(inboxUri);
    const rawContent = Buffer.from(bytes).toString('utf-8');
    const meaningfulContent = extractMeaningfulInboxBody(rawContent);

    return {
      inboxUri,
      exists: true,
      isEmpty: meaningfulContent.length === 0,
      rawContent,
      meaningfulContent,
    };
  }
}

