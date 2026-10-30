import React, { useState, useEffect, useRef } from 'react';
import { EditorState, Compartment, Transaction } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { Table } from '@lezer/markdown';
import { syntaxTree } from '@codemirror/language';

import {
  livePreview,
  SyntaxVisibilityMode,
  syntaxVisibilityCompartment,
  syntaxVisibilityFacet,
} from './extensions/livePreview';
import { taskCheckboxes } from './extensions/taskCheckboxes';
import { slashCommands } from './extensions/slashCommands';
import {
  createLinkAutocompleteSource,
} from './extensions/linkAutocomplete';
import { TagCandidate, createTagAutocompleteSource } from './extensions/tagAutocomplete';
import { LinkCandidate } from '../../companion/noteLinking';
import { styledLists } from './extensions/styledLists';
import { styledTables } from './extensions/styledTables';
import { clickableLinks } from './extensions/clickableLinks';
import { setSortedLinks, sortedLinks, sortedLinksCompartment, sortedLinksField } from './extensions/sortedLinks';
import { imagePaste, insertSavedImage, rejectPendingImage } from './extensions/imagePaste';
import { inlineImages, setImageContext } from './extensions/inlineImages';
import { insertAfterAnchor, selectionActions } from './extensions/selectionActions';
import { applyMermaidReplacement, createMermaidRenderer, mermaidDiagrams, setMermaidTheme } from './extensions/mermaidBlocks';
import { lineHighlightExtension, setHighlightLine } from './extensions/lineHighlight';
import {
  MarkdownToolbar,
  ActiveToolbarState,
  defaultActiveToolbarState,
} from './components/MarkdownToolbar';
import { DatePickerPopover } from './components/DatePickerPopover';
import {
  NotesLinksFooter,
  NoteLinksData,
} from './components/NotesLinksFooter';
import { markdownEditorKeymap } from './lib/editorKeymap';
import { singleUndoHistory } from './lib/undoRedo';
import { saveShortcut } from './lib/saveShortcut';
import { DocumentSync } from './lib/documentSync';

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

