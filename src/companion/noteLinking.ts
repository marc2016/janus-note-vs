import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownNote } from './companionPaths';

export interface LinkCandidate {
  label: string;
  insertText: string;
  relPath: string;
  fileType: 'note' | 'task' | 'chart' | 'image' | 'pdf' | 'file';
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
      }
    }
  }

  allCandidates.sort((a, b) => {
    if (a.fileType === 'note' && b.fileType !== 'note') return -1;
    if (a.fileType !== 'note' && b.fileType === 'note') return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });

  return allCandidates;
}

