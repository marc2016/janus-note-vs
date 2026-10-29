import React, { useState, useEffect, useRef, useMemo } from 'react';
import { marked } from 'marked';
import { MdiIcon } from '../components/ui/MdiIcon';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import {
  mdiSend,
  mdiCreation,
  mdiMagnify,
  mdiFormatListCheckbox,
  mdiFileDocumentEditOutline,
  mdiInbox,
  mdiHelpCircleOutline,
  mdiDeleteOutline,
  mdiFileDocumentOutline,
  mdiCogOutline,
} from '../../ui/icons';
import { mdiClose, mdiSitemapOutline } from '@mdi/js';

declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
function getVsCodeApi() {
  if (!vscodeApi && typeof acquireVsCodeApi === 'function') {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export interface ChatSourceNote {
  title: string;
  relativePath: string;
  uri: string;
  snippet: string;
}

export interface ChatAction {
  label: string;
  actionType:
    | 'openNote'
    | 'openAllTasks'
    | 'openFolderTasks'
    | 'generateTasksFromNote'
    | 'sortInbox'
    | 'openSettings'
    | 'applyDiagram'
    | 'copyDiagramCode';
  uri?: string;
  proposalId?: string;
}

export interface DiagramContextInfo {
  label: string;
  line: number;
}

/** Shows which diagram the chat is changing, with a button to remove that context. */
export const DiagramContextChip: React.FC<{ context: DiagramContextInfo; onRemove: () => void }> = ({
  context,
  onRemove,
}) => (
  <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1 rounded-md border border-[var(--vscode-focusBorder,#007acc)] bg-[var(--vscode-editorWidget-background,rgba(127,127,127,0.12))] text-[11px]">
    <MdiIcon path={mdiSitemapOutline} size={13} className="shrink-0 text-[var(--vscode-focusBorder,#007acc)]" />
    <span className="truncate flex-1" title="Nachrichten ändern dieses Diagramm">
      {context.label}
    </span>
    <button
      type="button"
      onClick={onRemove}
      title="Diagramm-Kontext entfernen"
      aria-label="Diagramm-Kontext entfernen"
      className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer"
    >
      <MdiIcon path={mdiClose} size={13} />
    </button>
  </div>
);

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  sources?: ChatSourceNote[];
  actions?: ChatAction[];
}

export interface AiModelInfo {
  provider: string;
  modelId: string;
  label: string;
}

const QUICK_COMMANDS = [
  { label: '/search', name: 'Suche', icon: mdiMagnify, fillPrompt: '/search ' },
  { label: '/tasks', name: 'Aufgaben', icon: mdiFormatListCheckbox, autoSend: true },
  { label: '/summarize', name: 'Zusammenfassung', icon: mdiFileDocumentEditOutline, fillPrompt: '/summarize ' },
  { label: '/inbox', name: 'Inbox', icon: mdiInbox, autoSend: true },
  { label: '/help', name: 'Hilfe', icon: mdiHelpCircleOutline, autoSend: true },
];

export const JanusChatApp: React.FC = () => {
  const [model, setModel] = useState<AiModelInfo>({
    provider: 'vscode-lm',
    modelId: 'default',
    label: 'VS Code',
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [diagramContext, setDiagramContext] = useState<DiagramContextInfo | null>(null);

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      switch (msg.type) {
        case 'init':
          if (msg.model) setModel(msg.model);
          if (Array.isArray(msg.history)) setMessages(msg.history);
          break;
        case 'updateModel':
          if (msg.model) setModel(msg.model);
          break;
        case 'addMessage':
          if (msg.message) {
            setMessages((prev) => [...prev, msg.message]);
          }
          break;
        case 'setLoading':
          setIsLoading(!!msg.loading);
          break;
        case 'clearHistory':
          setMessages([]);
          break;
        case 'diagramContext':
          setDiagramContext(msg.context ?? null);
          if (msg.context) inputRef.current?.focus();
          break;
      }
    };

    window.addEventListener('message', handleWindowMessage);
    getVsCodeApi()?.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    getVsCodeApi()?.postMessage({
      type: 'ask',
      text,
    });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickCommandClick = (cmd: typeof QUICK_COMMANDS[0]) => {
    if (cmd.autoSend) {
      handleSend(cmd.label);
    } else {
      setInput(cmd.fillPrompt || cmd.label);
      inputRef.current?.focus();
    }
  };

  const handleOpenSettings = () => {
    getVsCodeApi()?.postMessage({ type: 'openSettings' });
  };

  const handleClearChat = () => {
    getVsCodeApi()?.postMessage({ type: 'clearHistory' });
    setMessages([]);
  };

  const handleActionClick = (action: ChatAction) => {
    getVsCodeApi()?.postMessage({
      type: action.actionType,
      uri: action.uri,
      proposalId: action.proposalId,
    });
  };

  const handleOpenSource = (source: ChatSourceNote) => {
    getVsCodeApi()?.postMessage({
      type: 'openNote',
      uri: source.uri,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-sideBar-background,#252526)] text-[var(--vscode-sideBar-foreground,#cccccc)] text-xs select-none">
      {/* Top Header: Model Badge & Clear Button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-sideBar-border,rgba(128,128,128,0.25))] shrink-0 bg-[var(--vscode-sideBar-background,#252526)]">
        <button
          onClick={handleOpenSettings}
          title="Klicken, um KI-Modell in Janus-Einstellungen anzupassen"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--vscode-badge-background,#333333)] text-[var(--vscode-badge-foreground,#ffffff)] border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.35))] hover:bg-[var(--vscode-toolbar-hoverBackground,#3e3e42)] transition-colors cursor-pointer text-left max-w-[210px] truncate shadow-sm"
        >
          <MdiIcon path={mdiCreation} size={14} className="text-[var(--vscode-editorLightBulb-foreground,#cca700)] shrink-0" />
          <span className="font-semibold truncate text-[11px]">{model.label || 'KI Modell'}</span>
          <MdiIcon path={mdiCogOutline} size={12} className="opacity-80 ml-0.5 shrink-0" />
        </button>

        <button
          onClick={handleClearChat}
          title="Chat-Verlauf leeren"
          className="p-1.5 rounded text-[var(--vscode-icon-foreground,#c5c5c5)] hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.1))] hover:text-red-400 transition-colors cursor-pointer border border-transparent hover:border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.2))]"
        >
          <MdiIcon path={mdiDeleteOutline} size={16} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full py-8 text-[var(--vscode-descriptionForeground,#858585)] space-y-3">
            <div className="w-10 h-10 rounded-full bg-[var(--vscode-editorWidget-background,rgba(255,255,255,0.05))] flex items-center justify-center">
              <MdiIcon path={mdiCreation} size={22} className="text-[var(--vscode-button-background,#007acc)]" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[var(--vscode-sideBar-foreground,#cccccc)] text-sm">Janus KI & Suche</p>
              <p className="text-[11px] max-w-[220px]">
                Stelle Fragen zu deinen Notizen, durchsuche den Workspace oder verwalte Aufgaben.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              onOpenSource={handleOpenSource}
              onActionClick={handleActionClick}
            />
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-[var(--vscode-descriptionForeground,#858585)] px-2 py-1.5 rounded-lg bg-[var(--vscode-editorWidget-background,rgba(255,255,255,0.04))] border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.2))] w-fit animate-pulse">
            <MdiIcon path={mdiCreation} size={14} className="text-[var(--vscode-button-background,#007acc)] animate-spin" />
            <span className="text-[11px]">Janus denkt nach...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Command Chips */}
      <div className="px-2.5 py-1.5 border-t border-[var(--vscode-sideBar-border,rgba(128,128,128,0.2))] bg-[var(--vscode-sideBar-background,#252526)] shrink-0 flex flex-wrap items-center gap-1.5">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            onClick={() => handleQuickCommandClick(cmd)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--vscode-button-secondaryBackground,#333538)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] text-[var(--vscode-button-secondaryForeground,#ffffff)] border border-[var(--vscode-button-border,rgba(128,128,128,0.3))] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors shadow-sm disabled:opacity-40"
          >
            <MdiIcon path={cmd.icon} size={12} className="opacity-90" />
            <span>{cmd.name}</span>
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-2 border-t border-[var(--vscode-sideBar-border,rgba(128,128,128,0.2))] bg-[var(--vscode-sideBar-background,#252526)] shrink-0">
        {diagramContext && (
          <DiagramContextChip
            context={diagramContext}
            onRemove={() => getVsCodeApi()?.postMessage({ type: 'clearDiagramContext' })}
          />
        )}
        <div className="relative flex items-center rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.35))] bg-[var(--vscode-input-background,#3c3c3c)] focus-within:border-[var(--vscode-focusBorder,#007acc)] transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={diagramContext ? "Beschreibe die Änderung am Diagramm..." : "Frage stellen oder /befehl eingeben..."}
            disabled={isLoading}
            className="w-full resize-none bg-transparent px-2.5 py-1.5 text-xs text-[var(--vscode-input-foreground,#cccccc)] placeholder-[var(--vscode-input-placeholderForeground,#858585)] outline-none min-h-[30px] max-h-[100px]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            title="Nachricht senden (Enter)"
            className="p-1.5 mr-1 rounded text-[var(--vscode-button-foreground,#ffffff)] bg-[var(--vscode-button-background,#007acc)] hover:bg-[var(--vscode-button-hoverBackground,#0062a3)] disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition-colors shrink-0 shadow-sm"
          >
            <MdiIcon path={mdiSend} size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

interface MessageItemProps {
  message: ChatMessage;
  onOpenSource: (source: ChatSourceNote) => void;
  onActionClick: (action: ChatAction) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onOpenSource, onActionClick }) => {
  const isUser = message.sender === 'user';

  const htmlContent = useMemo(() => {
    if (isUser) return '';
    try {
      return marked.parse(message.text, { async: false, gfm: true, breaks: true }) as string;
    } catch {
      return message.text;
    }
  }, [message.text, isUser]);

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5 w-full`}>
      {/* Bubble */}
      <div
        className={`px-3 py-2 rounded-lg text-xs leading-relaxed max-w-[95%] break-words select-text ${
          isUser
            ? 'bg-[var(--vscode-button-background,#007acc)] text-[var(--vscode-button-foreground,#ffffff)] rounded-br-none'
            : 'bg-[var(--vscode-editorWidget-background,rgba(255,255,255,0.06))] text-[var(--vscode-editor-foreground,#d4d4d4)] border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.2))] rounded-bl-none prose prose-invert max-w-none'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.text}</div>
        ) : (
          <div
            className="chat-markdown overflow-x-auto text-[11.5px]"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>

      {/* Source Cards (if any) */}
      {!isUser && message.sources && message.sources.length > 0 && (
        <div className="w-full space-y-1.5 pt-1">
          <p className="text-[10px] uppercase font-bold text-[var(--vscode-sideBarTitle-foreground,#bbbbbb)] tracking-wider px-1">
            Gefundene Notizen ({message.sources.length})
          </p>
          <div className="space-y-1.5">
            {message.sources.map((source, idx) => (
              <button
                key={idx}
                onClick={() => onOpenSource(source)}
                className="w-full text-left p-2 rounded-md border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.3))] bg-[var(--vscode-editorWidget-background,#202022)] hover:border-[var(--vscode-focusBorder,#007acc)] hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.08))] transition-colors cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-1.5 font-semibold text-[11.5px] text-[var(--vscode-textLink-foreground,#3794ff)] group-hover:underline">
                  <MdiIcon path={mdiFileDocumentOutline} size={14} className="shrink-0 opacity-90" />
                  <span className="truncate">{source.title}</span>
                </div>
                <div className="text-[10px] text-[var(--vscode-descriptionForeground,#999999)] truncate mt-0.5">
                  {source.relativePath}
                </div>
                {source.snippet && (
                  <p className="text-[10.5px] opacity-85 line-clamp-2 mt-1 italic text-[var(--vscode-editor-foreground,#d4d4d4)] bg-[var(--vscode-editor-background,rgba(0,0,0,0.15))] p-1 rounded">
                    "{source.snippet}"
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons (if any) */}
      {!isUser && message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5">
          {message.actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onActionClick(action)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--vscode-button-secondaryBackground,#3a3d41)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] text-[var(--vscode-button-secondaryForeground,#ffffff)] border border-[var(--vscode-button-border,rgba(128,128,128,0.35))] text-[11px] font-semibold shadow-sm cursor-pointer transition-colors"
            >
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

