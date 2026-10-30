import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphEdge, GraphNode } from '../../services/noteGraphService';

interface SimNode extends GraphNode, d3.SimulationNodeDatum {
  radius: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  key: string;
  bidirectional: boolean;
}

interface NoteGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** All groups of the full graph, so colors stay stable while filtering. */
  groups: string[];
  isDark: boolean;
  onOpenNote: (id: string) => void;
  /** Centre of the local graph: emphasized, always labelled, and kept in view. */
  centreId?: string;
}

/** Labels fade in between these zoom levels. */
const LABEL_FADE_START = 0.8;
const LABEL_FADE_END = 1.4;
/** Label size in screen pixels, independent of the zoom level. */
const LABEL_FONT_PX = 11;
const FADED_NODE_OPACITY = 0.12;
const LINK_OPACITY = 0.18;
const FADED_LINK_OPACITY = 0.04;
const ACCENT = 'var(--vscode-focusBorder, #007acc)';
const FOREGROUND = 'var(--vscode-foreground, #cccccc)';

const PALETTE_DARK = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#c084fc', '#fb7185', '#2dd4bf', '#a3e635', '#fdba74'];
const PALETTE_LIGHT = ['#4f46e5', '#0284c7', '#059669', '#b45309', '#db2777', '#9333ea', '#e11d48', '#0f766e', '#4d7c0f', '#c2410c'];

const TRANSITION_CSS = `
  .node { transition: opacity 180ms ease; }
  .node text { transition: opacity 180ms ease; }
  .link { transition: stroke-opacity 180ms ease, stroke 180ms ease; }
`;

const CENTRE_MIN_RADIUS = 8;
const RECENTRE_MS = 500;

const nodeRadius = (node: GraphNode, centreId?: string) => {
  const radius = node.ghost ? 3 : Math.min(3 + 2 * Math.sqrt(node.degree), 16);
  return node.id === centreId ? Math.max(radius, CENTRE_MIN_RADIUS) : radius;
};

/**
 * Force-directed note graph. The simulation, zoom transform and node positions live in refs,
 * so data updates (filters, live rebuilds) do not reset the view.
 */
