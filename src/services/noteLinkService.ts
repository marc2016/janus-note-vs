import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';
import { parseTasksCompanion } from '../models/tasks';
import {
  LinkCandidate,
  determineFileType,
  createLinkCandidate,
  findLinkCandidatesInRoot,
  findLinkCandidatesAcrossRoots,
} from '../companion/noteLinking';
import { AliasIndex, buildAliasIndex, getNotesMetadata, parseFrontmatter } from './noteMetadataService';
import {
  EXTERNAL_PROTOCOL_RE,
  LinkOccurrence,
  findLinkOccurrences,
  parseLinkTargetAndLine,
} from './markdownScan';

export { LinkOccurrence, findLinkOccurrences, parseLinkTargetAndLine };

export {
  LinkCandidate,
  determineFileType,
  createLinkCandidate,
  findLinkCandidatesInRoot,
  findLinkCandidatesAcrossRoots,
};

export interface ExtractedLink {
  raw: string;
  target: string;
  label: string;
  type: 'wiki' | 'markdown';
  lineNumber?: number;
  sourceLineNumber?: number;
}

export interface NoteLinkItem {
  title: string;
  target: string;
  uri: string;
  relativePath: string;
  exists: boolean;
  viewType?: string;
  lineNumber?: number;
  /** `folder` for links to folders; absent means a note or file. */
  kind?: 'note' | 'folder';
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
  const wikiRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = wikiRe.exec(text)) !== null) {
    const fullTarget = match[1].trim();
    const label = (match[2] || match[1]).trim();
    if (!fullTarget || EXTERNAL_PROTOCOL_RE.test(fullTarget)) {
      continue;
    }

    const { cleanTarget, lineNumber } = parseLinkTargetAndLine(fullTarget);
    if (!cleanTarget) {
      continue;
    }

    const key = cleanTarget.toLowerCase();
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      const link: ExtractedLink = {
        raw: match[0],
        target: cleanTarget,
        label,
        type: 'wiki',
      };
      if (lineNumber !== undefined) {
        link.lineNumber = lineNumber;
      }
      results.push(link);
    }
  }

  // 2. Standard Markdown links (excluding images ![alt](url)): [Label](Target)
  const mdRe = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = mdRe.exec(text)) !== null) {
    const label = match[1].trim();
    let rawTarget = match[2].trim();
    if (!rawTarget || EXTERNAL_PROTOCOL_RE.test(rawTarget)) {
      continue;
    }

    const { cleanTarget, lineNumber } = parseLinkTargetAndLine(rawTarget);
    if (!cleanTarget) {
      continue;
    }

    const key = cleanTarget.toLowerCase();
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      const link: ExtractedLink = {
        raw: match[0],
        target: cleanTarget,
        label: label || cleanTarget,
        type: 'markdown',
      };
      if (lineNumber !== undefined) {
        link.lineNumber = lineNumber;
      }
      results.push(link);
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

export async function findMarkdownNotesInRoots(
  roots: vscode.Uri[],
  maxDepth: number = 6
): Promise<vscode.Uri[]> {
  const allNotes: vscode.Uri[] = [];
  const seenPaths = new Set<string>();

  for (const root of roots) {
    const notes = await findMarkdownNotesInRoot(root, maxDepth);
    for (const note of notes) {
      if (!seenPaths.has(note.fsPath)) {
        seenPaths.add(note.fsPath);
        allNotes.push(note);
      }
    }
  }

  return allNotes;
}

async function directoryExists(uri: vscode.Uri): Promise<boolean> {
  try {
    return (await vscode.workspace.fs.stat(uri)).type === vscode.FileType.Directory;
  } catch {
    return false;
  }
}

/** Finds a folder relative to the note, the notes root or the workspace folder, in that order. */
async function resolveFolderTarget(
  folderPath: string,
  sourceNoteUri: vscode.Uri,
  notesRootUri?: vscode.Uri
): Promise<vscode.Uri | undefined> {
  if (!folderPath) return notesRootUri;
  const candidates = [vscode.Uri.file(path.resolve(path.dirname(sourceNoteUri.fsPath), folderPath))];
  if (notesRootUri) candidates.push(vscode.Uri.joinPath(notesRootUri, folderPath));
  const wsFolder = vscode.workspace.getWorkspaceFolder(sourceNoteUri);
  if (wsFolder) candidates.push(vscode.Uri.joinPath(wsFolder.uri, folderPath));
  for (const candidate of candidates) {
    if (await directoryExists(candidate)) return candidate;
  }
  return undefined;
}

function folderLinkItem(
  link: ExtractedLink,
  folderUri: vscode.Uri,
  exists: boolean,
  notesRootUri: vscode.Uri | undefined,
  lineNumber: number | undefined
): NoteLinkItem {
  const rel = notesRootUri ? path.relative(notesRootUri.fsPath, folderUri.fsPath).replace(/\\/g, '/') : path.basename(folderUri.fsPath);
  return {
    title: link.label && link.label !== link.target ? link.label : path.basename(folderUri.fsPath),
    target: link.target,
    uri: folderUri.toString(),
    relativePath: rel ? `${rel}/` : '',
    exists,
    lineNumber,
    kind: 'folder',
  };
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
  workspaceNotes?: vscode.Uri[],
  aliasIndex?: AliasIndex
): Promise<NoteLinkItem> {
  const { cleanTarget, lineNumber } = parseLinkTargetAndLine(link.target);
  const targetLine = link.lineNumber ?? lineNumber;

  // A trailing slash always means a folder
  const folderPath = cleanTarget.replace(/^\.\//, '').replace(/\/+$/, '');
  if (/\/$/.test(cleanTarget)) {
    const folderUri = await resolveFolderTarget(folderPath, sourceNoteUri, notesRootUri);
    return folderLinkItem(
      link,
      folderUri ?? vscode.Uri.file(path.resolve(path.dirname(sourceNoteUri.fsPath), folderPath)),
      Boolean(folderUri),
      notesRootUri,
      targetLine
    );
  }

  const normalizedTarget = ensureNoteExtension(cleanTarget.replace(/^\.\//, ''));
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
      lineNumber: targetLine,
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
        lineNumber: targetLine,
      };
    }
  }

  // Candidate 2b: relative to workspace folder (supports cross-folder references like docs/architecture.md)
  const wsFolder = vscode.workspace.getWorkspaceFolder(sourceNoteUri);
  if (wsFolder) {
    const wsCandidate = vscode.Uri.joinPath(wsFolder.uri, normalizedTarget);
    if (await fileExists(wsCandidate)) {
      const relPath = path.relative(wsFolder.uri.fsPath, wsCandidate.fsPath).replace(/\\/g, '/');
      return {
        title: link.label || stripExtension(path.basename(wsCandidate.fsPath)),
        target: link.target,
        uri: wsCandidate.toString(),
        relativePath: relPath,
        exists: true,
        lineNumber: targetLine,
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
        lineNumber: targetLine,
      };
    }
  }

  // Candidate 4: frontmatter alias (wiki-links only), after every path and name match
  const aliasTarget = link.type === 'wiki' ? aliasIndex?.get(cleanTarget.toLowerCase()) : undefined;
  if (aliasTarget) {
    const relPath = notesRootUri
      ? path.relative(notesRootUri.fsPath, aliasTarget.fsPath).replace(/\\/g, '/')
      : path.basename(aliasTarget.fsPath);
    return {
      title: link.label || stripExtension(path.basename(aliasTarget.fsPath)),
      target: link.target,
      uri: aliasTarget.toString(),
      relativePath: relPath,
      exists: true,
      lineNumber: targetLine,
    };
  }

  // Candidate 5: a folder, when no note matched and the target has no file extension
  if (!/\.[a-z0-9]+$/i.test(folderPath)) {
    const folderUri = await resolveFolderTarget(folderPath, sourceNoteUri, notesRootUri);
    if (folderUri) {
      return folderLinkItem(link, folderUri, true, notesRootUri, targetLine);
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
    lineNumber: targetLine,
  };
}

/**
 * Checks whether a link would resolve to one of `knownNotes` by path or file name,
 * i.e. before the alias step of `resolveOutgoingLink`.
 */
function resolvesByPathOrName(
  link: ExtractedLink,
  sourceNoteUri: vscode.Uri,
  roots: vscode.Uri[],
  knownNotes: vscode.Uri[]
): boolean {
  const normalized = ensureNoteExtension(link.target.replace(/^\.\//, ''));
  const known = new Set(knownNotes.map((n) => n.fsPath.toLowerCase()));
  const wsFolder = vscode.workspace.getWorkspaceFolder(sourceNoteUri);
  const bases = [path.dirname(sourceNoteUri.fsPath), ...roots.map((r) => r.fsPath)];
  if (wsFolder) bases.push(wsFolder.uri.fsPath);
  if (bases.some((base) => known.has(path.resolve(base, normalized).toLowerCase()))) {
    return true;
  }
  const baseLower = stripExtension(path.basename(normalized)).toLowerCase();
  return knownNotes.some((n) => stripExtension(path.basename(n.fsPath)).toLowerCase() === baseLower);
}

/**
 * Checks whether an extracted link from `sourceNoteUri` points to `targetNoteUri`.
 * With `targetAliases`, a wiki-link naming one of them also matches, unless it resolves to
 * one of `knownNotes` by path or file name first.
 */
export function doesLinkMatchTarget(
  link: ExtractedLink,
  sourceNoteUri: vscode.Uri,
  targetNoteUri: vscode.Uri,
  notesRoots?: vscode.Uri | vscode.Uri[],
  targetAliases?: string[],
  knownNotes?: vscode.Uri[]
): boolean {
  const targetFsPath = targetNoteUri.fsPath;
  const targetBaseName = stripExtension(path.basename(targetFsPath)).toLowerCase();
  const normalizedLinkTarget = ensureNoteExtension(link.target.replace(/^\.\//, ''));

  // 1. Direct resolved path from source note's folder
  const resolvedFromSource = path.resolve(path.dirname(sourceNoteUri.fsPath), normalizedLinkTarget);
  if (resolvedFromSource.toLowerCase() === targetFsPath.toLowerCase()) {
    return true;
  }

  // 2. Direct resolved path from notesRoots
  const roots = notesRoots ? (Array.isArray(notesRoots) ? notesRoots : [notesRoots]) : [];
  for (const root of roots) {
    const resolvedFromRoot = path.resolve(root.fsPath, normalizedLinkTarget);
    if (resolvedFromRoot.toLowerCase() === targetFsPath.toLowerCase()) {
      return true;
    }
  }

  // 2b. Direct resolved path from workspace folder
  const wsFolder =
    vscode.workspace.getWorkspaceFolder(sourceNoteUri) ||
    vscode.workspace.getWorkspaceFolder(targetNoteUri);
  if (wsFolder) {
    const resolvedFromWs = path.resolve(wsFolder.uri.fsPath, normalizedLinkTarget);
    if (resolvedFromWs.toLowerCase() === targetFsPath.toLowerCase()) {
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

  // 4. Wiki-link via a frontmatter alias of the target
  if (link.type === 'wiki' && targetAliases && targetAliases.length > 0) {
    const key = link.target.toLowerCase();
    if (
      targetAliases.some((alias) => alias.toLowerCase() === key) &&
      !resolvesByPathOrName(link, sourceNoteUri, roots, knownNotes ?? [])
    ) {
      return true;
    }
  }

  return false;
}

/** Builds the frontmatter alias index for `notes` (cached by modification time). */
export async function loadAliasIndex(notes: vscode.Uri[]): Promise<AliasIndex> {
  return buildAliasIndex(await getNotesMetadata(notes));
}

/**
 * Finds all Markdown notes in `notesRoots` that contain an outgoing link to `targetNoteUri`.
 */
/** A note that links to a folder, with the 1-based line of the link. */
export interface FolderBacklink {
  title: string;
  uri: string;
  relativePath: string;
  line: number;
}

/**
 * Notes that link to `folderUri` (see folder links in `resolveOutgoingLink`). Only links whose
 * last path segment names the folder are resolved, which keeps the scan cheap.
 */
export async function findFolderBacklinks(
  folderUri: vscode.Uri,
  notesRoots: vscode.Uri | vscode.Uri[],
  primaryRoot?: vscode.Uri
): Promise<FolderBacklink[]> {
  const roots = Array.isArray(notesRoots) ? notesRoots : [notesRoots];
  const notesRoot = primaryRoot ?? roots[0];
  const allNotes = await findMarkdownNotesInRoots(roots);
  const folderName = path.basename(folderUri.fsPath).toLowerCase();
  const result: FolderBacklink[] = [];

  for (const note of allNotes) {
    let text: string;
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(note)).toString('utf8');
    } catch {
      continue;
    }
    for (const occurrence of findLinkOccurrences(text)) {
      const lastSegment = occurrence.path.replace(/\/+$/, '').split('/').pop()?.toLowerCase();
      if (lastSegment !== folderName) continue;
      const resolved = await resolveOutgoingLink(
        { raw: occurrence.path, target: occurrence.path, label: occurrence.path, type: occurrence.type === 'wiki' ? 'wiki' : 'markdown' },
        note,
        notesRoot,
        allNotes
      );
      if (resolved.kind === 'folder' && resolved.exists && vscode.Uri.parse(resolved.uri).fsPath === folderUri.fsPath) {
        result.push({
          title: path.basename(note.fsPath).replace(/\.(md|markdown)$/i, ''),
          uri: note.toString(),
          relativePath: notesRoot ? path.relative(notesRoot.fsPath, note.fsPath).replace(/\\/g, '/') : path.basename(note.fsPath),
          line: occurrence.line,
        });
      }
    }
  }
  return result;
}

export async function findBacklinks(
  targetNoteUri: vscode.Uri,
  notesRoots: vscode.Uri | vscode.Uri[]
): Promise<NoteLinkItem[]> {
  const roots = Array.isArray(notesRoots) ? notesRoots : [notesRoots];
  const allNotes = await findMarkdownNotesInRoots(roots);
  const backlinks: NoteLinkItem[] = [];
  const primaryRoot = roots[0];

  let targetAliases: string[] = [];
  try {
    targetAliases = parseFrontmatter(Buffer.from(await vscode.workspace.fs.readFile(targetNoteUri)).toString('utf-8')).aliases;
  } catch {
    // Target not readable: no alias matching
  }
  const matches = (l: ExtractedLink, source: vscode.Uri) =>
    doesLinkMatchTarget(l, source, targetNoteUri, roots, targetAliases, allNotes);

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

    const lines = text.split(/\r?\n/);
    let matchedLineNumber: number | undefined;

    for (let i = 0; i < lines.length; i++) {
      const lineLinks = extractDocumentLinks(lines[i]);
      if (lineLinks.some((l) => matches(l, candidateUri))) {
        matchedLineNumber = i + 1;
        break;
      }
    }

    // Fallback if not detected on a single line (e.g. multiline link syntax)
    if (matchedLineNumber === undefined) {
      const fullDocLinks = extractDocumentLinks(text);
      if (fullDocLinks.some((l) => matches(l, candidateUri))) {
        matchedLineNumber = 1;
      }
    }

    if (matchedLineNumber !== undefined) {
      let relPath: string;
      const relToPrimary = primaryRoot
        ? path.relative(primaryRoot.fsPath, candidateUri.fsPath).replace(/\\/g, '/')
        : '';
      if (primaryRoot && !relToPrimary.startsWith('..') && !path.isAbsolute(relToPrimary)) {
        relPath = relToPrimary;
      } else {
        const wsFolder = vscode.workspace.getWorkspaceFolder(candidateUri);
        relPath = wsFolder
          ? path.relative(wsFolder.uri.fsPath, candidateUri.fsPath).replace(/\\/g, '/')
          : path.basename(candidateUri.fsPath);
      }
      const baseTitle = stripExtension(path.basename(candidateUri.fsPath));
      backlinks.push({
        title: baseTitle,
        target: relPath,
        uri: candidateUri.toString(),
        relativePath: relPath,
        exists: true,
        lineNumber: matchedLineNumber,
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
  const allRoots = companionManager.getAllNotesRoots
    ? companionManager.getAllNotesRoots(noteUri)
    : (companionManager.getNotesRootUri(noteUri) ? [companionManager.getNotesRootUri(noteUri)!] : []);
  const primaryRoot = companionManager.getNotesRootUri(noteUri);
  const workspaceNotes = allRoots.length > 0 ? await findMarkdownNotesInRoots(allRoots) : [];
  const aliasIndex = await loadAliasIndex(workspaceNotes);

  const extracted = extractDocumentLinks(documentText);
  const outgoingLinks: NoteLinkItem[] = [];
  for (const link of extracted) {
    const resolved = await resolveOutgoingLink(link, noteUri, primaryRoot, workspaceNotes, aliasIndex);
    outgoingLinks.push(resolved);
  }

  const backlinks = allRoots.length > 0 ? await findBacklinks(noteUri, allRoots) : [];
  const companions = await resolveCompanionSummary(noteUri, companionManager);

  return {
    noteUri: noteUri.toString(),
    companions,
    outgoingLinks,
    backlinks,
  };
}

/**
 * Recursively collects and deduplicates Markdown notes from a list of selected tree items or URIs.
 */
export async function collectMarkdownNotesFromSelection(
  items: (any | vscode.Uri)[],
  maxDepth: number = 5
): Promise<vscode.Uri[]> {
  const result: vscode.Uri[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    let targetUri: vscode.Uri | undefined;
    if (item instanceof vscode.Uri) {
      targetUri = item;
    } else if (item && typeof item === 'object' && item.resourceUri instanceof vscode.Uri) {
      targetUri = item.resourceUri;
    } else if (item && typeof item === 'object' && item.uri instanceof vscode.Uri) {
      targetUri = item.uri;
    } else if (typeof item?.fsPath === 'string') {
      targetUri = vscode.Uri.file(item.fsPath);
    }

    if (!targetUri) {
      continue;
    }

    try {
      const stat = await vscode.workspace.fs.stat(targetUri);
      if (stat.type === vscode.FileType.Directory) {
        const nestedNotes = await findMarkdownNotesInRoot(targetUri, maxDepth);
        for (const note of nestedNotes) {
          const key = note.toString();
          if (!seen.has(key)) {
            seen.add(key);
            result.push(note);
          }
        }
      } else if (stat.type === vscode.FileType.File && isMarkdownNote(targetUri.fsPath)) {
        const key = targetUri.toString();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(targetUri);
        }
      }
    } catch {
      if (isMarkdownNote(targetUri.fsPath)) {
        const key = targetUri.toString();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(targetUri);
        }
      }
    }
  }

  return result;
}

