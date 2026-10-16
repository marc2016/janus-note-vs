import React, { useState, useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';

import { livePreview } from './extensions/livePreview';
import { taskCheckboxes } from './extensions/taskCheckboxes';
import { slashCommands } from './extensions/slashCommands';
import {
  MarkdownToolbar,
  ActiveToolbarState,
  defaultActiveToolbarState,
} from './components/MarkdownToolbar';

import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MdiIcon } from '../components/ui/MdiIcon';
import {
  mdiCodeTags,
  mdiThemeLightDark,
} from '../../ui/icons';

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

function getInitialContent(): string {
  try {
    const el = document.getElementById('initial-data');
    if (el && el.textContent) {
      const parsed = JSON.parse(el.textContent);
      return typeof parsed === 'string' ? parsed : parsed.content || '';
    }
  } catch {}
  return '# Welcome to Janus Note\n\nStart typing your markdown note here...';
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

type ThemeMode = 'auto' | 'light' | 'dark';

const themeCompartment = new Compartment();

function getEditorTheme(isDark: boolean) {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        color: isDark ? '#e4e4e7' : '#18181b',
        backgroundColor: isDark ? 'rgba(9, 9, 11, 0.7)' : '#ffffff',
        fontSize: '15px',
        lineHeight: '1.7',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      },
      '.cm-scroller': {
        height: '100%',
        overflow: 'auto',
        fontFamily: 'inherit',
      },
      '.cm-content': {
        caretColor: isDark ? '#60a5fa' : '#2563eb',
        maxWidth: '48rem',
        margin: '0 auto',
        padding: '32px 24px 80px',
        minHeight: '100%',
        userSelect: 'text',
        boxSizing: 'border-box',
      },
      '.cm-line': {
        padding: '0 4px',
        userSelect: 'text',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: isDark ? '#60a5fa' : '#2563eb',
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.25)',
      },
      '.cm-activeLine': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
      },
    },
    { dark: isDark }
  );
}

function computeActiveToolbarState(state: EditorState): ActiveToolbarState {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const text = line.text;

  // 1. Heading
  const headingMatch = text.match(/^(#{1,6})\s/);
  const heading = headingMatch ? headingMatch[1].length : 0;

  // 2. Lists & Blockquotes
  const taskList = /^\s*[-*+]\s+\[[ xX]\]/.test(text);
  const bulletList = !taskList && /^\s*[-*+]\s+/.test(text);
  const numberedList = /^\s*\d+\.\s+/.test(text);
  const blockquote = /^\s*>\s*/.test(text);

  // 3. Inline Marks via syntaxTree
  const tree = syntaxTree(state);
  let bold = false;
  let italic = false;
  let code = false;
  let strike = false;

  const checkPos = (pos: number, side: -1 | 1) => {
    for (let cur: any = tree.resolveInner(pos, side); cur; cur = cur.parent) {
      if (cur.name === 'StrongEmphasis') bold = true;
      if (cur.name === 'Emphasis') italic = true;
      if (cur.name === 'InlineCode' || cur.name === 'FencedCode') code = true;
      if (cur.name === 'Strikethrough') strike = true;
    }
  };

  checkPos(head, 1);
  if ((!bold || !italic || !code || !strike) && head > line.from) {
    checkPos(head, -1);
  }

  return {
    heading,
    bold,
    italic,
    strike,
    code,
    bulletList,
    numberedList,
    taskList,
    blockquote,
  };
}

export const MarkdownEditorApp: React.FC = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [isSystemDark, setIsSystemDark] = useState<boolean>(detectIsDark);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [activeState, setActiveState] = useState<ActiveToolbarState>(defaultActiveToolbarState);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isUpdatingFromHostRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<any>(null);

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

  // Update CodeMirror theme when effectiveIsDark changes
  useEffect(() => {
    if (editorView) {
      editorView.dispatch({
        effects: themeCompartment.reconfigure(getEditorTheme(effectiveIsDark)),
      });
    }
  }, [effectiveIsDark, editorView]);

  // Initialize CodeMirror 6 Editor
  useEffect(() => {
    if (!containerRef.current) return;

    const initialText = getInitialContent();

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        livePreview(),
        taskCheckboxes(),
        slashCommands(),
        EditorView.lineWrapping,
        themeCompartment.of(getEditorTheme(effectiveIsDark)),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet || update.docChanged) {
            setActiveState(computeActiveToolbarState(update.state));
          }

          if (update.docChanged && !isUpdatingFromHostRef.current) {
            const text = update.state.doc.toString();
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              const api = getVsCodeApi();
              if (api) {
                api.postMessage({
                  type: 'updateContent',
                  content: text,
                });
              }
            }, 250);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    setEditorView(view);

    return () => {
      view.destroy();
      setEditorView(null);
    };
  }, []);

  // Listen for updates from VS Code extension host
  useEffect(() => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'ready' });
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'init' || message.type === 'update') {
        const newContent = typeof message.content === 'string' ? message.content : '';
        if (editorView) {
          const currentDoc = editorView.state.doc.toString();
          if (currentDoc !== newContent) {
            isUpdatingFromHostRef.current = true;
            editorView.dispatch({
              changes: { from: 0, to: editorView.state.doc.length, insert: newContent },
            });
            isUpdatingFromHostRef.current = false;
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [editorView]);

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
    <div className="flex flex-col h-screen overflow-hidden box-border bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] font-sans">
      {/* Top Application Header */}
      <header className="flex items-center justify-between px-6 py-2.5 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-card/60 backdrop-blur-sm select-none shrink-0">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[11px] tracking-wide">
            Live Preview
          </Badge>
          <span className="text-xs text-muted-foreground">Obsidian-Style Raw Sync</span>
        </div>

        <div className="flex items-center gap-2">
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenSource}
            title="Quelltext in zweiter Spalte öffnen"
          >
            <MdiIcon path={mdiCodeTags} size={15} />
            <span>Quelltext bearbeiten</span>
          </Button>
        </div>
      </header>

      {/* Formatting Toolbar with Active States */}
      <div className="shrink-0">
        <MarkdownToolbar editorView={editorView} activeState={activeState} />
      </div>

      {/* CodeMirror Host Container (Single Scroll Root) */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden outline-none w-full"
      />
    </div>
  );
};
