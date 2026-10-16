import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { DataPoint } from './D3BarChart';

interface D3DonutChartProps {
  data: DataPoint[];
  isDark: boolean;
  options?: Record<string, any>;
}

export const D3DonutChart: React.FC<D3DonutChartProps> = ({ data, isDark, options = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeItem, setActiveItem] = useState<DataPoint | null>(null);

  const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;
    const radius = Math.min(width, height) / 2 - 20;

    d3.select(container).selectAll('svg').remove();

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'overflow-visible font-sans');

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    const colorPalette = isDark
      ? ['#6366f1', '#38bdf8', '#34d399', '#f59e0b', '#ec4899', '#a855f7']
      : ['#4f46e5', '#0284c7', '#059669', '#d97706', '#db2777', '#9333ea'];

    const color = d3
      .scaleOrdinal<string>()
      .domain(data.map((d) => d.label))
      .range(colorPalette);

    const pie = d3
      .pie<DataPoint>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(0.02);

    const arc = d3
      .arc<d3.PieArcDatum<DataPoint>>()
      .innerRadius(radius * 0.58)
      .outerRadius(radius * 0.9)
      .cornerRadius(4);

    const arcHover = d3
      .arc<d3.PieArcDatum<DataPoint>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius * 0.96)
      .cornerRadius(5);

    const arcs = g.selectAll('.arc').data(pie(data)).enter().append('g').attr('class', 'arc');

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color || color(d.data.label))
      .attr('cursor', 'pointer')
      .style('transition', 'all 0.2s ease')
      .on('mouseenter', function (event, d) {
        d3.select(this).transition().duration(200).attr('d', arcHover as any);
        setActiveItem(d.data);
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(200).attr('d', arc as any);
        setActiveItem(null);
      });
  }, [data, isDark, options]);

  const textColor = isDark ? '#f4f4f5' : '#0f172a';
  const subtextColor = isDark ? '#a1a1aa' : '#64748b';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center min-h-[300px]">
      <div ref={containerRef} className="w-full h-full flex items-center justify-center" />

      {/* Center Label inside Donut hole */}
      <div className="absolute pointer-events-none flex flex-col items-center justify-center text-center">
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: subtextColor }}>
          {activeItem ? activeItem.label : options.centerLabel || 'Total'}
        </span>
        <span className="text-2xl font-bold tracking-tight" style={{ color: textColor }}>
          {activeItem ? activeItem.value : totalValue}
        </span>
        {activeItem && totalValue > 0 && (
          <span className="text-[11px] font-semibold opacity-75" style={{ color: subtextColor }}>
            {((activeItem.value / totalValue) * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Legend below donut */}
      <div className="flex flex-wrap gap-3 items-center justify-center mt-3 max-w-md">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-1.5 text-xs font-medium">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{
                backgroundColor:
                  d.color ||
                  (isDark
                    ? ['#6366f1', '#38bdf8', '#34d399', '#f59e0b', '#ec4899', '#a855f7'][i % 6]
                    : ['#4f46e5', '#0284c7', '#059669', '#d97706', '#db2777', '#9333ea'][i % 6]),
              }}
            />
            <span style={{ color: subtextColor }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
