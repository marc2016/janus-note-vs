import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

export interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  label?: string;
  group?: string | number;
  size?: number;
  color?: string;
}

export interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
  value?: number;
  label?: string;
}

interface D3NetworkGraphProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  isDark: boolean;
  options?: Record<string, any>;
}

export const D3NetworkGraph: React.FC<D3NetworkGraphProps> = ({
  nodes: initialNodes,
  links: initialLinks,
  isDark,
  options = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);

  useEffect(() => {
    if (!containerRef.current || !initialNodes || initialNodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 700;
    const height = container.clientHeight || 500;

    d3.select(container).selectAll('svg').remove();

    // Deep copy data to avoid mutating original props across simulation ticks
    const nodes: NetworkNode[] = initialNodes.map((d) => ({ ...d }));
    const links: NetworkLink[] = initialLinks.map((d) => ({ ...d }));

    const colorPalette = isDark
      ? ['#6366f1', '#38bdf8', '#34d399', '#f59e0b', '#ec4899', '#a855f7', '#fb7185']
      : ['#4f46e5', '#0284c7', '#059669', '#d97706', '#db2777', '#9333ea', '#e11d48'];

    const color = d3
      .scaleOrdinal<string>()
      .domain(nodes.map((d) => String(d.group || 0)))
      .range(colorPalette);

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'overflow-hidden font-sans cursor-grab active:cursor-grabbing');

    // Add arrow marker
    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', isDark ? '#71717a' : '#94a3b8');

    // Root group for zooming
    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Force simulation
    const simulation = d3
      .forceSimulation<NetworkNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<NetworkNode, NetworkLink>(links)
          .id((d) => d.id)
          .distance(options.linkDistance || 100)
      )
      .force('charge', d3.forceManyBody().strength(options.chargeStrength || -320))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(35));

    // Links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')
      .attr('stroke-width', (d) => Math.sqrt(d.value || 1) * 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Link Labels if present
    const linkLabels = g
      .append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links.filter((l) => l.label))
      .enter()
      .append('text')
      .attr('fill', isDark ? '#a1a1aa' : '#64748b')
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .attr('dy', -4)
      .text((d) => d.label || '');

    // Nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(
        d3
          .drag<SVGGElement, NetworkNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node circle
    node
      .append('circle')
      .attr('r', (d) => d.size || 14)
      .attr('fill', (d) => d.color || color(String(d.group || 0)))
      .attr('stroke', isDark ? '#18181b' : '#ffffff')
      .attr('stroke-width', 2.5)
      .attr('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))')
      .on('mouseenter', function (_, d) {
        d3.select(this).transition().duration(150).attr('r', (d.size || 14) * 1.3);
        setHoveredNode(d);
      })
      .on('mouseleave', function (_, d) {
        d3.select(this).transition().duration(150).attr('r', d.size || 14);
        setHoveredNode(null);
      });

    // Node label text
    node
      .append('text')
      .attr('dy', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', isDark ? '#f4f4f5' : '#0f172a')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .text((d) => d.label || d.id);

    // Simulation tick update
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as NetworkNode).x || 0)
        .attr('y1', (d) => (d.source as NetworkNode).y || 0)
        .attr('x2', (d) => (d.target as NetworkNode).x || 0)
        .attr('y2', (d) => (d.target as NetworkNode).y || 0);

      linkLabels
        .attr(
          'x',
          (d) => (((d.source as NetworkNode).x || 0) + ((d.target as NetworkNode).x || 0)) / 2
        )
        .attr(
          'y',
          (d) => (((d.source as NetworkNode).y || 0) + ((d.target as NetworkNode).y || 0)) / 2
        );

      node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [initialNodes, initialLinks, isDark, options]);

  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-[350px]">
      <div ref={containerRef} className="w-full h-full flex items-center justify-center" />
      {hoveredNode && (
        <div className="absolute top-3 left-3 z-10 p-2.5 rounded-lg border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(30,30,30,0.9))] shadow-md text-xs">
          <div className="font-semibold">{hoveredNode.label || hoveredNode.id}</div>
          {hoveredNode.group !== undefined && (
            <div className="opacity-75">Group: {hoveredNode.group}</div>
          )}
          <div className="opacity-60 text-[10px] mt-0.5">ID: {hoveredNode.id}</div>
        </div>
      )}
    </div>
  );
};
