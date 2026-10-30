import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownNote } from '../companion/companionPaths';
import {
  NoteLinkItem,
  extractDocumentLinks,
  findMarkdownNotesInRoots,
  resolveOutgoingLink,
} from './noteLinkService';
import { NoteMetadataEntry, buildAliasIndex, parseFrontmatter } from './noteMetadataService';

export interface GraphNode {
  id: string;
  /** Frontmatter title, or the file name without extension. */
  title: string;
  relativePath: string;
  group: string;
  aliases?: string[];
  /** Number of distinct linked notes (incoming and outgoing), ghosts excluded. */
  degree: number;
  ghost?: boolean;
  /** `folder` for folders that notes link to; absent for notes. */
  kind?: 'folder';
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

/**
 * Key of an unresolved link target, shared by the graph's ghost nodes and the broken link list:
 * the target without `.md`, lower-cased. Undefined for non-note files, which are never ghosts.
 */
export function ghostKeyForTarget(target: string): string | undefined {
  if (hasNonNoteExtension(target)) return undefined;
  return stripNoteExtension(target.replace(/\\/g, '/')).toLowerCase();
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
  const texts = new Map<string, string>();
  const metadata: NoteMetadataEntry[] = [];

  for (const note of notes) {
    let text: string | undefined;
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(note)).toString('utf-8');
      texts.set(note.fsPath, text);
    } catch {
      // Unreadable notes still get a node, without links
    }
    const { title, aliases, tags } = text !== undefined ? parseFrontmatter(text) : { title: undefined, aliases: [], tags: [] };
    metadata.push({ uri: note, metadata: { title, aliases, tags } });

    const id = note.toString();
    noteIdsByPath.set(note.fsPath, id);
    noteIdsByLowerPath.set(note.fsPath.toLowerCase(), id);
    const node: GraphNode = {
      id,
      title: title ?? stripNoteExtension(path.basename(note.fsPath)),
      ...describeNote(note, roots),
      degree: 0,
    };
    if (aliases.length > 0) node.aliases = aliases;
    nodes.set(id, node);
  }
  const aliasIndex = buildAliasIndex(metadata);

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
    const text = texts.get(note.fsPath);
    if (text === undefined) continue;

    const sourceId = noteIdsByPath.get(note.fsPath)!;
    for (const link of extractDocumentLinks(text)) {
      // Only wiki-links resolve via aliases, so the link type is part of the key
      const cacheKey = `${path.dirname(note.fsPath)}\n${link.type}\n${link.target.toLowerCase()}`;
      let pending = resolutionCache.get(cacheKey);
      if (!pending) {
        pending = resolveOutgoingLink(link, note, primaryRoot, notes, aliasIndex);
        resolutionCache.set(cacheKey, pending);
      }
      const resolved = await pending;

      // Linked folders become their own nodes; missing folders are left out (no ghosts)
      if (resolved.kind === 'folder') {
        if (!resolved.exists) continue;
        const folderUri = vscode.Uri.parse(resolved.uri);
        const folderId = `folder:${folderUri.toString()}`;
        if (!nodes.has(folderId)) {
          const { relativePath, group } = describeNote(folderUri, roots);
          nodes.set(folderId, {
            id: folderId,
            title: path.basename(folderUri.fsPath),
            relativePath: `${relativePath}/`,
            group,
            degree: 0,
            kind: 'folder',
          });
        }
        addEdge(sourceId, folderId);
        continue;
      }

      if (resolved.exists) {
        const targetPath = vscode.Uri.parse(resolved.uri).fsPath;
        const targetId = noteIdsByPath.get(targetPath) ?? noteIdsByLowerPath.get(targetPath.toLowerCase());
        // Existing non-note files (code, companions) are not part of the graph
        if (targetId) addEdge(sourceId, targetId);
        continue;
      }

      const ghostKey = ghostKeyForTarget(link.target);
      if (ghostKey === undefined) continue;

      const ghostName = stripNoteExtension(link.target.replace(/\\/g, '/'));
      const ghostId = `${GHOST_PREFIX}${ghostKey}`;
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
