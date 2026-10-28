import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownNote } from '../companion/companionPaths';
import {
  NoteLinkItem,
  extractDocumentLinks,
  findMarkdownNotesInRoots,
  resolveOutgoingLink,
} from './noteLinkService';

export interface GraphNode {
  id: string;
  title: string;
  relativePath: string;
  group: string;
  /** Number of distinct linked notes (incoming and outgoing), ghosts excluded. */
  degree: number;
  ghost?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  bidirectional: boolean;
}

export interface NoteGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const GHOST_PREFIX = 'ghost:';

function stripNoteExtension(name: string): string {
  return name.replace(/\.(md|markdown)$/i, '');
}

function hasNonNoteExtension(target: string): boolean {
  return /\.[a-z0-9]+$/i.test(target) && !isMarkdownNote(target);
}

/** Picks the most specific root containing `fsPath`. */
function findContainingRoot(fsPath: string, roots: vscode.Uri[]): vscode.Uri | undefined {
  let best: vscode.Uri | undefined;
  for (const root of roots) {
    const rel = path.relative(root.fsPath, fsPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
    if (!best || root.fsPath.length > best.fsPath.length) best = root;
  }
  return best;
}

function describeNote(uri: vscode.Uri, roots: vscode.Uri[]): Pick<GraphNode, 'relativePath' | 'group'> {
  const root = findContainingRoot(uri.fsPath, roots);
  if (!root) {
    return { relativePath: path.basename(uri.fsPath), group: '' };
  }
  const relativePath = path.relative(root.fsPath, uri.fsPath).replace(/\\/g, '/');
  const segments = relativePath.split('/');
  const group = segments.length > 1 ? segments[0] : path.basename(root.fsPath);
  return { relativePath, group };
}

/**
 * Builds the note graph for all Markdown notes under `roots`, reading every note once.
 * Links are resolved like the editor footer does (`resolveOutgoingLink`).
 */
export async function buildNoteGraph(
  roots: vscode.Uri[],
  primaryRoot: vscode.Uri | undefined
): Promise<NoteGraphData> {
  const notes = await findMarkdownNotesInRoots(roots);
  const nodes = new Map<string, GraphNode>();
  const noteIdsByPath = new Map<string, string>();
  // Case-insensitive file systems resolve `[[Plan]]` to `plan.md` but keep the link's spelling
  const noteIdsByLowerPath = new Map<string, string>();

  for (const note of notes) {
    const id = note.toString();
    noteIdsByPath.set(note.fsPath, id);
    noteIdsByLowerPath.set(note.fsPath.toLowerCase(), id);
    nodes.set(id, {
      id,
      title: stripNoteExtension(path.basename(note.fsPath)),
      ...describeNote(note, roots),
      degree: 0,
    });
  }

  // Unordered pair key -> edge; resolution cache per (source directory, target)
  const edges = new Map<string, GraphEdge>();
  const resolutionCache = new Map<string, Promise<NoteLinkItem>>();

  const addEdge = (source: string, target: string) => {
    if (source === target) return;
    const key = source < target ? `${source}\n${target}` : `${target}\n${source}`;
    const existing = edges.get(key);
    if (!existing) {
      edges.set(key, { source, target, bidirectional: false });
    } else if (existing.source !== source) {
      existing.bidirectional = true;
    }
  };

  for (const note of notes) {
    let text: string;
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(note)).toString('utf-8');
    } catch {
      continue;
    }

    const sourceId = noteIdsByPath.get(note.fsPath)!;
    for (const link of extractDocumentLinks(text)) {
      const cacheKey = `${path.dirname(note.fsPath)}\n${link.target.toLowerCase()}`;
      let pending = resolutionCache.get(cacheKey);
      if (!pending) {
        pending = resolveOutgoingLink(link, note, primaryRoot, notes);
        resolutionCache.set(cacheKey, pending);
      }
      const resolved = await pending;

      if (resolved.exists) {
        const targetPath = vscode.Uri.parse(resolved.uri).fsPath;
        const targetId = noteIdsByPath.get(targetPath) ?? noteIdsByLowerPath.get(targetPath.toLowerCase());
        // Existing non-note files (code, companions) are not part of the graph
        if (targetId) addEdge(sourceId, targetId);
        continue;
      }

      if (hasNonNoteExtension(link.target)) continue;

      const ghostName = stripNoteExtension(link.target.replace(/\\/g, '/'));
      const ghostId = `${GHOST_PREFIX}${ghostName.toLowerCase()}`;
      if (!nodes.has(ghostId)) {
        nodes.set(ghostId, {
          id: ghostId,
          title: path.posix.basename(ghostName),
          relativePath: ghostName,
          group: '',
          degree: 0,
          ghost: true,
        });
      }
      addEdge(sourceId, ghostId);
    }
  }

  for (const edge of edges.values()) {
    const source = nodes.get(edge.source)!;
    const target = nodes.get(edge.target)!;
    if (!source.ghost && !target.ghost) {
      source.degree++;
      target.degree++;
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
