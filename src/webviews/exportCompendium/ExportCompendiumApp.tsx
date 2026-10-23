import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { MdiIcon } from '../components/ui/MdiIcon';
import {
  mdiFilePdfBox,
  mdiArrowUp,
  mdiArrowDown,
  mdiDeleteOutline,
  mdiFormatListNumbered,
} from '../../ui/icons';

export interface ExportCompendiumItem {
  uri: string;
  title: string;
  relativePath: string;
}

export interface ExportCompendiumInitData {
  title: string;
  notes: ExportCompendiumItem[];
  includeToc: boolean;
}

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

export const ExportCompendiumApp: React.FC = () => {
  const [title, setTitle] = useState('Janus Note Kompendium');
  const [notes, setNotes] = useState<ExportCompendiumItem[]>([]);
  const [includeToc, setIncludeToc] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const api = getVsCodeApi();
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'init') {
        const data = msg.data as ExportCompendiumInitData;
        if (data) {
          setTitle(data.title || 'Janus Note Kompendium');
          setNotes(data.notes || []);
          setIncludeToc(data.includeToc !== false);
        }
      } else if (msg.type === 'exportStatus') {
        setIsExporting(!!msg.isExporting);
      }
    };

    window.addEventListener('message', handleMessage);
    api?.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setNotes((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= notes.length - 1) return;
    setNotes((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const removeNote = (index: number) => {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    const api = getVsCodeApi();
    if (!api || notes.length === 0) return;
    setIsExporting(true);
    api.postMessage({
      type: 'confirmExport',
      title: title.trim() || 'Janus Note Kompendium',
      notes,
      includeToc,
    });
  };

  const handleCancel = () => {
    const api = getVsCodeApi();
    api?.postMessage({ type: 'cancel' });
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-6 box-border bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] font-sans select-none">
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[var(--vscode-widget-border,#333)]">
        <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
          <MdiIcon path={mdiFilePdfBox} size={28} />
        </div>
        <div>
          <h1 className="text-xl font-semibold m-0 text-[var(--vscode-foreground,#e1e1e1)]">
            Sammel-PDF exportieren
          </h1>
          <p className="text-sm text-[var(--vscode-descriptionForeground,#888)] m-0 mt-0.5">
            Fasse mehrere Notizen in einem druckreifen, zusammenhängenden PDF mit Inhaltsverzeichnis zusammen.
          </p>
        </div>
      </div>

      <div className="space-y-5 flex-1 overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--vscode-foreground,#ccc)]">
            Dokumenttitel / Deckblatt-Überschrift
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Projekt-Dokumentation oder Meeting-Notizen"
            className="w-full bg-[var(--vscode-input-background,#2d2d2d)] border-[var(--vscode-input-border,#444)] text-[var(--vscode-input-foreground,#fff)]"
          />
        </div>

        <div className="p-4 rounded-lg bg-[var(--vscode-sideBar-background,#252526)] border border-[var(--vscode-widget-border,#333)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MdiIcon path={mdiFormatListNumbered} size={20} className="text-blue-400" />
            <div>
              <span className="font-medium text-sm block text-[var(--vscode-foreground,#ddd)]">
                Inhaltsverzeichnis (TOC) auf der ersten Seite einbinden
              </span>
              <span className="text-xs text-[var(--vscode-descriptionForeground,#888)]">
                Erstellt eine nummerierte Übersicht mit klickbaren internen Links zu allen Notizen.
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={includeToc}
            onChange={(e) => setIncludeToc(e.target.checked)}
            className="h-5 w-5 rounded border-gray-400 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--vscode-foreground,#ccc)]">
              Reihenfolge der Notizen ({notes.length})
            </label>
            <span className="text-xs text-[var(--vscode-descriptionForeground,#888)]">
              Verwende die Pfeile zum Verschieben
            </span>
          </div>

          {notes.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-[var(--vscode-widget-border,#444)] rounded-lg text-sm text-[var(--vscode-descriptionForeground,#888)]">
              Keine Notizen in der Auswahl gefunden.
            </div>
          ) : (
            <div className="space-y-1.5">
              {notes.map((note, index) => (
                <div
                  key={note.uri}
                  className="flex items-center justify-between p-2.5 rounded-md bg-[var(--vscode-list-hoverBackground,#2a2d2e)] border border-[var(--vscode-widget-border,#333)] hover:border-[var(--vscode-focusBorder,#007fd4)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--vscode-badge-background,#333)] text-[var(--vscode-badge-foreground,#fff)] text-xs font-semibold shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate text-[var(--vscode-foreground,#e1e1e1)]">
                        {note.title}
                      </div>
                      <div className="text-xs text-[var(--vscode-descriptionForeground,#777)] truncate">
                        {note.relativePath}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === 0 || isExporting}
                      onClick={() => moveUp(index)}
                      title="Nach oben verschieben"
                      className="h-7 w-7 p-0"
                    >
                      <MdiIcon path={mdiArrowUp} size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === notes.length - 1 || isExporting}
                      onClick={() => moveDown(index)}
                      title="Nach unten verschieben"
                      className="h-7 w-7 p-0"
                    >
                      <MdiIcon path={mdiArrowDown} size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isExporting || notes.length <= 1}
                      onClick={() => removeNote(index)}
                      title="Aus Export entfernen"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                    >
                      <MdiIcon path={mdiDeleteOutline} size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 mt-6 border-t border-[var(--vscode-widget-border,#333)] shrink-0">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isExporting}
        >
          Abbrechen
        </Button>
        <Button
          variant="default"
          onClick={handleConfirm}
          disabled={notes.length === 0 || isExporting}
          className="flex items-center gap-2"
        >
          <MdiIcon path={mdiFilePdfBox} size={18} />
          <span>{isExporting ? 'Wird generiert...' : 'Als PDF exportieren...'}</span>
        </Button>
      </div>
    </div>
  );
};

