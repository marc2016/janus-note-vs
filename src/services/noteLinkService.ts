import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';
import { parseTasksCompanion } from '../models/tasks';

export interface ExtractedLink {
  raw: string;
  target: string;
  label: string;
  type: 'wiki' | 'markdown';
}

export interface NoteLinkItem {
  title: string;
  target: string;
  uri: string;
  relativePath: string;
  exists: boolean;
  viewType?: string;
}

export interface CompanionSummary {
  tasks?: {
    exists: boolean;
    uri: string;
    openCount: number;
    completedCount: number;
    totalCount: number;
    label: string;
  };
  chart?: {
    exists: boolean;
    uri: string;
    label: string;
  };
}

export interface NoteLinksData {
  noteUri: string;
  companions: CompanionSummary;
  outgoingLinks: NoteLinkItem[];
  backlinks: NoteLinkItem[];
  aiModel?: {
    provider: string;
    modelId: string;
    label: string;
  };
}

const EXTERNAL_PROTOCOL_RE = /^(https?:|mailto:|tel:|vscode:|data:|#)/i;

function stripExtension(filename: string): string {
  return filename.replace(/\.(md|markdown)$/i, '');
}

function ensureNoteExtension(target: string): string {
  if (/\.[a-z0-9]+$/i.test(target)) {
    return target;
  }
  return `${target}.md`;
}

/**
 * Extracts outgoing wiki-links `[[Target]]` / `[[Target|Label]]` and
 * Markdown links `[Label](target.md)` from raw Markdown text.
 */
export function extractDocumentLinks(text: string): ExtractedLink[] {
  const results: ExtractedLink[] = [];
  const seenTargets = new Set<string>();

  // 1. Wiki-links: [[Target]] or [[Target|Alias]]
  const wikiRe = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = wikiRe.exec(text)) !== null) {
    const target = match[1].trim();
    const label = (match[2] || match[1]).trim();
    if (!target || EXTERNAL_PROTOCOL_RE.test(target)) {
      continue;
    }
    const key = target.toLowerCase();
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      results.push({
        raw: match[0],
        target,
        label,
        type: 'wiki',
      });
    }
  }

  // 2. Standard Markdown links (excluding images ![alt](url)): [Label](Target)
  const mdRe = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = mdRe.exec(text)) !== null) {
    const label = match[1].trim();
    let rawTarget = match[2].trim();
    // Strip optional title attribute: e.g. path/to/note.md "Title"
    rawTarget = rawTarget.split(/\s+["']/)[0].trim();
    // Strip anchor fragment: e.g. note.md#section
    const targetWithoutHash = rawTarget.split('#')[0].trim();
    if (!targetWithoutHash || EXTERNAL_PROTOCOL_RE.test(rawTarget)) {
      continue;
    }
    const key = targetWithoutHash.toLowerCase();
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      results.push({
        raw: match[0],
        target: targetWithoutHash,
        label: label || targetWithoutHash,
        type: 'markdown',
      });
    }
  }

  return results;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  'openspec',
  'vendor',
  'target',
]);

/**
 * Recursively discovers all Markdown note files under `notesRootUri`.
 */
export async function findMarkdownNotesInRoot(
  notesRootUri: vscode.Uri,
  maxDepth: number = 5
): Promise<vscode.Uri[]> {
  const notes: vscode.Uri[] = [];

  const scan = async (dirUri: vscode.Uri, depth: number) => {
    if (depth > maxDepth) {
      return;
    }
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
      return;
    }

    entries.sort((a, b) => a[0].localeCompare(b[0]));

    for (const [name, fileType] of entries) {
      if (name.startsWith('.') || IGNORED_DIRS.has(name)) {
        continue;
      }
      const entryUri = vscode.Uri.joinPath(dirUri, name);
      if (fileType === vscode.FileType.Directory) {
        await scan(entryUri, depth + 1);
      } else if (fileType === vscode.FileType.File && isMarkdownNote(name)) {
        notes.push(entryUri);
      }
    }
  };

  await scan(notesRootUri, 0);
  return notes;
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a link target string to a `vscode.Uri` and checks whether it exists.
 */
