import { describe, it, expect } from 'vitest';
import { DEFAULT_GRAPH_FILTER, filterGraph } from '../src/webviews/noteGraph/graphFilter';
import type { NoteGraphData } from '../src/services/noteGraphService';

const node = (id: string, relativePath: string, ghost = false) => ({
  id,
  title: id,
  relativePath,
  group: relativePath.split('/')[0],
  degree: 0,
  ghost: ghost || undefined,
});

const data: NoteGraphData = {
  nodes: [
    node('plan', 'projects/App-Launch/plan.md'),
    node('architektur', 'projects/App-Launch/architektur.md'),
    node('kickoff', 'meetings/kickoff.md'),
    node('einsam', 'knowledge/einsam.md'),
    node('ideen', 'knowledge/ideen.md'),
    node('ghost:fehlt', 'fehlt', true),
  ],
  edges: [
    { source: 'plan', target: 'architektur', bidirectional: false },
    { source: 'kickoff', target: 'plan', bidirectional: true },
    { source: 'ideen', target: 'ghost:fehlt', bidirectional: false },
  ],
};

const ids = (result: NoteGraphData) => result.nodes.map((n) => n.id);

describe('filterGraph', () => {
  it('hides ghost nodes and their edges by default', () => {
    const result = filterGraph(data, DEFAULT_GRAPH_FILTER);
    expect(ids(result)).not.toContain('ghost:fehlt');
    expect(result.edges).toHaveLength(2);
    expect(ids(result)).toContain('einsam');
  });

  it('shows ghosts when enabled', () => {
    const result = filterGraph(data, { ...DEFAULT_GRAPH_FILTER, showGhosts: true });
    expect(ids(result)).toContain('ghost:fehlt');
    expect(result.edges).toHaveLength(3);
  });

  it('searches title and relative path case-insensitively and keeps only edges among matches', () => {
    const result = filterGraph(data, { ...DEFAULT_GRAPH_FILTER, search: 'LAUNCH' });
    expect(ids(result)).toEqual(['plan', 'architektur']);
    expect(result.edges).toEqual([{ source: 'plan', target: 'architektur', bidirectional: false }]);
  });

  it('judges orphans by visible edges only', () => {
    const result = filterGraph(data, { ...DEFAULT_GRAPH_FILTER, showOrphans: false });
    // 'ideen' only links to a hidden ghost, so it counts as an orphan
    expect(ids(result)).toEqual(['plan', 'architektur', 'kickoff']);

    const withGhosts = filterGraph(data, { ...DEFAULT_GRAPH_FILTER, showOrphans: false, showGhosts: true });
    expect(ids(withGhosts)).toContain('ideen');
  });

  it('returns an empty graph when nothing matches', () => {
    const result = filterGraph(data, { ...DEFAULT_GRAPH_FILTER, search: 'xyz' });
    expect(result).toEqual({ nodes: [], edges: [] });
  });
});
