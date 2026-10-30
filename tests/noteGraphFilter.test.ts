import { describe, it, expect } from 'vitest';
import { DEFAULT_GRAPH_FILTER, filterGraph, localSubgraph, visibleGraph } from '../src/webviews/noteGraph/graphFilter';
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

  it('matches frontmatter aliases in the search field', () => {
    const withAlias: NoteGraphData = {
      nodes: [{ ...node('rest', 'knowledge/rest-schnittstelle.md'), aliases: ['API'] }, node('plan', 'plan.md')],
      edges: [],
    };
    expect(ids(filterGraph(withAlias, { ...DEFAULT_GRAPH_FILTER, search: 'api' }))).toEqual(['rest']);
  });
});

describe('local graph mode', () => {
  const local: NoteGraphData = {
    nodes: [
      node('plan', 'plan.md'),
      node('architektur', 'architektur.md'),
      node('kickoff', 'kickoff.md'),
      node('api', 'api.md'),
      node('einsam', 'einsam.md'),
      node('ghost:fehlt', 'fehlt', true),
    ],
    edges: [
      { source: 'plan', target: 'architektur', bidirectional: false },
      { source: 'kickoff', target: 'plan', bidirectional: false },
      { source: 'architektur', target: 'api', bidirectional: false },
      { source: 'plan', target: 'ghost:fehlt', bidirectional: false },
    ],
  };
  const edgeKeys = (result: NoteGraphData) => result.edges.map((e) => `${e.source}>${e.target}`).sort();
  const localOptions = { ...DEFAULT_GRAPH_FILTER, mode: 'local' as const };

  it('shows direct neighbours in both directions at depth 1', () => {
    const result = visibleGraph(local, localOptions, 'plan')!;
    expect(ids(result).sort()).toEqual(['architektur', 'kickoff', 'plan']);
    expect(edgeKeys(result)).toEqual(['kickoff>plan', 'plan>architektur']);
  });

  it('reaches two steps at depth 2', () => {
    const result = visibleGraph(local, { ...localOptions, depth: 2 }, 'plan')!;
    expect(ids(result)).toContain('api');
    expect(edgeKeys(result)).toContain('architektur>api');
  });

  it('shows only the centre when it has no links, even with orphans hidden', () => {
    const result = visibleGraph(local, { ...localOptions, showOrphans: false }, 'einsam')!;
    expect(ids(result)).toEqual(['einsam']);
  });

  it('keeps the centre when searching', () => {
    const result = visibleGraph(local, { ...localOptions, search: 'kick' }, 'plan')!;
    expect(ids(result).sort()).toEqual(['kickoff', 'plan']);
    expect(edgeKeys(result)).toEqual(['kickoff>plan']);
  });

  it('shows ghost neighbours only with the ghost toggle', () => {
    expect(ids(visibleGraph(local, localOptions, 'plan')!)).not.toContain('ghost:fehlt');
    expect(ids(visibleGraph(local, { ...localOptions, showGhosts: true }, 'plan')!)).toContain('ghost:fehlt');
  });

  it('shows the whole graph again in whole-graph mode', () => {
    expect(ids(visibleGraph(local, DEFAULT_GRAPH_FILTER, 'plan')!)).toEqual(['plan', 'architektur', 'kickoff', 'api', 'einsam']);
  });

  it('has no graph without a centre or with a centre missing from the data', () => {
    expect(visibleGraph(local, localOptions, undefined)).toBeUndefined();
    expect(visibleGraph(local, localOptions, 'neu')).toBeUndefined();
    expect(localSubgraph(local, 'neu', 1)).toEqual({ nodes: [], edges: [] });
  });
});