export async function resolveOutgoingLink(
  link: ExtractedLink,
  sourceNoteUri: vscode.Uri,
  notesRootUri?: vscode.Uri,
  workspaceNotes?: vscode.Uri[]
): Promise<NoteLinkItem> {
  const normalizedTarget = ensureNoteExtension(link.target.replace(/^\.\//, ''));
  const sourceDir = path.dirname(sourceNoteUri.fsPath);

  // Candidate 1: relative to source note directory
  const relativeCandidate = vscode.Uri.file(path.resolve(sourceDir, normalizedTarget));
  if (await fileExists(relativeCandidate)) {
    const relPath = notesRootUri
      ? path.relative(notesRootUri.fsPath, relativeCandidate.fsPath).replace(/\\/g, '/')
      : path.basename(relativeCandidate.fsPath);
    return {
      title: link.label || stripExtension(path.basename(relativeCandidate.fsPath)),
      target: link.target,
      uri: relativeCandidate.toString(),
      relativePath: relPath,
      exists: true,
    };
  }

  // Candidate 2: relative to notesRootUri
  if (notesRootUri) {
    const rootCandidate = vscode.Uri.joinPath(notesRootUri, normalizedTarget);
    if (await fileExists(rootCandidate)) {
      const relPath = path.relative(notesRootUri.fsPath, rootCandidate.fsPath).replace(/\\/g, '/');
      return {
        title: link.label || stripExtension(path.basename(rootCandidate.fsPath)),
        target: link.target,
        uri: rootCandidate.toString(),
        relativePath: relPath,
        exists: true,
      };
    }
  }

  // Candidate 3: match by basename across workspaceNotes
  if (workspaceNotes && workspaceNotes.length > 0) {
    const targetBaseLower = stripExtension(path.basename(normalizedTarget)).toLowerCase();
    const matched = workspaceNotes.find(
      (n) => stripExtension(path.basename(n.fsPath)).toLowerCase() === targetBaseLower
    );
    if (matched) {
      const relPath = notesRootUri
        ? path.relative(notesRootUri.fsPath, matched.fsPath).replace(/\\/g, '/')
        : path.basename(matched.fsPath);
      return {
        title: link.label || stripExtension(path.basename(matched.fsPath)),
        target: link.target,
        uri: matched.toString(),
        relativePath: relPath,
        exists: true,
      };
    }
  }

  // Fallback: unresolved / non-existent target (placed relative to source note)
  const fallbackUri = relativeCandidate;
  const relPath = notesRootUri
    ? path.relative(notesRootUri.fsPath, fallbackUri.fsPath).replace(/\\/g, '/')
    : normalizedTarget;

  return {
    title: link.label,
    target: link.target,
    uri: fallbackUri.toString(),
    relativePath: relPath,
    exists: false,
  };
}

/**
 * Checks whether an extracted link from `sourceNoteUri` points to `targetNoteUri`.
 */
export function doesLinkMatchTarget(
  link: ExtractedLink,
  sourceNoteUri: vscode.Uri,
  targetNoteUri: vscode.Uri,
  notesRootUri?: vscode.Uri
): boolean {
  const targetFsPath = targetNoteUri.fsPath;
  const targetBaseName = stripExtension(path.basename(targetFsPath)).toLowerCase();
  const normalizedLinkTarget = ensureNoteExtension(link.target.replace(/^\.\//, ''));

  // 1. Direct resolved path from source note's folder
  const resolvedFromSource = path.resolve(path.dirname(sourceNoteUri.fsPath), normalizedLinkTarget);
  if (resolvedFromSource.toLowerCase() === targetFsPath.toLowerCase()) {
    return true;
  }

  // 2. Direct resolved path from notesRootUri
  if (notesRootUri) {
    const resolvedFromRoot = path.resolve(notesRootUri.fsPath, normalizedLinkTarget);
    if (resolvedFromRoot.toLowerCase() === targetFsPath.toLowerCase()) {
      return true;
    }
  }

  // 3. Wiki-link or simple filename match without directory (e.g. [[Note A]] or [[Note A.md]])
  if (!link.target.includes('/') && !link.target.includes('\\')) {
    const linkBase = stripExtension(path.basename(link.target)).toLowerCase();
    if (linkBase === targetBaseName) {
      return true;
    }
  }

  return false;
}

/**
 * Finds all Markdown notes in `notesRootUri` that contain an outgoing link to `targetNoteUri`.
 */
export async function findBacklinks(
  targetNoteUri: vscode.Uri,
  notesRootUri: vscode.Uri
): Promise<NoteLinkItem[]> {
  const allNotes = await findMarkdownNotesInRoot(notesRootUri);
  const backlinks: NoteLinkItem[] = [];

  for (const candidateUri of allNotes) {
    if (candidateUri.fsPath === targetNoteUri.fsPath) {
      continue;
    }

    let text = '';
    try {
      const bytes = await vscode.workspace.fs.readFile(candidateUri);
      text = Buffer.from(bytes).toString('utf-8');
    } catch {
      continue;
    }

    const extracted = extractDocumentLinks(text);
    const linksToTarget = extracted.some((link) =>
      doesLinkMatchTarget(link, candidateUri, targetNoteUri, notesRootUri)
    );

    if (linksToTarget) {
      const relPath = path
        .relative(notesRootUri.fsPath, candidateUri.fsPath)
        .replace(/\\/g, '/');
      const baseTitle = stripExtension(path.basename(candidateUri.fsPath));
      backlinks.push({
        title: baseTitle,
        target: relPath,
        uri: candidateUri.toString(),
        relativePath: relPath,
        exists: true,
      });
    }
  }

  return backlinks;
}

/**
 * Queries the containing folder's `tasks.json` and the note's `*.chart.json`
 * and calculates open/completed/total task summary metrics.
 */
export async function resolveCompanionSummary(
  noteUri: vscode.Uri,
  companionManager: CompanionManager
): Promise<CompanionSummary> {
  const status = await companionManager.getCompanionStatus(noteUri);
  const summary: CompanionSummary = {};

  const folderDir = path.dirname(noteUri.fsPath);
  const folderName = path.basename(folderDir);
  const folderTasksUri = vscode.Uri.file(path.join(folderDir, 'tasks.json'));

  if (await fileExists(folderTasksUri)) {
    try {
      const rawBytes = await vscode.workspace.fs.readFile(folderTasksUri);
      const companion = parseTasksCompanion(Buffer.from(rawBytes).toString('utf-8'));
      const taskList = companion.tasks || [];
      const totalCount = taskList.length;
      const completedCount = taskList.filter((t) => t.completed || t.status === 'done').length;
      const openCount = totalCount - completedCount;

      summary.tasks = {
        exists: true,
        uri: folderTasksUri.toString(),
        openCount,
        completedCount,
        totalCount,
        label: `Ordner-Aufgaben: ${folderName} (${openCount} offen, ${totalCount} gesamt)`,
      };
    } catch {
      // Ignore invalid JSON
    }
  }

  if (status.chartExist) {
    summary.chart = {
      exists: true,
      uri: status.chartUri.toString(),
      label: 'Diagram View',
    };
  }

  return summary;
}

/**
 * Computes complete `NoteLinksData` (companions, outgoing links, backlinks) for a note.
 */
export async function getNoteLinksData(
  noteUri: vscode.Uri,
  documentText: string,
  companionManager: CompanionManager
): Promise<NoteLinksData> {
  const notesRootUri = companionManager.getNotesRootUri(noteUri);
  const workspaceNotes = notesRootUri ? await findMarkdownNotesInRoot(notesRootUri) : [];

  const extracted = extractDocumentLinks(documentText);
  const outgoingLinks: NoteLinkItem[] = [];
  for (const link of extracted) {
    const resolved = await resolveOutgoingLink(link, noteUri, notesRootUri, workspaceNotes);
    outgoingLinks.push(resolved);
  }

  const backlinks = notesRootUri ? await findBacklinks(noteUri, notesRootUri) : [];
  const companions = await resolveCompanionSummary(noteUri, companionManager);

  return {
    noteUri: noteUri.toString(),
    companions,
    outgoingLinks,
    backlinks,
  };
}