function getMermaidScriptUri(): string {
  try {
    const el = document.getElementById('initial-data');
    const parsed = el?.textContent ? JSON.parse(el.textContent) : undefined;
    return typeof parsed?.mermaidScriptUri === 'string' ? parsed.mermaidScriptUri : '';
  } catch {
    return '';
  }
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
      // Draw the (translucent) selection above the text: code spans have their own background,
      // which would otherwise hide a selection drawn behind them
      '& > .cm-scroller > .cm-selectionLayer': {
        zIndex: '1 !important',
        pointerEvents: 'none',
      },
      // CodeMirror's base theme paints an opaque selection color with a more specific selector;
      // above the text it must stay translucent
      '& > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
        backgroundColor: `${isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.22)'} !important`,
      },
      '.cm-activeLine': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
      },
      '.cm-target-line-highlight': {
        backgroundColor: isDark
          ? 'rgba(234, 179, 8, 0.28) !important'
          : 'rgba(234, 179, 8, 0.22) !important',
        borderLeft: isDark
          ? '4px solid #facc15 !important'
          : '4px solid #ca8a04 !important',
        boxShadow: isDark
          ? 'inset 0 0 0 1px rgba(234, 179, 8, 0.4)'
          : 'inset 0 0 0 1px rgba(234, 179, 8, 0.3)',
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

function getInitialSyntaxMode(): SyntaxVisibilityMode {
  try {
    const api = getVsCodeApi();
    const state = api?.getState?.() as any;
    if (state?.syntaxVisibilityMode && ['auto', 'visible', 'hidden'].includes(state.syntaxVisibilityMode)) {
      return state.syntaxVisibilityMode;
    }
  } catch {}
  return 'auto';
}

export const MarkdownEditorApp: React.FC = () => {
  const [isSystemDark, setIsSystemDark] = useState<boolean>(detectIsDark);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [activeState, setActiveState] = useState<ActiveToolbarState>(defaultActiveToolbarState);
  const [syntaxMode, setSyntaxMode] = useState<SyntaxVisibilityMode>(getInitialSyntaxMode);
  const [linksData, setLinksData] = useState<NoteLinksData | null>(null);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState<boolean>(false);
  const [isSortingInbox, setIsSortingInbox] = useState<boolean>(false);
  const [sortSource, setSortSource] = useState<'inbox' | 'daily' | null>(null);
  const [datePickerState, setDatePickerState] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    insertPos: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const imageContextRef = useRef<string>('');
  const [mermaidRenderer] = useState(() => createMermaidRenderer(getMermaidScriptUri()));
  const pendingRevealLineRef = useRef<number | null>(null);
  const syncRef = useRef<DocumentSync>(new DocumentSync());
  const hasInitializedRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<any>(null);
  // Unsaved state: the document's dirty flag from the host, plus edits not sent yet
  const [hostDirty, setHostDirty] = useState(false);
  const [hasPendingEdits, setHasPendingEdits] = useState(false);

  // Sends unsent local edits to the host right away (cancels a pending debounce).
  const flushPendingEdits = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const view = editorViewRef.current;
    const sync = syncRef.current;
    if (!view || !sync.hasPending) return;
    const { content, seq } = sync.takeOutgoing(view.state.doc.toString());
    getVsCodeApi()?.postMessage({ type: 'updateContent', content, seq });
    setHasPendingEdits(false);
  };

  // Sends pending edits first; the host saves only after applying them (ordered messages).
  const requestSave = () => {
    flushPendingEdits();
    getVsCodeApi()?.postMessage({ type: 'save' });
  };
  const requestSaveRef = useRef(requestSave);
  requestSaveRef.current = requestSave;
  const flushPendingEditsRef = useRef(flushPendingEdits);
  flushPendingEditsRef.current = flushPendingEdits;
  const linkCandidatesRef = useRef<LinkCandidate[]>([]);
  const tagCandidatesRef = useRef<TagCandidate[]>([]);
  const handleOpenLinkRef = useRef<
    (target: string, viewType?: string, lineNumber?: number, linkType?: string) => void
  >(() => {});
  const datePickerHandlerRef = useRef<
    (pos: number, coords: { top: number; left: number } | null) => void
  >(() => {});

  const doRevealLine = (targetLineNum: number, view: EditorView) => {
    const totalLines = view.state.doc.lines;
    const targetLine = Math.min(Math.max(1, targetLineNum), totalLines);
    const line = view.state.doc.line(targetLine);
    view.dispatch({
      selection: { anchor: line.from },
      effects: [
        EditorView.scrollIntoView(line.from, { y: 'center' }),
        setHighlightLine.of(targetLine),
      ],
    });
    view.focus();
  };

  datePickerHandlerRef.current = (pos: number, coords: { top: number; left: number } | null) => {
    setDatePickerState({
      isOpen: true,
      position: coords ? { top: coords.top, left: coords.left } : { top: 80, left: 100 },
      insertPos: pos,
    });
  };

  const effectiveIsDark = isSystemDark;

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
        effects: [themeCompartment.reconfigure(getEditorTheme(effectiveIsDark)), setMermaidTheme.of(effectiveIsDark)],
      });
    }
  }, [effectiveIsDark, editorView]);

  // Render `-> [[target]]` lines as cards only in daily notes
  useEffect(() => {
    if (editorView) {
      editorView.dispatch({
        effects: sortedLinksCompartment.reconfigure(
          sortSource === 'daily'
            ? sortedLinks({
                onOpen: (target, line) => handleOpenLinkRef.current(target, undefined, line, 'wiki'),
              })
            : []
        ),
      });
    }
  }, [sortSource, editorView]);

  // Update CodeMirror syntax visibility when syntaxMode changes
  useEffect(() => {
    if (editorView) {
      editorView.dispatch({
        effects: syntaxVisibilityCompartment.reconfigure(syntaxVisibilityFacet.of(syntaxMode)),
      });
    }
  }, [syntaxMode, editorView]);

  // Initialize CodeMirror 6 Editor
  useEffect(() => {
    if (!containerRef.current) return;

    const initialText = getInitialContent();
    syncRef.current.reset(initialText);

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        singleUndoHistory(),
        saveShortcut(() => requestSaveRef.current()),
        keymap.of(markdownEditorKeymap),
        markdown({ extensions: [Table] }),
        livePreview(syntaxMode),
        clickableLinks({
          onOpenLink: (target, linkType) => handleOpenLinkRef.current(target, undefined, undefined, linkType),
        }),
        styledLists(),
        taskCheckboxes(),
        styledTables(),
        sortedLinksField,
        sortedLinksCompartment.of([]),
        imagePaste({ postMessage: (message) => getVsCodeApi()?.postMessage(message) }),
        inlineImages(),
        selectionActions({
          onSummarize: (selection) => getVsCodeApi()?.postMessage({ type: 'summarizeSelection', ...selection }),
          onDiagram: ({ blockFrom, text }) =>
            getVsCodeApi()?.postMessage({ type: 'diagramFromSelection', blockFrom, text }),
        }),
        mermaidDiagrams(mermaidRenderer, {
          onAiEdit: (blockFrom) => getVsCodeApi()?.postMessage({ type: 'editDiagramWithAi', blockFrom }),
        }),
        lineHighlightExtension(),
        slashCommands({
          onOpenDatePicker: (pos, coords) => datePickerHandlerRef.current(pos, coords),
          onAiDiagram: (blockFrom) => getVsCodeApi()?.postMessage({ type: 'editDiagramWithAi', blockFrom }),
          linkCompletionSource: createLinkAutocompleteSource(() => linkCandidatesRef.current),
          tagCompletionSource: createTagAutocompleteSource(() => tagCandidatesRef.current),
        }),
        EditorView.lineWrapping,
        // Save pending edits as soon as focus leaves the editor
        EditorView.domEventHandlers({
          blur: () => {
            flushPendingEditsRef.current();
            return false;
          },
        }),
        themeCompartment.of(getEditorTheme(effectiveIsDark)),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet || update.docChanged) {
            setActiveState(computeActiveToolbarState(update.state));
          }

          // Only user edits are sent back; remote (host) changes are already in the document.
          if (syncRef.current.recordLocalTransactions(update.transactions)) {
            setHasPendingEdits(true);
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => flushPendingEditsRef.current(), 250);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorViewRef.current = view;
    setEditorView(view);

    if (pendingRevealLineRef.current !== null) {
      const pendingLine = pendingRevealLineRef.current;
      pendingRevealLineRef.current = null;
      setTimeout(() => {
        doRevealLine(pendingLine, view);
      }, 50);
    }

    return () => {
      view.destroy();
      editorViewRef.current = null;
      setEditorView(null);
    };
  }, []);

  // Save pending edits when the webview is hidden (e.g. switching editor tabs) or unloaded
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) flushPendingEditsRef.current();
    };
    const handlePageHide = () => flushPendingEditsRef.current();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      flushPendingEditsRef.current();
    };
  }, []);

  // Listen for updates from VS Code extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'init' || message.type === 'update') {
        const newContent = typeof message.content === 'string' ? message.content : '';
        const view = editorViewRef.current;
        if (view && typeof message.imageBaseUri === 'string') {
          const context = { imageBaseUri: message.imageBaseUri, workspaceRoots: message.workspaceRoots ?? [] };
          if (JSON.stringify(context) !== imageContextRef.current) {
            imageContextRef.current = JSON.stringify(context);
            view.dispatch({ effects: setImageContext.of(context) });
          }
        }
        if (view) {
          const sync = syncRef.current;
          const remoteAnnotations = [Transaction.remote.of(true), Transaction.addToHistory.of(false)];
          if (message.type === 'init' && !hasInitializedRef.current) {
            // First load: adopt the host document wholesale.
            hasInitializedRef.current = true;
            sync.reset(newContent);
            if (view.state.doc.toString() !== newContent) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: newContent },
                annotations: remoteAnnotations,
              });
            }
          } else {
            // External change: apply minimally (keeps the cursor), ignore stale states,
            // and rebase onto local edits that were not sent yet.
            const changes = sync.applyRemote(newContent, message.ackSeq);
            if (changes) {
              view.dispatch({ changes, annotations: remoteAnnotations });
            }
          }
        }
      } else if (message.type === 'updateLinks' && message.linksData) {
        setLinksData(message.linksData);
      } else if (message.type === 'updateLinkCandidates' && Array.isArray(message.candidates)) {
        linkCandidatesRef.current = message.candidates;
      } else if (message.type === 'updateTagCandidates' && Array.isArray(message.tags)) {
        tagCandidatesRef.current = message.tags;
      } else if (message.type === 'aiTasksGenerating') {
        setIsGeneratingTasks(Boolean(message.isGenerating));
      } else if (message.type === 'aiInboxSorting') {
        setIsSortingInbox(Boolean(message.isSorting));
      } else if (message.type === 'sortSource') {
        setSortSource(message.source === 'inbox' || message.source === 'daily' ? message.source : null);
      } else if (message.type === 'dirtyState') {
        setHostDirty(Boolean(message.dirty));
      } else if (message.type === 'insertAfterText' && typeof message.insert === 'string') {
        const view = editorViewRef.current;
        getVsCodeApi()?.postMessage({
          type: 'textInserted',
          requestId: message.requestId,
          result: view ? insertAfterAnchor(view, message) : 'missing',
        });
      } else if (message.type === 'replaceMermaidCode' && typeof message.newCode === 'string') {
        const view = editorViewRef.current;
        const reply = (result: string) =>
          getVsCodeApi()?.postMessage({ type: 'mermaidCodeReplaced', requestId: message.requestId, result });
        if (!view) {
          reply('missing');
        } else {
          void applyMermaidReplacement(view, message, mermaidRenderer).then(reply, () => reply('missing'));
        }
      } else if (message.type === 'imageSaved' && typeof message.relPath === 'string') {
        if (editorViewRef.current) insertSavedImage(editorViewRef.current, message.requestId, message.relPath);
      } else if (message.type === 'imageRejected') {
        if (editorViewRef.current) rejectPendingImage(editorViewRef.current, message.requestId);
      } else if (message.type === 'sortedLinks' && Array.isArray(message.links)) {
        editorViewRef.current?.dispatch({ effects: setSortedLinks.of(message.links) });
      } else if (message.type === 'revealLine') {
        const rawLine = typeof message.line === 'number' ? message.line : parseInt(message.line, 10);
        if (!isNaN(rawLine) && rawLine > 0) {
          const view = editorViewRef.current;
          if (!view) {
            pendingRevealLineRef.current = rawLine;
            return;
          }
          doRevealLine(rawLine, view);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Post ready when editorView is mounted and ready
  useEffect(() => {
    if (!editorView) return;
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'ready' });
    }
  }, [editorView]);

  // Direct click handler for inline links in Live Preview (capture phase fallback)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContainerClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.altKey) return;

      const linkEl = (e.target as HTMLElement)?.closest?.('.cm-link-text') as HTMLElement | null;
      if (!linkEl) return;

      const target = linkEl.getAttribute('data-link-target');
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      handleOpenLink(target, undefined, undefined, linkEl.getAttribute('data-link-type') ?? undefined);
    };

    container.addEventListener('click', handleContainerClick, { capture: true });
    return () => container.removeEventListener('click', handleContainerClick, { capture: true });
  }, []);

  const handleOpenSource = () => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'openSource' });
    }
  };

  const handleExportPdf = () => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'exportPdf' });
    }
  };

  const handleOpenLink = (targetUri: string, viewType?: string, lineNumber?: number, linkType?: string) => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({
        type: 'openLink',
        targetUri,
        viewType,
        lineNumber,
        linkType,
      });
    }
  };
  handleOpenLinkRef.current = handleOpenLink;

  const handleAddLink = () => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'addLink' });
    }
  };

  const handleCreateCompanion = (companionType: 'tasks' | 'chart') => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({
        type: 'createCompanion',
        companionType,
      });
    }
  };

  const handleGenerateAiTasks = () => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'generateAiTasks' });
    }
  };

  const handleSortAiInbox = () => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'sortAiInbox' });
    }
  };

  const handleToggleSyntaxVisibility = () => {
    setSyntaxMode((prev) => {
      const next: SyntaxVisibilityMode =
        prev === 'auto' ? 'visible' : prev === 'visible' ? 'hidden' : 'auto';
      if (editorView) {
        editorView.dispatch({
          effects: syntaxVisibilityCompartment.reconfigure(syntaxVisibilityFacet.of(next)),
        });
        editorView.focus();
      }
      try {
        const api = getVsCodeApi();
        const existing = (api?.getState?.() as any) || {};
        api?.setState?.({ ...existing, syntaxVisibilityMode: next });
      } catch {}
      return next;
    });
  };

  const handleOpenDatePickerFromToolbar = () => {
    if (!editorView) return;
    const sel = editorView.state.selection.main;
    const pos = sel.head;
    const coords = editorView.coordsAtPos(pos);
    const position = coords
      ? { top: coords.bottom, left: coords.left }
      : { top: 80, left: 100 };
    setDatePickerState({
      isOpen: true,
      position,
      insertPos: pos,
    });
  };

  const handleDateSelected = (dateStr: string) => {
    if (editorView && datePickerState) {
      const { insertPos } = datePickerState;
      editorView.dispatch({
        changes: { from: insertPos, insert: dateStr },
        selection: { anchor: insertPos + dateStr.length },
      });
      editorView.focus();
    }
    setDatePickerState(null);
  };

  const handleDatePickerClose = () => {
    setDatePickerState(null);
    if (editorView) {
      editorView.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden box-border bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] font-sans">
      {/* Formatting Toolbar with Active States and Open Source Action */}
      <div className="shrink-0">
        <MarkdownToolbar
          editorView={editorView}
          isDirty={hostDirty || hasPendingEdits}
          onSave={() => requestSaveRef.current()}
          activeState={activeState}
          onOpenSource={handleOpenSource}
          onExportPdf={handleExportPdf}
          syntaxMode={syntaxMode}
          onToggleSyntaxVisibility={handleToggleSyntaxVisibility}
          onOpenDatePicker={handleOpenDatePickerFromToolbar}
        />
      </div>

      {/* CodeMirror Host Container (Single Scroll Root) */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden outline-none w-full"
      />

      {/* DatePicker Popover */}
      {datePickerState?.isOpen && (
        <DatePickerPopover
          isOpen={datePickerState.isOpen}
          position={datePickerState.position}
          onSelect={handleDateSelected}
          onClose={handleDatePickerClose}
        />
      )}

      {/* Interactive Links & Companions Footer Bar */}
      <NotesLinksFooter
        linksData={linksData}
        onOpenLink={handleOpenLink}
        onAddLink={handleAddLink}
        onCreateCompanion={handleCreateCompanion}
        onGenerateAiTasks={handleGenerateAiTasks}
        onSortAiInbox={sortSource ? handleSortAiInbox : undefined}
        sortLabel={sortSource === 'daily' ? 'Tagesnotiz einsortieren' : 'Inbox einsortieren'}
        isGeneratingTasks={isGeneratingTasks}
        isSortingInbox={isSortingInbox}
      />
    </div>
  );
};
