import type { GraphEdge, GraphNode, NoteGraphData } from '../../services/noteGraphService';

export interface GraphFilterOptions {
  search: string;
  showOrphans: boolean;
  showGhosts: boolean;
}

export const DEFAULT_GRAPH_FILTER: GraphFilterOptions = {
  search: '',
  showOrphans: true,
  showGhosts: false,
};

/**
 * Derives the visible part of the graph. Orphans are judged by the edges that remain visible,
 * so a note whose only links point to hidden ghosts counts as an orphan.
 */
export function filterGraph(data: NoteGraphData, options: GraphFilterOptions): NoteGraphData {
  const query = options.search.trim().toLowerCase();

  let nodes: GraphNode[] = data.nodes.filter((node) => {
    if (node.ghost && !options.showGhosts) return false;
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
    nodes = nodes.filter((n) => connected.has(n.id));
  }

  return { nodes, edges };
}
