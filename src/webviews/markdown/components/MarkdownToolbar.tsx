import React from 'react';
import { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { Button } from '../../components/ui/button';
import { MdiIcon } from '../../components/ui/MdiIcon';
import {
  mdiFormatBold,
  mdiFormatItalic,
  mdiFormatStrikethrough,
  mdiFormatHeader1,
  mdiFormatHeader2,
  mdiFormatHeader3,
  mdiFormatListBulleted,
  mdiFormatListNumbered,
  mdiFormatListCheckbox,
  mdiFormatQuoteClose,
  mdiCodeTags,
  mdiMinus,
  mdiUndo,
  mdiRedo,
  mdiTable,
} from '../../../ui/icons';

export interface ActiveToolbarState {
  heading: number; // 0 = normal text, 1 = H1, 2 = H2, 3 = H3
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  bulletList: boolean;
  numberedList: boolean;
  taskList: boolean;
  blockquote: boolean;
}

export const defaultActiveToolbarState: ActiveToolbarState = {
  heading: 0,
  bold: false,
  italic: false,
  strike: false,
  code: false,
  bulletList: false,
  numberedList: false,
  taskList: false,
  blockquote: false,
};

interface MarkdownToolbarProps {
  editorView: EditorView | null;
  activeState?: ActiveToolbarState;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  editorView,
  activeState = defaultActiveToolbarState,
}) => {
  const handleUndo = () => {
    if (editorView) {
      undo(editorView);
      editorView.focus();
    }
  };

  const handleRedo = () => {
    if (editorView) {
      redo(editorView);
      editorView.focus();
    }
  };

  const setNormalText = () => {
    if (!editorView) return;
    const view = editorView;
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.head);
    const match = line.text.match(/^(#{1,6})\s*/);
    if (match) {
      view.dispatch({
        changes: { from: line.from, to: line.from + match[0].length, insert: '' },
      });
    }
    view.focus();
  };

  const toggleHeading = (level: number) => {
    if (!editorView) return;
    const view = editorView;
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.head);
    const match = line.text.match(/^(#{1,6})\s*/);

    if (match) {
      if (match[1].length === level) {
        // Toggle off back to normal text
        view.dispatch({
          changes: { from: line.from, to: line.from + match[0].length, insert: '' },
        });
      } else {
        // Change level
        view.dispatch({
          changes: { from: line.from, to: line.from + match[0].length, insert: '#'.repeat(level) + ' ' },
        });
      }
    } else {
      // Prepend heading
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: '#'.repeat(level) + ' ' },
      });
    }
    view.focus();
  };

  const toggleInlineMark = (marker: string) => {
    if (!editorView) return;
    const view = editorView;
    const sel = view.state.selection.main;
    const mLen = marker.length;

    if (sel.from === sel.to) {
      // Check if cursor is inside an existing node of this type
      const targetNodeName =
        marker === '**' ? 'StrongEmphasis' :
        marker === '*' ? 'Emphasis' :
        marker === '~~' ? 'Strikethrough' :
        marker === '`' ? 'InlineCode' : null;

      let foundNode: any = null;
      if (targetNodeName) {
        const tree = syntaxTree(view.state);
        for (let cur: any = tree.resolveInner(sel.head, 1); cur; cur = cur.parent) {
          if (cur.name === targetNodeName) {
            foundNode = cur;
            break;
          }
        }
        if (!foundNode && sel.head > 0) {
          for (let cur: any = tree.resolveInner(sel.head, -1); cur; cur = cur.parent) {
            if (cur.name === targetNodeName) {
              foundNode = cur;
              break;
            }
          }
        }
      }

      if (foundNode) {
        const nodeText = view.state.sliceDoc(foundNode.from, foundNode.to);
        if (nodeText.startsWith(marker) && nodeText.endsWith(marker) && nodeText.length >= mLen * 2) {
          const innerText = nodeText.slice(mLen, -mLen);
          view.dispatch({
            changes: { from: foundNode.from, to: foundNode.to, insert: innerText },
            selection: {
              anchor: Math.max(foundNode.from, Math.min(sel.head - mLen, foundNode.from + innerText.length)),
            },
          });
          view.focus();
          return;
        }
      }

      // No node to strip: insert marker pair and place cursor between
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: `${marker}${marker}` },
        selection: { anchor: sel.from + mLen },
      });
    } else {
      const selectedText = view.state.sliceDoc(sel.from, sel.to);
      if (
        selectedText.startsWith(marker) &&
        selectedText.endsWith(marker) &&
        selectedText.length >= mLen * 2
      ) {
        // Already wrapped inside selection
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: selectedText.slice(mLen, -mLen) },
        });
      } else if (
        sel.from >= mLen &&
        sel.to + mLen <= view.state.doc.length &&
        view.state.sliceDoc(sel.from - mLen, sel.from) === marker &&
        view.state.sliceDoc(sel.to, sel.to + mLen) === marker
      ) {
        // Wrapped immediately outside selection
        view.dispatch({
          changes: [
            { from: sel.from - mLen, to: sel.from, insert: '' },
            { from: sel.to, to: sel.to + mLen, insert: '' },
          ],
        });
      } else {
        // Wrap selection
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: `${marker}${selectedText}${marker}` },
          selection: { anchor: sel.from + mLen, head: sel.to + mLen },
        });
      }
    }
    view.focus();
  };

  const toggleLinePrefix = (prefix: string, regex: RegExp) => {
    if (!editorView) return;
    const view = editorView;
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.head);
    const match = line.text.match(regex);

    if (match) {
      // Line already has this exact prefix -> remove it
      view.dispatch({
        changes: { from: line.from, to: line.from + match[0].length, insert: '' },
      });
    } else {
      // Check if line has any other list or quote prefix -> replace it cleanly
      const otherPrefixMatch = line.text.match(/^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+|> \s*)/);
      if (otherPrefixMatch) {
        view.dispatch({
          changes: { from: line.from, to: line.from + otherPrefixMatch[0].length, insert: prefix },
        });
      } else {
        view.dispatch({
          changes: { from: line.from, to: line.from, insert: prefix },
        });
      }
    }
    view.focus();
  };

  const insertSnippet = (snippet: string, cursorOffset?: number) => {
    if (!editorView) return;
    const view = editorView;
    const sel = view.state.selection.main;
    const targetOffset = cursorOffset !== undefined ? cursorOffset : snippet.length;

    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: snippet },
      selection: { anchor: sel.from + targetOffset },
    });
    view.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-6 py-2 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.2))] bg-card/40 select-none">
      {/* Undo / Redo */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleUndo}
        title="Undo (Ctrl+Z)"
      >
        <MdiIcon path={mdiUndo} size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleRedo}
        title="Redo (Ctrl+Y)"
      >
        <MdiIcon path={mdiRedo} size={16} />
      </Button>

      <div className="w-[1px] h-5 bg-border mx-1" />

      {/* Headings & Text */}
      <Button
        variant={activeState.heading === 0 ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 px-2 text-xs font-medium"
        onClick={setNormalText}
        title="Normaler Text (Paragraph / kein Heading)"
      >
        <span>Text</span>
      </Button>
      <Button
        variant={activeState.heading === 1 ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleHeading(1)}
        title="Heading 1 (# )"
      >
        <MdiIcon path={mdiFormatHeader1} size={17} />
      </Button>
      <Button
        variant={activeState.heading === 2 ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleHeading(2)}
        title="Heading 2 (## )"
      >
        <MdiIcon path={mdiFormatHeader2} size={17} />
      </Button>
      <Button
        variant={activeState.heading === 3 ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleHeading(3)}
        title="Heading 3 (### )"
      >
        <MdiIcon path={mdiFormatHeader3} size={17} />
      </Button>

      <div className="w-[1px] h-5 bg-border mx-1" />

      {/* Inline Marks */}
      <Button
        variant={activeState.bold ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleInlineMark('**')}
        title="Bold (**text**)"
      >
        <MdiIcon path={mdiFormatBold} size={17} />
      </Button>
      <Button
        variant={activeState.italic ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleInlineMark('*')}
        title="Italic (*text*)"
      >
        <MdiIcon path={mdiFormatItalic} size={17} />
      </Button>
      <Button
        variant={activeState.strike ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleInlineMark('~~')}
        title="Strikethrough (~~text~~)"
      >
        <MdiIcon path={mdiFormatStrikethrough} size={17} />
      </Button>
      <Button
        variant={activeState.code ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleInlineMark('`')}
        title="Inline Code (`code`)"
      >
        <MdiIcon path={mdiCodeTags} size={16} />
      </Button>

      <div className="w-[1px] h-5 bg-border mx-1" />

      {/* Lists */}
      <Button
        variant={activeState.bulletList ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleLinePrefix('- ', /^\s*[-*+]\s+/)}
        title="Bullet List (- )"
      >
        <MdiIcon path={mdiFormatListBulleted} size={17} />
      </Button>
      <Button
        variant={activeState.numberedList ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleLinePrefix('1. ', /^\s*\d+\.\s+/)}
        title="Numbered List (1. )"
      >
        <MdiIcon path={mdiFormatListNumbered} size={17} />
      </Button>
      <Button
        variant={activeState.taskList ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleLinePrefix('- [ ] ', /^\s*[-*+]\s+\[[ xX]\]\s+/)}
        title="Task List (- [ ] )"
      >
        <MdiIcon path={mdiFormatListCheckbox} size={17} />
      </Button>

      <div className="w-[1px] h-5 bg-border mx-1" />

      {/* Block Elements */}
      <Button
        variant={activeState.blockquote ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => toggleLinePrefix('> ', /^\s*>\s*/)}
        title="Blockquote (> )"
      >
        <MdiIcon path={mdiFormatQuoteClose} size={17} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() =>
          insertSnippet('| Column 1 | Column 2 |\n| --- | --- |\n| Item 1 | Item 2 |\n')
        }
        title="Insert Markdown Table"
      >
        <MdiIcon path={mdiTable} size={17} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs gap-1"
        onClick={() => insertSnippet('```\n\n```\n', 4)}
        title="Insert Code Block"
      >
        <MdiIcon path={mdiCodeTags} size={15} />
        <span>Block</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => insertSnippet('\n---\n')}
        title="Horizontal Rule (---)"
      >
        <MdiIcon path={mdiMinus} size={18} />
      </Button>
    </div>
  );
};
