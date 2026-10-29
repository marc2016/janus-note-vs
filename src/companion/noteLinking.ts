import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownNote } from './companionPaths';
import { getNotesMetadata } from '../services/noteMetadataService';

export interface LinkCandidate {
  label: string;
  insertText: string;
  relPath: string;
  fileType: 'note' | 'task' | 'chart' | 'image' | 'pdf' | 'file';
  /** Set for extra note entries found via the note's frontmatter instead of its file name. */
  matchedBy?: 'alias' | 'title';
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
  '.git',
]);

export function determineFileType(filename: string): LinkCandidate['fileType'] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tasks.json') || lower === 'tasks.json') {
    return 'task';
  }
  if (lower.endsWith('.chart.json')) {
    return 'chart';
  }
  if (isMarkdownNote(filename)) {
    return 'note';
  }
  if (/\.(png|jpe?g|svg|gif|webp)$/i.test(filename)) {
    return 'image';
  }
  if (/\.pdf$/i.test(filename)) {
    return 'pdf';
  }
  return 'file';
}

export function createLinkCandidate(relPath: string): LinkCandidate {
  const normalizedRelPath = relPath.replace(/\\/g, '/');
  const filename = path.basename(normalizedRelPath);
  const fileType = determineFileType(filename);

  if (fileType === 'note') {
    const baseWithoutExt = filename.replace(/\.(md|markdown)$/i, '');
    const relWithoutExt = normalizedRelPath.replace(/\.(md|markdown)$/i, '');
    return {
      label: baseWithoutExt,
      insertText: relWithoutExt,
      relPath: normalizedRelPath,
      fileType,
    };
  }

  return {
    label: filename,
    insertText: normalizedRelPath,
    relPath: normalizedRelPath,
    fileType,
  };
}

export async function findLinkCandidatesInRoot(
  notesRootUri: vscode.Uri,
  maxDepth: number = 6,
  relativeToUri?: vscode.Uri
): Promise<LinkCandidate[]> {
  const candidates: LinkCandidate[] = [];

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

    // Sort entries alphabetically
    entries.sort((a, b) => a[0].localeCompare(b[0]));

    for (const [name, fileType] of entries) {
      if (name.startsWith('.') || IGNORED_DIRS.has(name)) {
        continue;
      }

      const entryUri = vscode.Uri.joinPath(dirUri, name);
      if (fileType === vscode.FileType.Directory) {
        await scan(entryUri, depth + 1);
      } else if (fileType === vscode.FileType.File) {
        const base = relativeToUri || notesRootUri;
        const relPath = path.relative(base.fsPath, entryUri.fsPath).replace(/\\/g, '/');
        candidates.push(createLinkCandidate(relPath));
      }
    }
  };

  await scan(notesRootUri, 0);

  // Sort candidates: notes first, then alphabetically by label
  candidates.sort((a, b) => {
    if (a.fileType === 'note' && b.fileType !== 'note') return -1;
    if (a.fileType !== 'note' && b.fileType === 'note') return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });

  return candidates;
}

export async function findLinkCandidatesAcrossRoots(
  roots: vscode.Uri[],
  maxDepth: number = 6,
  primaryRootUri?: vscode.Uri
): Promise<LinkCandidate[]> {
  const allCandidates: LinkCandidate[] = [];
  const seenRelPaths = new Set<string>();
  const noteCandidates: Array<{ uri: vscode.Uri; candidate: LinkCandidate }> = [];

  for (const root of roots) {
    const isPrimary = primaryRootUri && root.fsPath === primaryRootUri.fsPath;
    let relativeTo: vscode.Uri | undefined;
    if (!isPrimary) {
      const wsFolder = vscode.workspace.getWorkspaceFolder(root);
      if (wsFolder && wsFolder.uri.fsPath !== root.fsPath) {
        relativeTo = wsFolder.uri;
      }
    }

    const candidates = await findLinkCandidatesInRoot(root, maxDepth, relativeTo);
    for (const cand of candidates) {
      if (!seenRelPaths.has(cand.relPath)) {
        seenRelPaths.add(cand.relPath);
        allCandidates.push(cand);
        if (cand.fileType === 'note') {
          noteCandidates.push({ uri: vscode.Uri.joinPath(relativeTo || root, cand.relPath), candidate: cand });
        }
      }
    }
  }

  // Frontmatter titles and aliases become extra entries, so the editor's label filter finds them
  const metadata = await getNotesMetadata(noteCandidates.map((n) => n.uri));
  const metadataByPath = new Map(metadata.map((m) => [m.uri.fsPath, m.metadata]));
  for (const { uri, candidate } of noteCandidates) {
    const meta = metadataByPath.get(uri.fsPath);
    if (!meta) continue;
    if (meta.title && meta.title.toLowerCase() !== candidate.label.toLowerCase()) {
      allCandidates.push({ ...candidate, label: meta.title, matchedBy: 'title' });
    }
    for (const alias of meta.aliases) {
      allCandidates.push({ ...candidate, label: alias, insertText: alias, matchedBy: 'alias' });
    }
  }

  allCandidates.sort((a, b) => {
    if (a.fileType === 'note' && b.fileType !== 'note') return -1;
    if (a.fileType !== 'note' && b.fileType === 'note') return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });

  return allCandidates;
}

