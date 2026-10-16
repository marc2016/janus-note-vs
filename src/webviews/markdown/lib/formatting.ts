import { EditorView, KeyBinding } from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';

export const formattingKeymap: readonly KeyBinding[] = [
  {
    key: 'Mod-b',
    run: (view: EditorView) => toggleInlineFormatting(view, '**'),
  },
  {
    key: 'Mod-i',
    run: (view: EditorView) => toggleInlineFormatting(view, '*'),
  },
  {
    key: 'Mod-e',
    run: (view: EditorView) => toggleInlineFormatting(view, '`'),
  },
];

export const MARKER_NODE_MAP: Record<string, string> = {
  '**': 'StrongEmphasis',
  '*': 'Emphasis',
  '~~': 'Strikethrough',
  '`': 'InlineCode',
};

/**
 * Toggles inline Markdown formatting (bold, italic, strikethrough, code) in the editor.
 * - If selection is non-empty: wraps selection or strips existing markers.
 * - If selection is collapsed inside a formatted node: strips/unwraps the node formatting.
 * - If selection is collapsed within/touching an unformatted word: expands to word boundaries and wraps the word.
 * - If selection is collapsed at whitespace or empty position: inserts marker pair with cursor placed in between.
 *
 * @returns true if change was dispatched, false otherwise
 */
export function toggleInlineFormatting(view: EditorView, marker: string): boolean {
  if (!view || view.state.readOnly) {
    return false;
  }

  const sel = view.state.selection.main;
  const mLen = marker.length;

  if (sel.from === sel.to) {
    // 1. Check if cursor is inside an existing AST node of this type
    const targetNodeName = MARKER_NODE_MAP[marker];
    let foundNode: any = null;

    if (targetNodeName) {
      const tree = ensureSyntaxTree(view.state, view.state.doc.length, 50) || syntaxTree(view.state);
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
        const newPos = Math.max(foundNode.from, Math.min(sel.head - mLen, foundNode.from + innerText.length));
        view.dispatch({
          changes: { from: foundNode.from, to: foundNode.to, insert: innerText },
          selection: { anchor: newPos },
        });
        view.focus();
        return true;
      }
    }

    // 2. Check word boundary at cursor position
    const word = view.state.wordAt(sel.head);
    if (word) {
      // Check if word is already wrapped with marker (e.g. strikethrough without dedicated AST node)
      if (
        word.from >= mLen &&
        word.to + mLen <= view.state.doc.length &&
        view.state.sliceDoc(word.from - mLen, word.from) === marker &&
        view.state.sliceDoc(word.to, word.to + mLen) === marker
      ) {
        const newPos = Math.max(word.from - mLen, Math.min(sel.head - mLen, word.to - mLen));
        view.dispatch({
          changes: [
            { from: word.from - mLen, to: word.from, insert: '' },
            { from: word.to, to: word.to + mLen, insert: '' },
          ],
          selection: { anchor: newPos },
        });
        view.focus();
        return true;
      }

      // Wrap word with marker and shift cursor accordingly
      const wordText = view.state.sliceDoc(word.from, word.to);
      view.dispatch({
        changes: { from: word.from, to: word.to, insert: `${marker}${wordText}${marker}` },
        selection: { anchor: sel.head + mLen },
      });
      view.focus();
      return true;
    }

    // 3. Fallback: Cursor is at whitespace or empty position -> insert marker pair
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: `${marker}${marker}` },
      selection: { anchor: sel.from + mLen },
    });
    view.focus();
    return true;
  } else {
    // Non-collapsed selection range
    const selectedText = view.state.sliceDoc(sel.from, sel.to);
    if (
      selectedText.startsWith(marker) &&
      selectedText.endsWith(marker) &&
      selectedText.length >= mLen * 2
    ) {
      // Already wrapped inside selection
      const innerText = selectedText.slice(mLen, -mLen);
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: innerText },
        selection: { anchor: sel.from, head: sel.from + innerText.length },
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
        selection: { anchor: sel.from - mLen, head: sel.to - mLen },
      });
    } else {
      // Wrap selection
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: `${marker}${selectedText}${marker}` },
        selection: { anchor: sel.from + mLen, head: sel.to + mLen },
      });
    }
    view.focus();
    return true;
  }
}
