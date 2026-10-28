import React, { useEffect, useMemo, useState } from 'react';
import type { NoteGraphData } from '../../services/noteGraphService';
import { NoteGraphCanvas } from './NoteGraphCanvas';
import { DEFAULT_GRAPH_FILTER, GraphFilterOptions, filterGraph } from './graphFilter';

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

function detectIsDark(): boolean {
  const classes = document.body.classList;
  if (classes.contains('vscode-light') || classes.contains('vscode-high-contrast-light')) return false;
  if (classes.contains('vscode-dark') || classes.contains('vscode-high-contrast')) return true;
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

export const NoteGraphApp: React.FC = () => {
  const [data, setData] = useState<NoteGraphData | null>(null);
  const [filter, setFilter] = useState<GraphFilterOptions>(() => ({
    ...DEFAULT_GRAPH_FILTER,
    ...(getVsCodeApi()?.getState()?.filter ?? {}),
  }));
  const [isDark, setIsDark] = useState(detectIsDark);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'graphData') setData(event.data.data);
    };
    window.addEventListener('message', handleMessage);
    getVsCodeApi()?.postMessage({ type: 'ready' });

    // VS Code switches theme classes on <body> without reloading the webview
    const themeObserver = new MutationObserver(() => setIsDark(detectIsDark()));
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('message', handleMessage);
      themeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    getVsCodeApi()?.setState({ filter });
  }, [filter]);

  const visible = useMemo(() => (data ? filterGraph(data, filter) : null), [data, filter]);
  const groups = useMemo(
    () => (data ? [...new Set(data.nodes.filter((n) => !n.ghost).map((n) => n.group))].sort() : []),
    [data]
  );

  const visibleNoteCount = visible ? visible.nodes.filter((n) => !n.ghost).length : 0;
  const openNote = (id: string) => getVsCodeApi()?.postMessage({ type: 'openNote', uri: id });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-[var(--vscode-widget-border,rgba(128,128,128,0.2))] text-xs">
        <input
          type="search"
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          placeholder="Notizen filtern…"
          aria-label="Notizen filtern"
          className="h-7 w-56 px-2 rounded border text-xs border-[var(--vscode-input-border,rgba(128,128,128,0.3))] bg-[var(--vscode-input-background,transparent)] text-[var(--vscode-input-foreground,inherit)] focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
        />
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filter.showOrphans}
            onChange={(e) => setFilter({ ...filter, showOrphans: e.target.checked })}
          />
          Verwaiste Notizen anzeigen
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filter.showGhosts}
            onChange={(e) => setFilter({ ...filter, showGhosts: e.target.checked })}
          />
          Fehlende Notizen anzeigen
        </label>
        {visible && (
          <span className="ml-auto opacity-70">
            {visibleNoteCount} Notizen · {visible.edges.length} Verknüpfungen
          </span>
        )}
      </div>

      {!data ? (
        <div className="flex-1 flex items-center justify-center text-sm opacity-70">Notiz-Netzwerk wird geladen…</div>
      ) : visible && visible.nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm opacity-70">
          {data.nodes.length === 0 ? 'Noch keine Notizen vorhanden.' : 'Keine Notizen passen zu den Filtern.'}
        </div>
      ) : null}

      {/* Stays mounted while the empty state shows, so zoom and positions survive */}
      <div className={`flex-1 min-h-0 flex ${visible && visible.nodes.length > 0 ? '' : 'hidden'}`}>
        <NoteGraphCanvas
          nodes={visible?.nodes ?? []}
          edges={visible?.edges ?? []}
          groups={groups}
          isDark={isDark}
          onOpenNote={openNote}
        />
      </div>
    </div>
  );
};
