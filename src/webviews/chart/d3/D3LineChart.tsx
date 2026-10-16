import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { DataPoint } from './D3BarChart';

interface D3LineChartProps {
  data: DataPoint[];
  isDark: boolean;
  options?: Record<string, any>;
}

export const D3LineChart: React.FC<D3LineChartProps> = ({ data, isDark, options = {} }) => {
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

    const primaryColor = isDark ? '#38bdf8' : '#0284c7';
    const textColor = isDark ? '#f4f4f5' : '#0f172a';
    const axisColor = isDark ? '#52525b' : '#94a3b8';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    // Scales
    const x = d3
      .scalePoint()
      .domain(data.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.2);

    const maxVal = d3.max(data, (d) => d.value) || 10;
    const minVal = Math.min(0, d3.min(data, (d) => d.value) || 0);

    const y = d3
      .scaleLinear()
      .domain([minVal, maxVal * 1.15])
      .nice()
      .range([innerHeight, 0]);

    // Grid lines
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

    // Axes
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x));

    xAxis.select('.domain').attr('stroke', axisColor);
    xAxis.selectAll('text').attr('fill', textColor).attr('font-size', '12px').attr('font-weight', '500');

    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(5));
    yAxis.select('.domain').attr('stroke', axisColor);
    yAxis.selectAll('text').attr('fill', textColor).attr('font-size', '12px').attr('font-weight', '500');

    // Area Gradient
    const defs = svg.append('defs');
    const areaGradId = 'line-area-grad-' + Math.random().toString(36).slice(2, 7);
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', areaGradId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGrad.append('stop').attr('offset', '0%').attr('stop-color', primaryColor).attr('stop-opacity', 0.4);
    areaGrad.append('stop').attr('offset', '100%').attr('stop-color', primaryColor).attr('stop-opacity', 0.0);

    // Area Generator
    const area = d3
      .area<DataPoint>()
      .x((d) => x(d.label) || 0)
      .y0(innerHeight)
      .y1((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', `url(#${areaGradId})`)
      .attr('d', area);

    // Line Generator
    const line = d3
      .line<DataPoint>()
      .x((d) => x(d.label) || 0)
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    const path = g
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', primaryColor)
      .attr('stroke-width', 3)
      .attr('d', line);

    // Animate line stroke
    const totalLength = path.node()?.getTotalLength() || 1000;
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Dots
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => x(d.label) || 0)
      .attr('cy', (d) => y(d.value))
      .attr('r', 5)
      .attr('fill', isDark ? '#0f172a' : '#ffffff')
      .attr('stroke', primaryColor)
      .attr('stroke-width', 2.5)
      .attr('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).transition().duration(150).attr('r', 8);
        const [mX, mY] = d3.pointer(event, container);
        setTooltip({
          x: mX,
          y: mY - 12,
          text: `${d.label}: ${d.value}`,
        });
      })
      .on('mousemove', function (event, d) {
        const [mX, mY] = d3.pointer(event, container);
        setTooltip({
          x: mX,
          y: mY - 12,
          text: `${d.label}: ${d.value}`,
        });
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(150).attr('r', 5);
        setTooltip(null);
      });
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