export const NoteGraphCanvas: React.FC<NoteGraphCanvasProps> = ({ nodes, edges, groups, isDark, onOpenNote, centreId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef = useRef(new Map<string, SimNode>());
  const adjacencyRef = useRef(new Map<string, Set<string>>());
  const zoomKRef = useRef(1);
  const hoveredRef = useRef<string | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const draggingRef = useRef(false);
  const centreRef = useRef(centreId);
  centreRef.current = centreId;
  const onOpenNoteRef = useRef(onOpenNote);
  onOpenNoteRef.current = onOpenNote;

  const isNeighbour = (a: string, b: string) => a === b || !!adjacencyRef.current.get(a)?.has(b);

  /** Counteracts the zoom scale so labels keep the same on-screen size. */
  const applyLabelScale = () => {
    const k = zoomKRef.current;
    d3.select(svgRef.current)
      .selectAll<SVGGElement, SimNode>('g.node')
      .select('text')
      .attr('font-size', LABEL_FONT_PX / k)
      .attr('dy', (d) => d.radius + (LABEL_FONT_PX + 2) / k);
  };

  /** Applies hover highlighting, arrows and label fading to the current selection. */
  const applyHighlight = () => {
    const svg = d3.select(svgRef.current);
    const hovered = hoveredRef.current;
    const zoomLabelOpacity = Math.max(
      0,
      Math.min(1, (zoomKRef.current - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START))
    );

    const nodeSel = svg.selectAll<SVGGElement, SimNode>('g.node');
    nodeSel.style('opacity', (d) => (!hovered || isNeighbour(hovered, d.id) ? 1 : FADED_NODE_OPACITY));
    nodeSel
      .select('text')
      .style('opacity', (d) =>
        d.id === centreRef.current || (hovered && isNeighbour(hovered, d.id)) ? 1 : zoomLabelOpacity
      );

    const isHighlighted = (d: SimLink) =>
      !!hovered && ((d.source as SimNode).id === hovered || (d.target as SimNode).id === hovered);

    svg
      .selectAll<SVGLineElement, SimLink>('line.link')
      .style('stroke', (d) => (isHighlighted(d) ? ACCENT : FOREGROUND))
      .style('stroke-opacity', (d) => (!hovered ? LINK_OPACITY : isHighlighted(d) ? 0.9 : FADED_LINK_OPACITY))
      // Direction is only shown for the hovered note's links, which keeps the resting graph calm
      .attr('marker-end', (d) => (isHighlighted(d) ? 'url(#arrow-end)' : null))
      .attr('marker-start', (d) => (isHighlighted(d) && d.bidirectional ? 'url(#arrow-start)' : null));
  };

  // One-time setup: layers, markers, zoom, simulation, resize handling
  useEffect(() => {
    const svgEl = svgRef.current;
    const container = containerRef.current;
    if (!svgEl || !container) return;

    const svg = d3.select(svgEl);
    svg.append('style').text(TRANSITION_CSS);
    const defs = svg.append('defs');
    for (const [id, orient] of [['arrow-end', 'auto'], ['arrow-start', 'auto-start-reverse']] as const) {
      defs
        .append('marker')
        .attr('id', id)
        .attr('viewBox', '0 -3 6 6')
        .attr('refX', 6)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('orient', orient)
        .append('path')
        .attr('d', 'M0,-3L6,0L0,3')
        .attr('fill', ACCENT);
    }

    const viewport = svg.append('g').attr('class', 'viewport');
    viewport.append('g').attr('class', 'links');
    viewport.append('g').attr('class', 'nodes');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform);
        zoomKRef.current = event.transform.k;
        applyLabelScale();
        applyHighlight();
      });
    svg.call(zoom).on('dblclick.zoom', null);
    zoomRef.current = zoom;

    const { width, height } = container.getBoundingClientRect();
    const simulation = d3
      .forceSimulation<SimNode, SimLink>([])
      .velocityDecay(0.55)
      .alphaDecay(0.03)
      .force('link', d3.forceLink<SimNode, SimLink>([]).id((d) => d.id).distance(45))
      .force('charge', d3.forceManyBody<SimNode>().strength(-100).distanceMax(350))
      .force('x', d3.forceX<SimNode>(width / 2).strength(0.06))
      .force('y', d3.forceY<SimNode>(height / 2).strength(0.06))
      .force('collide', d3.forceCollide<SimNode>().radius((d) => d.radius + 3));

    // Zoom to fit once the first layout has mostly settled
    let fitted = false;
    const fitToView = () => {
      const simNodes = simulation.nodes();
      if (simNodes.length === 0) return;
      const rect = container.getBoundingClientRect();
      const xs = simNodes.map((n) => n.x ?? 0);
      const ys = simNodes.map((n) => n.y ?? 0);
      const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const padding = 60;
      const k = Math.min(
        2,
        (rect.width - padding * 2) / Math.max(maxX - minX, 1),
        (rect.height - padding * 2) / Math.max(maxY - minY, 1)
      );
      const transform = d3.zoomIdentity
        .translate(rect.width / 2, rect.height / 2)
        .scale(k)
        .translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
      svg.transition().duration(750).ease(d3.easeCubicOut).call(zoom.transform, transform);
    };

    simulation.on('tick', () => {
      viewport
        .selectAll<SVGLineElement, SimLink>('line.link')
        .each(function (d) {
          const s = d.source as SimNode;
          const t = d.target as SimNode;
          const dx = (t.x ?? 0) - (s.x ?? 0);
          const dy = (t.y ?? 0) - (s.y ?? 0);
          const dist = Math.hypot(dx, dy) || 1;
          // End lines at the node border so arrow heads stay visible on hover
          const startPad = s.radius + 1;
          const endPad = t.radius + 1;
          d3.select(this)
            .attr('x1', (s.x ?? 0) + (dx / dist) * startPad)
            .attr('y1', (s.y ?? 0) + (dy / dist) * startPad)
            .attr('x2', (t.x ?? 0) - (dx / dist) * endPad)
            .attr('y2', (t.y ?? 0) - (dy / dist) * endPad);
        });
      viewport
        .selectAll<SVGGElement, SimNode>('g.node')
        .attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);

      if (!fitted && simulation.alpha() < 0.1) {
        fitted = true;
        fitToView();
      }
    });
    simulationRef.current = simulation;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      simulation.force('x', d3.forceX<SimNode>(rect.width / 2).strength(0.06));
      simulation.force('y', d3.forceY<SimNode>(rect.height / 2).strength(0.06));
      simulation.alpha(0.05).restart();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      simulation.stop();
      svg.interrupt();
      svg.selectAll('*').remove();
      svg.on('.zoom', null);
      simulationRef.current = null;
      zoomRef.current = null;
    };
  }, []);

  // Data updates: keep positions of known nodes, place new ones next to a neighbour
  useEffect(() => {
    const simulation = simulationRef.current;
    const svgEl = svgRef.current;
    const container = containerRef.current;
    if (!simulation || !svgEl || !container) return;

    const adjacency = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
      adjacency.get(e.source)!.add(e.target);
      adjacency.get(e.target)!.add(e.source);
    }
    adjacencyRef.current = adjacency;

    const previous = simNodesRef.current;
    const isFirstLayout = previous.size === 0;
    const { width, height } = container.getBoundingClientRect();
    const next = new Map<string, SimNode>();

    for (const node of nodes) {
      const old = previous.get(node.id);
      if (old) {
        next.set(node.id, Object.assign(old, node, { radius: nodeRadius(node, centreId) }));
        continue;
      }
      const anchorId = [...(adjacency.get(node.id) ?? [])].find((id) => previous.has(id));
      const anchor = anchorId ? previous.get(anchorId) : undefined;
      const jitter = () => (Math.random() - 0.5) * 40;
      next.set(node.id, {
        ...node,
        radius: nodeRadius(node, centreId),
        x: (anchor?.x ?? width / 2) + jitter(),
        y: (anchor?.y ?? height / 2) + jitter(),
      });
    }
    // Remember positions of hidden nodes too, so they return to their place when filters change
    for (const [id, old] of previous) {
      if (!next.has(id)) next.set(id, old);
    }
    simNodesRef.current = next;

    const simNodes = nodes.map((n) => next.get(n.id)!);
    const simLinks: SimLink[] = edges.map((e) => ({
      key: `${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      bidirectional: e.bidirectional,
    }));

    const color = d3.scaleOrdinal<string, string>().domain(groups).range(isDark ? PALETTE_DARK : PALETTE_LIGHT);
    const svg = d3.select(svgEl);

    svg
      .select<SVGGElement>('g.links')
      .selectAll<SVGLineElement, SimLink>('line.link')
      .data(simLinks, (d) => d.key)
      .join('line')
      .attr('class', 'link')
      .attr('stroke-width', 0.8)
      .attr('stroke-linecap', 'round');

    const nodeGroups = svg
      .select<SVGGElement>('g.nodes')
      .selectAll<SVGGElement, SimNode>('g.node')
      .data(simNodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'node');
        g.append('circle');
        // Folders are drawn as rounded squares
        g.append('rect').attr('class', 'folder-shape');
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('fill', FOREGROUND)
          .attr('pointer-events', 'none');
        return g;
      });

    nodeGroups
      .style('cursor', (d) => (d.ghost ? 'default' : 'pointer'))
      .on('mouseenter', (_event, d) => {
        hoveredRef.current = d.id;
        applyHighlight();
      })
      .on('mouseleave', () => {
        hoveredRef.current = null;
        applyHighlight();
      })
      .on('click', (event, d) => {
        if (event.defaultPrevented || d.ghost) return;
        onOpenNoteRef.current(d.id);
      })
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            draggingRef.current = true;
            if (!event.active) simulation.alphaTarget(0.2).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            draggingRef.current = false;
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeGroups
      .select('rect')
      .attr('display', (d) => (d.kind === 'folder' ? null : 'none'))
      .attr('x', (d) => -d.radius)
      .attr('y', (d) => -d.radius)
      .attr('width', (d) => d.radius * 2)
      .attr('height', (d) => d.radius * 2)
      .attr('rx', 3)
      .attr('fill', (d) => color(d.group))
      .attr('stroke', 'var(--vscode-editor-foreground, #cccccc)')
      .attr('stroke-width', 1);

    nodeGroups
      .select('circle')
      .attr('display', (d) => (d.kind === 'folder' ? 'none' : null))
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (d.ghost ? 'none' : color(d.group)))
      .attr('stroke', (d) =>
        d.id === centreId ? ACCENT : d.ghost ? 'var(--vscode-descriptionForeground, #999999)' : 'none'
      )
      .attr('stroke-width', (d) => (d.id === centreId ? 3 : 1))
      .attr('stroke-dasharray', (d) => (d.ghost ? '2,2' : null));

    nodeGroups
      .select('text')
      .attr('fill-opacity', (d) => (d.ghost ? 0.6 : 0.9))
      .text((d) => (d.kind === 'folder' ? `📁 ${d.title}` : d.title));

    nodeGroups.selectAll<SVGTitleElement, SimNode>('title').data((d) => [d]).join('title').text((d) => d.relativePath);

    simulation.nodes(simNodes);
    simulation.force<d3.ForceLink<SimNode, SimLink>>('link')!.links(simLinks);
    simulation.alpha(isFirstLayout ? 1 : 0.15).restart();

    applyLabelScale();
    applyHighlight();
  }, [nodes, edges, groups, isDark, centreId]);

  // A new centre: move the view to it without changing the zoom level
  useEffect(() => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    const centre = centreId ? simNodesRef.current.get(centreId) : undefined;
    if (!svgEl || !zoom || !centre || draggingRef.current) return;
    d3.select(svgEl)
      .transition()
      .duration(RECENTRE_MS)
      .ease(d3.easeCubicOut)
      .call(zoom.translateTo, centre.x ?? 0, centre.y ?? 0);
  }, [centreId]);

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
      <svg ref={svgRef} className="absolute inset-0 w-full h-full select-none" />
    </div>
  );
};
