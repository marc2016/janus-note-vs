import React, { useEffect, useState, useMemo } from 'react';
import { marked } from 'marked';
import {
  FolderOverviewData,
  FolderNoteCard,
} from '../../editors/folderOverviewViewProvider';
import { TaskDateChips } from '../tasks/TaskDateChips';
import type { FolderBacklink } from '../../services/noteLinkService';

/** Notes that link to this folder; hidden when there are none. */
export const FolderBacklinksSection: React.FC<{ backlinks?: FolderBacklink[]; onOpen: (backlink: FolderBacklink) => void }> = ({
  backlinks,
  onOpen,
}) => {
  if (!backlinks || backlinks.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-[var(--vscode-foreground,#cccccc)]">Verlinkt von ({backlinks.length})</h2>
      <div className="flex flex-wrap gap-2">
        {backlinks.map((backlink) => (
          <button
            key={`${backlink.uri}:${backlink.line}`}
            type="button"
            onClick={() => onOpen(backlink)}
            title={`${backlink.relativePath}, Zeile ${backlink.line} öffnen`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.35))] px-3 py-1 text-xs hover:border-[var(--vscode-focusBorder,#007acc)] cursor-pointer"
          >
            <span className="font-medium">{backlink.title}</span>
            <span className="opacity-60">:{backlink.line}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
import type { TaskPriority } from '../../models/tasks';

const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  high: 'bg-red-950 text-red-300 border border-red-800',
  medium: 'bg-blue-950 text-blue-300 border border-blue-800',
  low: 'bg-gray-800 text-gray-400',
};

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

export const FolderOverviewApp: React.FC = () => {
  const [data, setData] = useState<FolderOverviewData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const api = getVsCodeApi();
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      switch (msg.type) {
        case 'updateFolder': {
          setData(msg.data);
          // Reset summary when switching to a different folder
          setSummary(null);
          setSummaryError(null);
          setIncludeSubfolders(false);
          break;
        }
        case 'summaryLoading': {
          setIsSummaryLoading(!!msg.loading);
          break;
        }
        case 'summaryResult': {
          if (msg.summary) {
            setSummary(msg.summary);
            setSummaryError(null);
          } else if (msg.error) {
            setSummaryError(msg.error);
          }
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    api?.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const filteredNotes = useMemo(() => {
    if (!data?.notes) return [];
    if (!searchQuery.trim()) return data.notes;
    const q = searchQuery.toLowerCase().trim();
    return data.notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q) ||
        n.snippet.toLowerCase().includes(q)
    );
  }, [data?.notes, searchQuery]);

  const renderedSummaryHtml = useMemo(() => {
    if (!summary) return '';
    return marked.parse(summary, { async: false, gfm: true, breaks: true }) as string;
  }, [summary]);

  const handleOpenNote = (note: FolderNoteCard) => {
    getVsCodeApi()?.postMessage({
      type: 'openNote',
      noteUri: note.uri,
    });
  };

  const handleCreateNote = () => {
    if (!data?.folderUri) return;
    getVsCodeApi()?.postMessage({
      type: 'createNote',
      folderUri: data.folderUri,
    });
  };

  const handleOpenNoteGraph = () => {
    getVsCodeApi()?.postMessage({ type: 'openNoteGraph' });
  };

  const handleOpenFolderTasks = () => {
    if (!data?.folderUri) return;
    getVsCodeApi()?.postMessage({
      type: 'openFolderTasks',
      folderUri: data.folderUri,
    });
  };

  const handleGenerateSummary = () => {
    if (!data?.folderUri || isSummaryLoading) return;
    setSummaryError(null);
    getVsCodeApi()?.postMessage({
      type: 'generateSummary',
      folderUri: data.folderUri,
      includeSubfolders,
    });
  };

  const handleSaveSummaryAsNote = () => {
    if (!data?.folderUri || !summary) return;
    getVsCodeApi()?.postMessage({
      type: 'saveSummaryAsNote',
      folderUri: data.folderUri,
      saveLocationUri: data.defaultSaveLocation || data.folderUri,
      summaryContent: summary,
    });
  };

  const handleCopySummary = () => {
    if (!summary) return;
    getVsCodeApi()?.postMessage({
      type: 'copyToClipboard',
      text: summary,
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-[var(--vscode-descriptionForeground,#858585)]">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Ordnerdaten werden geladen…</span>
        </div>
      </div>
    );
  }

  const { notes, tasks, subfolderCount, folderName } = data;
  const taskProgress = tasks.totalCount > 0 ? Math.round((tasks.completedCount / tasks.totalCount) * 100) : 0;
  const hasSubfolders = data.mode === 'multi' ? !!data.canIncludeSubfolders : subfolderCount > 0;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--vscode-widget-border,rgba(128,128,128,0.2))]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-[var(--vscode-badge-background,rgba(128,128,128,0.2))] text-[var(--vscode-badge-foreground,inherit)]">
              {data.mode === 'multi' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
              )}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--vscode-foreground,#cccccc)]">
              {folderName}
            </h1>
          </div>
          <p className="text-xs text-[var(--vscode-descriptionForeground,#858585)] mt-1 font-mono break-all">
            {data.mode === 'multi'
              ? `${data.selectedCount || notes.length} Elemente in der Sidebar ausgewählt`
              : data.folderPath}
          </p>

          {/* Quick stats pills */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.1))] border border-[var(--vscode-widget-border,rgba(128,128,128,0.2))]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
              </svg>
              <span>{notes.length} Notiz{notes.length === 1 ? '' : 'en'}{data.mode === 'multi' ? ' enthalten' : ''}</span>
            </span>

            {tasks.exists && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.1))] border border-[var(--vscode-widget-border,rgba(128,128,128,0.2))]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span>{tasks.completedCount}/{tasks.totalCount} Aufgaben erledigt ({taskProgress}%)</span>
              </span>
            )}

            {subfolderCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.1))] border border-[var(--vscode-widget-border,rgba(128,128,128,0.2))]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
                <span>{subfolderCount} Unterordner</span>
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {data.isNotesRoot && (
            <button
              onClick={handleOpenNoteGraph}
              title="Alle Notizen und ihre Verknüpfungen als Netzwerk anzeigen"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-secondaryBackground,#3a3d41)] text-[var(--vscode-button-secondaryForeground,#ffffff)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 16l-4-4V8.82C14.16 8.4 15 7.3 15 6c0-1.66-1.34-3-3-3S9 4.34 9 6c0 1.3.84 2.4 2 2.82V12l-4 4H3v5h5v-3.05l4-4.2 4 4.2V21h5v-5h-4z" />
              </svg>
              <span>Netzwerk</span>
            </button>
          )}
          {data.mode !== 'multi' && (
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-background,#0e639c)] text-[var(--vscode-button-foreground,#ffffff)] hover:bg-[var(--vscode-button-hoverBackground,#1177bb)] transition-colors shadow-sm cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              <span>Neue Notiz</span>
            </button>
          )}

          {tasks.exists ? (
            <button
              onClick={handleOpenFolderTasks}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-secondaryBackground,#3a3d41)] text-[var(--vscode-button-secondaryForeground,#ffffff)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
              </svg>
              <span>Aufgaben</span>
            </button>
          ) : (
            data.mode !== 'multi' && (
              <button
                onClick={handleOpenFolderTasks}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-secondaryBackground,#3a3d41)] text-[var(--vscode-button-secondaryForeground,#ffffff)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] transition-colors cursor-pointer"
                title="Erstellt tasks.json für diesen Ordner und öffnet die Aufgaben"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
                <span>Aufgaben anlegen</span>
              </button>
            )
          )}

          <button
            onClick={() => {
              getVsCodeApi()?.postMessage({
                type: 'exportPdf',
                folderUri: data.folderUri,
              });
            }}
            title="Notizen als Sammel-PDF exportieren"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-secondaryBackground,#3a3d41)] text-[var(--vscode-button-secondaryForeground,#ffffff)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            <span>Als PDF exportieren</span>
          </button>
        </div>
      </div>

      {/* AI Summary Section */}
      <div className="rounded-lg border border-[var(--vscode-widget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.06))] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
              </svg>
            </span>
            <h2 className="text-base font-semibold text-[var(--vscode-foreground,#cccccc)]">
              KI-Zusammenfassung
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {hasSubfolders && (
              <label className="flex items-center gap-2 text-xs text-[var(--vscode-descriptionForeground,#858585)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSubfolders}
                  onChange={(e) => setIncludeSubfolders(e.target.checked)}
                  className="rounded border-[var(--vscode-input-border,#3c3c3c)] accent-[var(--vscode-button-background,#0e639c)]"
                />
                <span>Unterordner einbeziehen</span>
              </label>
            )}

            <button
              onClick={handleGenerateSummary}
              disabled={isSummaryLoading || (notes.length === 0 && (!includeSubfolders || !hasSubfolders))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-background,#0e639c)] text-[var(--vscode-button-foreground,#ffffff)] hover:bg-[var(--vscode-button-hoverBackground,#1177bb)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isSummaryLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Analysiere…</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
                  </svg>
                  <span>{summary ? 'Neu generieren' : 'Zusammenfassung generieren'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {summaryError && (
          <div className="p-3 text-xs rounded bg-red-900/30 border border-red-700/50 text-red-200">
            {summaryError}
          </div>
        )}

        {summary ? (
          <div className="space-y-4 pt-2">
            <div
              className="summary-markdown pt-1"
              dangerouslySetInnerHTML={{ __html: renderedSummaryHtml }}
            />

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[var(--vscode-widget-border,rgba(128,128,128,0.15))]">
              <button
                onClick={handleCopySummary}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-secondaryBackground,#3a3d41)] text-[var(--vscode-button-secondaryForeground,#ffffff)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-green-400">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    <span>Kopiert!</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                    </svg>
                    <span>Kopieren</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSaveSummaryAsNote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-background,#0e639c)] text-[var(--vscode-button-foreground,#ffffff)] hover:bg-[var(--vscode-button-hoverBackground,#1177bb)] transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                </svg>
                <span>Als Notiz speichern</span>
              </button>
            </div>
          </div>
        ) : (
          !isSummaryLoading && (
            <p className="text-xs text-[var(--vscode-descriptionForeground,#858585)] italic">
              {notes.length === 0 && hasSubfolders
                ? includeSubfolders
                  ? 'Klicke auf "Zusammenfassung generieren", um die Notizen der Unterordner per KI zusammenzufassen.'
                  : (data.mode === 'multi'
                      ? 'Die ausgewählten Ordner enthalten keine direkten Notizen. Aktiviere "Unterordner einbeziehen", um die Notizen der Unterordner zusammenzufassen.'
                      : 'Dieser Ordner enthält keine direkten Notizen. Aktiviere "Unterordner einbeziehen", um die Notizen der Unterordner zusammenzufassen.')
                : notes.length === 0
                ? (data.mode === 'multi'
                    ? 'In der aktuellen Auswahl wurden keine Markdown-Notizen gefunden.'
                    : 'In diesem Ordner wurden noch keine Markdown-Notizen gefunden.')
                : (data.mode === 'multi'
                    ? 'Klicke auf "Zusammenfassung generieren", um die ausgewählten Elemente per KI synthetisieren zu lassen.'
                    : 'Klicke auf "Zusammenfassung generieren", um die Inhalte dieses Ordners per KI synthetisieren zu lassen.')}
            </p>
          )
        )}
      </div>

      {/* Task Summary Section (if tasks exist) */}
      {tasks.exists && tasks.totalCount > 0 && (
        <div className="rounded-lg border border-[var(--vscode-widget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.06))] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <h2 className="text-sm font-semibold text-[var(--vscode-foreground,#cccccc)]">
                Aufgaben-Fortschritt ({tasks.completedCount}/{tasks.totalCount} erledigt)
              </h2>
            </div>

            <button
              onClick={handleOpenFolderTasks}
              className="text-xs text-[var(--vscode-textLink-foreground,#3794ff)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Zu den Aufgaben</span>
              <span>→</span>
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[var(--vscode-progressBar-background,rgba(128,128,128,0.2))] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[var(--vscode-button-background,#0e639c)] h-full transition-all duration-300"
              style={{ width: `${taskProgress}%` }}
            />
          </div>

          {/* Open tasks preview list */}
          {tasks.recentTasks.length > 0 && (
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tasks.recentTasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded bg-[var(--vscode-editor-background,#1e1e1e)] border border-[var(--vscode-widget-border,rgba(128,128,128,0.15))] text-xs"
                >
                  <span className={task.completed ? 'text-green-400' : 'text-gray-400'}>
                    {task.completed ? '✓' : '○'}
                  </span>
                  <span className={`truncate flex-1 min-w-0 ${task.completed ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </span>
                  <TaskDateChips task={task} />
                  {task.priority && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase shrink-0 ${PRIORITY_BADGE_CLASS[task.priority]}`}
                    >
                      {task.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data.mode === 'folder' && (
        <FolderBacklinksSection
          backlinks={data.folderBacklinks}
          onOpen={(backlink) =>
            getVsCodeApi()?.postMessage({ type: 'openNote', noteUri: backlink.uri, line: backlink.line })
          }
        />
      )}

      {/* Notes Grid Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--vscode-foreground,#cccccc)]">
              Notizen ({filteredNotes.length}{notes.length !== filteredNotes.length ? ` von ${notes.length}` : ''})
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Notizen filtern…"
              className="w-full px-3 py-1.5 text-xs rounded bg-[var(--vscode-input-background,#3c3c3c)] text-[var(--vscode-input-foreground,#cccccc)] border border-[var(--vscode-input-border,#3c3c3c)] focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-xs text-[var(--vscode-descriptionForeground,#858585)] hover:text-[var(--vscode-foreground,#cccccc)] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--vscode-widget-border,rgba(128,128,128,0.3))] p-8 text-center space-y-3">
            <p className="text-sm text-[var(--vscode-descriptionForeground,#858585)]">
              {searchQuery
                ? 'Keine Notizen gefunden, die dem Filter entsprechen.'
                : data.mode === 'multi'
                ? 'In der aktuellen Auswahl sind keine Markdown-Notizen vorhanden.'
                : 'In diesem Ordner sind noch keine Markdown-Notizen vorhanden.'}
            </p>
            {!searchQuery && data.mode !== 'multi' && (
              <button
                onClick={handleCreateNote}
                className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-background,#0e639c)] text-[var(--vscode-button-foreground,#ffffff)] hover:bg-[var(--vscode-button-hoverBackground,#1177bb)] cursor-pointer"
              >
                Erste Notiz anlegen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((note) => {
              const formattedDate = note.mtime
                ? new Date(note.mtime).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : '';

              return (
                <div
                  key={note.uri}
                  onClick={() => handleOpenNote(note)}
                  className="group flex flex-col justify-between p-4 rounded-lg border border-[var(--vscode-widget-border,rgba(128,128,128,0.2))] bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.04))] hover:border-[var(--vscode-focusBorder,#007acc)] hover:bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.09))] transition-all shadow-sm cursor-pointer"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--vscode-foreground,#cccccc)] group-hover:text-[var(--vscode-textLink-foreground,#3794ff)] transition-colors line-clamp-1">
                        {note.title}
                      </h3>
                      {note.hasChart && (
                        <span
                          className="shrink-0 p-1 rounded bg-purple-900/40 text-purple-300 border border-purple-700/50 text-[10px]"
                          title="Diagramm-Companion vorhanden"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                          </svg>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[var(--vscode-descriptionForeground,#858585)] line-clamp-3 leading-relaxed">
                      {note.snippet || 'Keine Textvorschau vorhanden.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--vscode-widget-border,rgba(128,128,128,0.1))] text-[11px] text-[var(--vscode-descriptionForeground,#858585)]">
                    <span className="font-mono truncate max-w-[60%]">{note.name}</span>
                    <span>{formattedDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

