import type { GraphEdge, GraphNode, NoteGraphData } from '../../services/noteGraphService';

export type GraphMode = 'all' | 'local';
export type GraphDepth = 1 | 2 | 3;

export interface GraphFilterOptions {
  search: string;
  showOrphans: boolean;
  showGhosts: boolean;
  mode: GraphMode;
  depth: GraphDepth;
  /** Lower-cased tag the notes must carry, or null for all notes. */
  tag: string | null;
}

export const DEFAULT_GRAPH_FILTER: GraphFilterOptions = {
  search: '',
  showOrphans: true,
  showGhosts: false,
  mode: 'all',
  depth: 1,
  tag: null,
};

/**
 * The centre node and every node reachable from it in at most `depth` steps, following edges in
 * both directions, with the edges among them. Empty when the centre is not in the graph.
 */
export function localSubgraph(data: NoteGraphData, centreId: string, depth: number): NoteGraphData {
  if (!data.nodes.some((n) => n.id === centreId)) return { nodes: [], edges: [] };
  const neighbours = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    let list = neighbours.get(a);
    if (!list) {
      list = [];
      neighbours.set(a, list);
    }
    list.push(b);
  };
  for (const e of data.edges) {
    link(e.source, e.target);
    link(e.target, e.source);
  }

  const reached = new Set([centreId]);
  let frontier = [centreId];
  for (let step = 0; step < depth && frontier.length > 0; step++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const other of neighbours.get(id) ?? []) {
        if (!reached.has(other)) {
          reached.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }

  return {
    nodes: data.nodes.filter((n) => reached.has(n.id)),
    edges: data.edges.filter((e) => reached.has(e.source) && reached.has(e.target)),
  };
}

/**
 * Derives the visible part of the graph. Orphans are judged by the edges that remain visible,
 * so a note whose only links point to hidden ghosts counts as an orphan.
 */
export function filterGraph(
  data: NoteGraphData,
  options: Pick<GraphFilterOptions, 'search' | 'showOrphans' | 'showGhosts'> & { tag?: string | null },
  keepIds: ReadonlySet<string> = new Set()
): NoteGraphData {
  const query = options.search.trim().toLowerCase();
  const tag = options.tag?.toLowerCase();

  let nodes: GraphNode[] = data.nodes.filter((node) => {
    if (keepIds.has(node.id)) return true;
    if (node.ghost && !options.showGhosts) return false;
    // A tag filter shows only notes carrying the tag (no ghosts or folders)
    if (tag && !(node.tags ?? []).includes(tag)) return false;
    if (!query) return true;
    return (
      node.title.toLowerCase().includes(query) ||
      node.relativePath.toLowerCase().includes(query) ||
      (node.aliases ?? []).some((alias) => alias.toLowerCase().includes(query))
    );
  });

  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));

  if (!options.showOrphans) {
    const connected = new Set<string>();
    for (const e of edges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    nodes = nodes.filter((n) => connected.has(n.id) || keepIds.has(n.id));
  }

  return { nodes, edges };
}

/**
 * What the graph panel shows for the given options: the whole graph, or in local mode the
 * centre's neighbourhood (centre always kept, orphans ignored). Undefined in local mode
 * without a centre in the data, where the panel shows a hint instead.
 */
export function visibleGraph(
  data: NoteGraphData,
  options: GraphFilterOptions,
  centreId: string | undefined
): NoteGraphData | undefined {
  if (options.mode !== 'local') return filterGraph(data, options);
  if (!centreId || !data.nodes.some((n) => n.id === centreId)) return undefined;
  return filterGraph(localSubgraph(data, centreId, options.depth), { ...options, showOrphans: true }, new Set([centreId]));
}
