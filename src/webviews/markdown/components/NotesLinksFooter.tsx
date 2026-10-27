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
  mdiAutoFix,
  mdiLoading,
  mdiInboxArrowDown,
} from '@mdi/js';

export interface FooterLinkItem {
  title: string;
  target: string;
  uri: string;
  relativePath: string;
  exists: boolean;
  viewType?: string;
  lineNumber?: number;
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
  aiModel?: {
    provider: string;
    modelId: string;
    label: string;
  };
}

export interface NotesLinksFooterProps {
  linksData: NoteLinksData | null;
  onOpenLink: (targetUri: string, viewType?: string, lineNumber?: number) => void;
  onAddLink: () => void;
  onCreateCompanion?: (companionType: 'tasks' | 'chart') => void;
  onGenerateAiTasks?: () => void;
  onSortAiInbox?: () => void;
  isGeneratingTasks?: boolean;
  isSortingInbox?: boolean;
}

interface PillTooltipProps {
  category: string;
  description: string;
  actionHint: string;
  children: React.ReactElement;
}

const PillWithTooltip: React.FC<PillTooltipProps> = ({
  category,
  description,
  actionHint,
  children,
}) => (
  <div className="relative group inline-flex">
    {children}
    <div
      role="tooltip"
      className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 z-50 w-64 rounded-md border border-[var(--vscode-editorHoverWidget-border,rgba(128,128,128,0.45))] bg-[var(--vscode-editorHoverWidget-background,#252526)] text-[var(--vscode-editorHoverWidget-foreground,#cccccc)] p-2.5 text-[11px] leading-snug shadow-lg"
    >
      <div className="font-semibold mb-0.5 text-[var(--vscode-editor-foreground,#ffffff)]">
        {category}
      </div>
      <div className="opacity-90">{description}</div>
      <div className="mt-1 pt-1 border-t border-[var(--vscode-editorHoverWidget-border,rgba(128,128,128,0.25))] opacity-75 text-[10px]">
        {actionHint}
      </div>
    </div>
  </div>
);

export const NotesLinksFooter: React.FC<NotesLinksFooterProps> = ({
  linksData,
  onOpenLink,
  onAddLink,
  onCreateCompanion,
  onGenerateAiTasks,
  onSortAiInbox,
  isGeneratingTasks = false,
  isSortingInbox = false,
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
    <footer className="shrink-0 border-t border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.28))] bg-[var(--vscode-editorWidget-background,#252526)] text-[var(--vscode-editor-foreground,#d4d4d4)] px-4 py-2.5 text-xs select-none">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        {/* Top bar: Title summary + Quick actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title="Zeigt alle verknüpften Notizen (Blau ↗ = ausgehender Link, Grün ↙ = eingehender Backlink, Gelb = noch nicht erstellte Notiz) sowie Ordner-Aufgaben und Diagramme"
            className="inline-flex items-center gap-1.5 font-semibold text-[var(--vscode-editor-foreground,#d4d4d4)] opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <MdiIcon path={mdiLinkVariant} size={14} className="text-primary" />
            <span>Verknüpfungen & Companions</span>
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0 text-[11px] font-semibold bg-[var(--vscode-badge-background,#4d4d4d)] text-[var(--vscode-badge-foreground,#ffffff)] border-transparent"
            >
              {totalConnections}
            </Badge>
            <MdiIcon path={isCollapsed ? mdiChevronUp : mdiChevronDown} size={14} />
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            {onGenerateAiTasks && (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isGeneratingTasks}
                onClick={onGenerateAiTasks}
                className="h-6 px-2.5 text-[11px] font-medium"
                title="Aufgaben mit der aktiven KI aus dieser Notiz extrahieren und in die Ordner-Aufgabenliste eintragen"
              >
                <MdiIcon
                  path={isGeneratingTasks ? mdiLoading : mdiAutoFix}
                  size={12}
                  className={isGeneratingTasks ? 'animate-spin' : ''}
                />
                <span>{isGeneratingTasks ? 'Generiere...' : 'Aufgaben generieren'}</span>
              </Button>
            )}

            {onSortAiInbox && (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isSortingInbox}
                onClick={onSortAiInbox}
                className="h-6 px-2.5 text-[11px] font-medium"
                title="Inhalte aus inbox.md mit der aktiven KI thematisch in bestehende oder neue Notizen und Ordner einsortieren"
              >
                <MdiIcon
                  path={isSortingInbox ? mdiLoading : mdiInboxArrowDown}
                  size={12}
                  className={isSortingInbox ? 'animate-spin' : ''}
                />
                <span>{isSortingInbox ? 'Sortiere...' : 'Inbox einsortieren'}</span>
              </Button>
            )}

            {!tasksCompanion?.exists && onCreateCompanion && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCreateCompanion('tasks')}
                className="h-6 px-2 text-[11px] font-medium border-dashed opacity-90 hover:opacity-100"
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
                className="h-6 px-2 text-[11px] font-medium border-dashed opacity-90 hover:opacity-100"
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
              className="h-6 px-2.5 text-[11px] font-medium border-dashed opacity-95 hover:opacity-100 hover:border-[var(--vscode-focusBorder,#007acc)]"
              title="Notiz im Workspace suchen und verknüpfen"
            >
              <MdiIcon path={mdiPlus} size={13} />
              <span>Verknüpfen</span>
            </Button>
          </div>
        </div>

        {/* Collapsible Pills Body */}
        {!isCollapsed && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* Companion Pills (Indigo/Purple accent) */}
            {tasksCompanion?.exists && (
              <PillWithTooltip
                category="Ordner-Aufgabenliste (Companion)"
                description={`Gemeinsame Aufgabenliste (tasks.json) dieses Ordners: ${tasksCompanion.openCount} offen, ${tasksCompanion.completedCount} erledigt (${tasksCompanion.totalCount} gesamt).`}
                actionHint="Klicken, um die Aufgaben dieses Ordners zu öffnen"
              >
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
                  title={`Ordner-Aufgabenliste (${tasksCompanion.openCount} offen, ${tasksCompanion.totalCount} gesamt) – Klicken zum Öffnen`}
                  className="janus-pill-tasks rounded-full px-3 py-1 text-xs font-medium cursor-pointer shadow-xs"
                >
                  <MdiIcon path={mdiFormatListCheckbox} size={13} />
                  <span>{tasksCompanion.label}</span>
                </Badge>
              </PillWithTooltip>
            )}

            {chartCompanion?.exists && (
              <PillWithTooltip
                category="Diagramm-Ansicht (Companion)"
                description="Angehängtes visuelles Diagramm (*.chart.json) zu dieser Notiz."
                actionHint="Klicken, um die Diagramm-Ansicht zu öffnen"
              >
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
                  title="Angehängtes Diagramm (*.chart.json) zu dieser Notiz – Klicken zum Öffnen"
                  className="janus-pill-chart rounded-full px-3 py-1 text-xs font-medium cursor-pointer shadow-xs"
                >
                  <MdiIcon path={mdiChartTimelineVariant} size={13} />
                  <span>{chartCompanion.label}</span>
                </Badge>
              </PillWithTooltip>
            )}

            {/* Outgoing Link Pills (Blue accent, or dashed amber when target doesn't exist yet) */}
            {outgoingLinks.map((link) => (
              <PillWithTooltip
                key={`out-${link.target}`}
                category={
                  link.exists
                    ? 'Ausgehende Verknüpfung (↗)'
                    : 'Ausgehende Verknüpfung – Noch nicht erstellt (↗)'
                }
                description={
                  link.exists
                    ? `Diese Notiz verweist im Text auf „${link.title}“ (${link.relativePath}${link.lineNumber ? `, Zeile ${link.lineNumber}` : ''}).`
                    : `Diese Notiz verweist auf „${link.title}“ (${link.relativePath}), aber die Zieldatei existiert noch nicht.`
                }
                actionHint={
                  link.exists
                    ? link.lineNumber
                      ? `Klicken, um bei Zeile ${link.lineNumber} zu öffnen`
                      : 'Klicken, um die verknüpfte Notiz zu öffnen'
                    : 'Klicken, um die Notiz automatisch anzulegen und zu öffnen'
                }
              >
                <Badge
                  variant="outline"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenLink(link.uri, 'janus.markdownEditor', link.lineNumber)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenLink(link.uri, 'janus.markdownEditor', link.lineNumber);
                    }
                  }}
                  title={
                    link.exists
                      ? `Ausgehende Verknüpfung (↗): Diese Notiz verweist auf "${link.title}" (${link.relativePath}${link.lineNumber ? `:${link.lineNumber}` : ''}) – Klicken zum Öffnen`
                      : `Ausgehende Verknüpfung (↗): Notiz "${link.title}" existiert noch nicht – Klicken zum Erstellen & Öffnen`
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer shadow-xs ${
                    link.exists ? 'janus-pill-link' : 'border-dashed janus-pill-missing'
                  }`}
                >
                  <MdiIcon path={mdiFileDocumentOutline} size={13} />
                  <span>
                    {link.title}
                    {link.lineNumber ? ` :${link.lineNumber}` : ''}
                  </span>
                  <MdiIcon path={mdiArrowTopRight} size={12} className="opacity-90" />
                </Badge>
              </PillWithTooltip>
            ))}

            {/* Backlink Pills (Teal/Emerald accent) */}
            {backlinks.map((backlink) => (
              <PillWithTooltip
                key={`back-${backlink.uri}-${backlink.lineNumber ?? 0}`}
                category="Eingehender Rückverweis / Backlink (↙)"
                description={`Die Notiz „${backlink.title}“ (${backlink.relativePath}${backlink.lineNumber ? `, Zeile ${backlink.lineNumber}` : ''}) enthält einen Verweis auf diese Notiz.`}
                actionHint={
                  backlink.lineNumber
                    ? `Klicken, um bei Zeile ${backlink.lineNumber} zu öffnen`
                    : 'Klicken, um die verweisende Notiz zu öffnen'
                }
              >
                <Badge
                  variant="outline"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenLink(backlink.uri, 'janus.markdownEditor', backlink.lineNumber)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenLink(backlink.uri, 'janus.markdownEditor', backlink.lineNumber);
                    }
                  }}
                  title={`Eingehender Rückverweis / Backlink (↙): Referenz aus "${backlink.title}" (${backlink.relativePath}${backlink.lineNumber ? `:${backlink.lineNumber}` : ''}) – Klicken zum Öffnen`}
                  className="janus-pill-backlink rounded-full px-3 py-1 text-xs font-medium cursor-pointer shadow-xs"
                >
                  <MdiIcon path={mdiArrowBottomLeft} size={13} className="opacity-90" />
                  <span>
                    {backlink.title}
                    {backlink.lineNumber ? ` :${backlink.lineNumber}` : ''}
                  </span>
                </Badge>
              </PillWithTooltip>
            ))}

            {totalConnections === 0 && (
              <span className="text-xs opacity-75 py-0.5">
                Keine Verknüpfungen oder Rückverweise. Nutze [[Notizname]] im Text oder klicke auf „+ Verknüpfen“.
              </span>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};

