import React, { useState, useEffect } from 'react';
import mermaid from 'mermaid';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MdiIcon } from '../components/ui/MdiIcon';
import {
  mdiChartTimelineVariant,
  mdiCodeTags,
  mdiAlertCircleOutline,
  mdiThemeLightDark,
  mdiChartBar,
  mdiChartLine,
  mdiChartDonut,
  mdiGraphOutline,
} from '../../ui/icons';
import { D3BarChart, DataPoint } from './d3/D3BarChart';
import { D3LineChart } from './d3/D3LineChart';
import { D3DonutChart } from './d3/D3DonutChart';
import { D3NetworkGraph, NetworkNode, NetworkLink } from './d3/D3NetworkGraph';

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
function getVsCodeApi() {
  if (!vscodeApi && typeof acquireVsCodeApi === 'function') {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export interface ChartData {
  version?: number;
  title?: string;
  chartType?: string;
  code?: string;
  data?: DataPoint[];
  nodes?: NetworkNode[];
  links?: NetworkLink[];
  options?: Record<string, any>;
}

function getInitialData(): ChartData {
  try {
    const el = document.getElementById('initial-data');
    if (el && el.textContent) {
      return JSON.parse(el.textContent);
    }
  } catch {}
  return {
    version: 1,
    title: 'Janus Diagram & Chart View',
    chartType: 'mermaid',
    code: 'graph TD\n    A[Start] --> B[Finish]',
  };
}

function detectIsDark(): boolean {
  if (typeof document === 'undefined') return true;
  if (
    document.body.classList.contains('vscode-light') ||
    document.body.classList.contains('vscode-high-contrast-light')
  ) {
    return false;
  }
  if (
    document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast')
  ) {
    return true;
  }
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

function applyMermaidTheme(isDark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    themeVariables: isDark
      ? {
          darkMode: true,
          background: '#18181b',
          primaryColor: '#1e1b4b',
          primaryTextColor: '#f8fafc',
          primaryBorderColor: '#818cf8',
          lineColor: '#cbd5e1',
          secondaryColor: '#27272a',
          tertiaryColor: '#09090b',
          actorBkg: '#1e1b4b',
          actorBorder: '#818cf8',
          actorTextColor: '#ffffff',
          actorLineColor: '#94a3b8',
          signalColor: '#e2e8f0',
          signalTextColor: '#f8fafc',
          labelBoxBkgColor: '#27272a',
          labelBoxBorderColor: '#71717a',
          labelTextColor: '#f4f4f5',
          loopTextColor: '#f4f4f5',
          noteBkgColor: '#78350f',
          noteBorderColor: '#f59e0b',
          noteTextColor: '#fef3c7',
          activationBkgColor: '#3730a3',
          activationBorderColor: '#818cf8',
          sequenceNumberColor: '#ffffff',
        }
      : {
          darkMode: false,
          background: '#ffffff',
          primaryColor: '#e0e7ff',        // Indigo 100
          primaryTextColor: '#0f172a',    // Crisp Slate 900
          primaryBorderColor: '#3730a3',  // Indigo 800
          lineColor: '#0f172a',           // Sharp dark lines
          secondaryColor: '#f1f5f9',
          tertiaryColor: '#ffffff',
          actorBkg: '#e0e7ff',            // Light indigo container
          actorBorder: '#3730a3',         // Crisp border
          actorTextColor: '#0f172a',      // Strong dark text
          actorLineColor: '#0f172a',      // High contrast lifeline
          signalColor: '#0f172a',         // Sharp signal line
          signalTextColor: '#0f172a',     // Deep black message text
          labelBoxBkgColor: '#f8fafc',
          labelBoxBorderColor: '#0f172a',
          labelTextColor: '#0f172a',
          loopTextColor: '#0f172a',
          noteBkgColor: '#fef08a',        // Yellow 200
          noteBorderColor: '#ca8a04',     // Yellow 600
          noteTextColor: '#713f12',       // Yellow 900
          activationBkgColor: '#c7d2fe',  // Indigo 200
          activationBorderColor: '#3730a3',
          sequenceNumberColor: '#ffffff',
        },
  });
}

type ThemeMode = 'auto' | 'light' | 'dark';

export const DiagramViewApp: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData>(getInitialData);
  const [svgOutput, setSvgOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [isSystemDark, setIsSystemDark] = useState<boolean>(detectIsDark);

  // Active view mode for D3 data charts (bar, line, donut)
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);

  const effectiveIsDark = themeMode === 'auto' ? isSystemDark : themeMode === 'dark';

  // Monitor VS Code theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsSystemDark(detectIsDark());
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleMedia = () => setIsSystemDark(detectIsDark());
    mediaQuery.addEventListener('change', handleMedia);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleMedia);
    };
  }, []);

  // Determine current engine and active visual type
  const hasD3Data = Array.isArray(chartData.data) && chartData.data.length > 0;
  const hasD3Network = Array.isArray(chartData.nodes) && chartData.nodes.length > 0;
  const hasMermaidCode = typeof chartData.code === 'string' && chartData.code.trim().length > 0;

  const rawType = (chartData.chartType || '').toLowerCase();
  
  // Decide whether to use D3 or Mermaid
  const isExplicitMermaid = rawType === 'mermaid' || rawType === 'flowchart';
  const isExplicitD3 = ['bar', 'line', 'donut', 'pie', 'network', 'graph'].includes(rawType);

  let activeEngine: 'mermaid' | 'd3' = 'mermaid';
  if (isExplicitD3 || (hasD3Data || hasD3Network) && !isExplicitMermaid) {
    activeEngine = 'd3';
  } else if (hasMermaidCode) {
    activeEngine = 'mermaid';
  }

  const activeD3Type = selectedSubtype || (rawType || (hasD3Network ? 'network' : 'bar'));

  const renderMermaidDiagram = async (code: string, isDark: boolean) => {
    if (!code || !code.trim()) {
      setSvgOutput('');
      setError('No Mermaid diagram code provided.');
      return;
    }

    try {
      setError(null);
      applyMermaidTheme(isDark);
      const id = 'mermaid-svg-' + Math.random().toString(36).slice(2, 9);
      const { svg } = await mermaid.render(id, code);
      setSvgOutput(svg);
    } catch (err: any) {
      setError(err?.message || String(err));
      setSvgOutput('');
    }
  };

  useEffect(() => {
    if (activeEngine === 'mermaid' && chartData.code) {
      renderMermaidDiagram(chartData.code, effectiveIsDark);
    }
  }, [chartData.code, effectiveIsDark, activeEngine]);

  useEffect(() => {
    // Notify extension host that webview is ready
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'ready' });
    }

    // Listen for updates from extension host
    const handleMessage = async (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'init') {
        const data: ChartData = message.data;
        setChartData(data);
        if (data.code) {
          await renderMermaidDiagram(data.code, effectiveIsDark);
        }
      } else if (message.type === 'error') {
        setError(message.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleOpenSource = () => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'openSource' });
    }
  };

  const handleToggleTheme = () => {
    setThemeMode((prev) => (prev === 'auto' ? 'light' : prev === 'light' ? 'dark' : 'auto'));
  };

  return (
    <div className="flex flex-col h-screen p-4 box-border bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] font-sans">
      {/* Header */}
      <header className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))]">
        <div className="flex items-center gap-3">
          <MdiIcon path={mdiChartTimelineVariant} size={22} className="text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">
            {chartData.title || (activeEngine === 'd3' ? 'Interactive D3 Chart' : 'Mermaid Diagram')}
          </h1>
          <Badge variant="outline" className="uppercase font-mono text-[11px] ml-1">
            Engine: {activeEngine === 'd3' ? 'D3.js' : 'Mermaid'}
          </Badge>
          <Badge variant="secondary" className="uppercase font-mono text-[11px]">
            Type: {activeEngine === 'd3' ? activeD3Type : (chartData.chartType || 'sequence/flow')}
          </Badge>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick toggle between D3 data types if data points exist */}
          {activeEngine === 'd3' && hasD3Data && (
            <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-md border border-border">
              <Button
                variant={activeD3Type === 'bar' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setSelectedSubtype('bar')}
                title="Bar Chart"
              >
                <MdiIcon path={mdiChartBar} size={14} />
                <span>Bar</span>
              </Button>
              <Button
                variant={activeD3Type === 'line' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setSelectedSubtype('line')}
                title="Line Chart"
              >
                <MdiIcon path={mdiChartLine} size={14} />
                <span>Line</span>
              </Button>
              <Button
                variant={activeD3Type === 'donut' || activeD3Type === 'pie' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setSelectedSubtype('donut')}
                title="Donut Chart"
              >
                <MdiIcon path={mdiChartDonut} size={14} />
                <span>Donut</span>
              </Button>
            </div>
          )}

          {/* Theme Mode Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleTheme}
            title="Toggle contrast / theme (Auto, Light, Dark)"
          >
            <MdiIcon path={mdiThemeLightDark} size={15} />
            <span className="capitalize">
              {themeMode === 'auto' ? `Auto (${effectiveIsDark ? 'Dark' : 'Light'})` : themeMode}
            </span>
          </Button>

          {/* Open Raw JSON File in Beside Column */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenSource}
            title="Dokument in zweiter Spalte öffnen und bearbeiten"
          >
            <MdiIcon path={mdiCodeTags} size={15} />
            <span>Dokument bearbeiten</span>
          </Button>
        </div>
      </header>

      {/* Main Container - full width preview */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className={`flex-1 flex flex-col items-center justify-center p-6 rounded-lg border transition-colors overflow-hidden ${
            effectiveIsDark
              ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100'
              : 'bg-white border-slate-300 text-slate-900 shadow-sm'
          }`}
        >
          {error ? (
            <div className="flex items-start gap-2.5 p-3 text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 max-w-xl">
              <MdiIcon path={mdiAlertCircleOutline} size={18} className="mt-0.5" />
              <div>
                <strong>Diagram Syntax Error:</strong>
                <pre className="mt-1 text-xs whitespace-pre-wrap font-mono opacity-90">{error}</pre>
              </div>
            </div>
          ) : activeEngine === 'd3' ? (
            // D3.js Renderers
            <div className="w-full h-full flex items-center justify-center">
              {activeD3Type === 'network' || activeD3Type === 'graph' ? (
                <D3NetworkGraph
                  nodes={chartData.nodes || []}
                  links={chartData.links || []}
                  isDark={effectiveIsDark}
                  options={chartData.options}
                />
              ) : activeD3Type === 'line' ? (
                <D3LineChart
                  data={chartData.data || []}
                  isDark={effectiveIsDark}
                  options={chartData.options}
                />
              ) : activeD3Type === 'donut' || activeD3Type === 'pie' ? (
                <D3DonutChart
                  data={chartData.data || []}
                  isDark={effectiveIsDark}
                  options={chartData.options}
                />
              ) : (
                <D3BarChart
                  data={chartData.data || []}
                  isDark={effectiveIsDark}
                  options={chartData.options}
                />
              )}
            </div>
          ) : (
            // Mermaid SVG Renderer
            <div
              className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full overflow-auto"
              dangerouslySetInnerHTML={{ __html: svgOutput }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

