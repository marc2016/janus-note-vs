import React, { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { MdiIcon } from '../../components/ui/MdiIcon';
import {
  mdiFormatListCheckbox,
  mdiChartTimelineVariant,
  mdiFileDocumentOutline,
  mdiArrowTopRight,
  mdiArrowBottomLeft,
  mdiPlus,
  mdiLinkVariant,
  mdiChevronUp,
  mdiChevronDown,
} from '@mdi/js';

export interface FooterLinkItem {
  title: string;
  target: string;
  uri: string;
  relativePath: string;
  exists: boolean;
  viewType?: string;
}

export interface FooterCompanions {
  tasks?: {
    exists: boolean;
    uri: string;
    openCount: number;
    completedCount: number;
    totalCount: number;
    label: string;
  };
  chart?: {
    exists: boolean;
    uri: string;
    label: string;
  };
}

export interface NoteLinksData {
  noteUri: string;
  companions: FooterCompanions;
  outgoingLinks: FooterLinkItem[];
  backlinks: FooterLinkItem[];
}

export interface NotesLinksFooterProps {
  linksData: NoteLinksData | null;
  onOpenLink: (targetUri: string, viewType?: string) => void;
  onAddLink: () => void;
  onCreateCompanion?: (companionType: 'tasks' | 'chart') => void;
}

export const NotesLinksFooter: React.FC<NotesLinksFooterProps> = ({
  linksData,
  onOpenLink,
  onAddLink,
  onCreateCompanion,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tasksCompanion = linksData?.companions?.tasks;
  const chartCompanion = linksData?.companions?.chart;
  const outgoingLinks = linksData?.outgoingLinks || [];
  const backlinks = linksData?.backlinks || [];

  const totalConnections =
    (tasksCompanion?.exists ? 1 : 0) +
    (chartCompanion?.exists ? 1 : 0) +
    outgoingLinks.length +
    backlinks.length;

  return (
    <footer className="shrink-0 border-t border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.22))] bg-[var(--vscode-editorWidget-background,rgba(24,24,27,0.85))] backdrop-blur-md px-4 py-2 text-xs select-none">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        {/* Top bar: Title summary + Quick actions */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-1.5 font-medium opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <MdiIcon path={mdiLinkVariant} size={14} className="text-primary" />
            <span>Verknüpfungen & Companions</span>
            <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] font-normal">
              {totalConnections}
            </Badge>
            <MdiIcon path={isCollapsed ? mdiChevronUp : mdiChevronDown} size={14} />
          </button>

          <div className="flex items-center gap-1.5">
            {!tasksCompanion?.exists && onCreateCompanion && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCreateCompanion('tasks')}
                className="h-6 px-2 text-[11px] border-dashed opacity-75 hover:opacity-100"
                title="Aufgabenliste (tasks.json) für diesen Ordner öffnen"
              >
                <MdiIcon path={mdiFormatListCheckbox} size={12} />
                <span>Ordner-Aufgaben</span>
              </Button>
            )}

            {!chartCompanion?.exists && onCreateCompanion && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCreateCompanion('chart')}
                className="h-6 px-2 text-[11px] border-dashed opacity-75 hover:opacity-100"
                title="Diagramm-Companion für diese Notiz erstellen"
              >
                <MdiIcon path={mdiChartTimelineVariant} size={12} />
                <span>+ Diagramm</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddLink}
              className="h-6 px-2.5 text-[11px] border-dashed hover:border-[var(--vscode-focusBorder,#007acc)]"
              title="Notiz im Workspace suchen und verknüpfen"
            >
              <MdiIcon path={mdiPlus} size={13} />
              <span>Verknüpfen</span>
            </Button>
          </div>
        </div>

        {/* Collapsible Pills Body */}
        {!isCollapsed && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {/* Companion Pills (Indigo/Purple accent) */}
            {tasksCompanion?.exists && (
              <Badge
                variant="outline"
                role="button"
                tabIndex={0}
                onClick={() => onOpenLink(tasksCompanion.uri, 'janus.tasksEditor')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenLink(tasksCompanion.uri, 'janus.tasksEditor');
                  }
                }}
                title={`Öffne ${tasksCompanion.label}`}
                className="rounded-full px-2.5 py-0.5 font-medium bg-indigo-500/15 text-indigo-300 border-indigo-500/35 hover:bg-indigo-500/25 cursor-pointer"
              >
                <MdiIcon path={mdiFormatListCheckbox} size={13} />
                <span>{tasksCompanion.label}</span>
              </Badge>
            )}

            {chartCompanion?.exists && (
              <Badge
                variant="outline"
                role="button"
                tabIndex={0}
                onClick={() => onOpenLink(chartCompanion.uri, 'janus.chartEditor')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenLink(chartCompanion.uri, 'janus.chartEditor');
                  }
                }}
                title="Öffne Diagramm-Companion"
                className="rounded-full px-2.5 py-0.5 font-medium bg-purple-500/15 text-purple-300 border-purple-500/35 hover:bg-purple-500/25 cursor-pointer"
              >
                <MdiIcon path={mdiChartTimelineVariant} size={13} />
                <span>{chartCompanion.label}</span>
              </Badge>
            )}

            {/* Outgoing Link Pills (Blue accent, or dashed amber when target doesn't exist yet) */}
            {outgoingLinks.map((link) => (
              <Badge
                key={`out-${link.target}`}
                variant="outline"
                role="button"
                tabIndex={0}
                onClick={() => onOpenLink(link.uri, 'janus.markdownEditor')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenLink(link.uri, 'janus.markdownEditor');
                  }
                }}
                title={
                  link.exists
                    ? `Verknüpfte Notiz öffnen: ${link.relativePath}`
                    : `Notiz "${link.title}" existiert noch nicht – Klicken zum Erstellen & Öffnen`
                }
                className={`rounded-full px-2.5 py-0.5 font-normal cursor-pointer ${
                  link.exists
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/35 hover:bg-sky-500/25'
                    : 'border-dashed bg-amber-500/10 text-amber-300 border-amber-500/35 hover:bg-amber-500/20'
                }`}
              >
                <MdiIcon path={mdiFileDocumentOutline} size={12} />
                <span>{link.title}</span>
                <MdiIcon path={mdiArrowTopRight} size={11} className="opacity-70" />
              </Badge>
            ))}

            {/* Backlink Pills (Teal/Emerald accent) */}
            {backlinks.map((backlink) => (
              <Badge
                key={`back-${backlink.uri}`}
                variant="outline"
                role="button"
                tabIndex={0}
                onClick={() => onOpenLink(backlink.uri, 'janus.markdownEditor')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenLink(backlink.uri, 'janus.markdownEditor');
                  }
                }}
                title={`Referenziert von: ${backlink.relativePath}`}
                className="rounded-full px-2.5 py-0.5 font-normal bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25 cursor-pointer"
              >
                <MdiIcon path={mdiArrowBottomLeft} size={12} className="opacity-80" />
                <span>{backlink.title}</span>
              </Badge>
            ))}

            {totalConnections === 0 && (
              <span className="text-[11px] opacity-50 py-0.5">
                Keine Verknüpfungen oder Rückverweise. Nutze [[Notizname]] im Text oder klicke auf „+ Verknüpfen“.
              </span>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};

