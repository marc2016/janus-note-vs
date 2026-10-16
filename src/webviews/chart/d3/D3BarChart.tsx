import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

export interface DataPoint {
  label: string;
  value: number;
  category?: string;
  color?: string;
}

interface D3BarChartProps {
  data: DataPoint[];
  isDark: boolean;
  options?: Record<string, any>;
}

export const D3BarChart: React.FC<D3BarChartProps> = ({ data, isDark, options = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;

    d3.select(container).selectAll('svg').remove();

    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'overflow-visible font-sans');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Color definitions
    const defaultBarColor = isDark ? '#6366f1' : '#4f46e5';
    const textColor = isDark ? '#f4f4f5' : '#0f172a';
    const axisColor = isDark ? '#52525b' : '#94a3b8';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    // Scales
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.3);

    const maxVal = d3.max(data, (d) => d.value) || 10;
    const y = d3
      .scaleLinear()
      .domain([0, maxVal * 1.15])
      .nice()
      .range([innerHeight, 0]);

    // Horizontal grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(y)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', gridColor);

    g.select('.grid').select('.domain').remove();

    // X Axis
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x));

    xAxis.select('.domain').attr('stroke', axisColor);
    xAxis
      .selectAll('text')
      .attr('fill', textColor)
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('dy', '1em');

    // Y Axis
    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(5));
    yAxis.select('.domain').attr('stroke', axisColor);
    yAxis.selectAll('text').attr('fill', textColor).attr('font-size', '12px').attr('font-weight', '500');

    // Gradient
    const defs = svg.append('defs');
    const gradId = 'bar-gradient-' + Math.random().toString(36).slice(2, 7);
    const grad = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    grad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', defaultBarColor)
      .attr('stop-opacity', 0.95);

    grad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', defaultBarColor)
      .attr('stop-opacity', isDark ? 0.6 : 0.75);

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.label) || 0)
      .attr('width', x.bandwidth())
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('rx', 4)
      .attr('fill', (d) => d.color || `url(#${gradId})`)
      .attr('cursor', 'pointer')
      .style('transition', 'filter 0.15s ease')
      .on('mouseenter', function (event, d) {
        d3.select(this).style('filter', 'brightness(1.2)');
        const [mX, mY] = d3.pointer(event, container);
        setTooltip({
          x: mX,
          y: mY - 10,
          text: `${d.label}: ${d.value}`,
        });
      })
      .on('mousemove', function (event, d) {
        const [mX, mY] = d3.pointer(event, container);
        setTooltip({
          x: mX,
          y: mY - 10,
          text: `${d.label}: ${d.value}`,
        });
      })
      .on('mouseleave', function () {
        d3.select(this).style('filter', 'none');
        setTooltip(null);
      })
      .transition()
      .duration(750)
      .delay((_, i) => i * 40)
      .ease(d3.easeCubicOut)
      .attr('y', (d) => y(d.value))
      .attr('height', (d) => innerHeight - y(d.value));

    // Value labels on top of bars
    g.selectAll('.bar-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', (d) => (x(d.label) || 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.value) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', textColor)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('opacity', 0)
      .text((d) => d.value)
      .transition()
      .duration(750)
      .delay((_, i) => i * 40 + 200)
      .attr('opacity', 0.9);

    // Optional Axis Labels
    if (options.xLabel) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 40)
        .attr('text-anchor', 'middle')
        .attr('fill', axisColor)
        .attr('font-size', '11px')
        .text(options.xLabel);
    }

    if (options.yLabel) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .attr('fill', axisColor)
        .attr('font-size', '11px')
        .text(options.yLabel);
    }
  }, [data, isDark, options]);

  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-[300px]">
      <div ref={containerRef} className="w-full h-full flex items-center justify-center" />
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 px-2.5 py-1 text-xs font-medium rounded-md shadow-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 transform -translate-x-1/2 -translate-y-full border border-white/10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
};
