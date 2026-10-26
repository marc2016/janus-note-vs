import { EditorState, Line, countColumn } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { SyntaxNode, Tree } from '@lezer/common';

/**
 * Structural information about a single Markdown list item, derived from the Lezer syntax tree.
 * Columns are measured from the start of the document line (tabs expanded with the state's tab size).
 */
export interface ListItemInfo {
  node: SyntaxNode;
  /** Document position of the list marker (`-`, `*`, `+`, `1.`, `2)`). */
  markFrom: number;
  markTo: number;
  markText: string;
  /** Whether the item belongs to an ordered list. */
  ordered: boolean;
  /** Column where the list marker starts. */
  indentCol: number;
  /** Column where the item content starts (CommonMark content column, i.e. required child indentation). */
  contentCol: number;
  /** First and last document line numbers covered by the item, including nested child items. */
  startLine: number;
  endLine: number;
}

/**
 * Returns a syntax tree covering the document up to `upto`, or null if parsing did not finish in time.
 */
export function getListTree(state: EditorState, upto: number = state.doc.length, timeout = 50): Tree | null {
  return ensureSyntaxTree(state, upto, timeout);
}

/**
 * Returns the parsed tree for read-only uses (styling) where a partial tree is acceptable.
 */
export function getAvailableTree(state: EditorState, upto: number): Tree {
  return ensureSyntaxTree(state, upto, 50) || syntaxTree(state);
}

export function toListItemInfo(state: EditorState, node: SyntaxNode): ListItemInfo | null {
  if (node.name !== 'ListItem') return null;
  const mark = node.getChild('ListMark');
  if (!mark) return null;

  const line = state.doc.lineAt(mark.from);
  const tabSize = state.tabSize;
  const indentCol = countColumn(line.text, tabSize, mark.from - line.from);
  const markEndCol = countColumn(line.text, tabSize, mark.to - line.from);

  // CommonMark: content starts after 1-4 spaces following the marker; an empty item or
  // 5+ spaces (indented code) means the content column is marker end + 1.
  const rest = line.text.slice(mark.to - line.from);
  const spaces = rest.match(/^ */)![0].length;
  const contentCol =
    spaces >= 1 && spaces <= 4 && rest.length > spaces ? markEndCol + spaces : markEndCol + 1;

  return {
    node,
    markFrom: mark.from,
    markTo: mark.to,
    markText: state.doc.sliceString(mark.from, mark.to),
    ordered: node.parent?.name === 'OrderedList',
    indentCol,
    contentCol,
    startLine: line.number,
    endLine: state.doc.lineAt(node.to).number,
  };
}

/**
 * Finds the innermost list item containing the first content character of `line`
 * (after indentation and any blockquote markers).
 * Returns null for lines that are blank or not part of any list item.
 */
export function findListItemAtLine(state: EditorState, tree: Tree, line: Line): SyntaxNode | null {
  const contentStart = line.text.match(/^(?:[ \t]*>)*[ \t]*/)![0].length;
  if (contentStart >= line.text.length) return null;

  let node: SyntaxNode | null = tree.resolveInner(line.from + contentStart, 1);
  while (node && node.name !== 'ListItem') node = node.parent;
  return node;
}

export function previousSiblingItem(node: SyntaxNode): SyntaxNode | null {
  let sibling = node.prevSibling;
  while (sibling && sibling.name !== 'ListItem') sibling = sibling.prevSibling;
  return sibling;
}

export function nextSiblingItem(node: SyntaxNode): SyntaxNode | null {
  let sibling = node.nextSibling;
  while (sibling && sibling.name !== 'ListItem') sibling = sibling.nextSibling;
  return sibling;
}

export function parentItem(node: SyntaxNode): SyntaxNode | null {
  const list = node.parent;
  const parent = list?.parent;
  return parent && parent.name === 'ListItem' ? parent : null;
}

/**
 * Number of list items enclosing `node` (top-level item = 0).
 */
export function listItemDepth(node: SyntaxNode): number {
  let depth = 0;
  for (let p = parentItem(node); p; p = parentItem(p)) depth++;
  return depth;
}

/**
 * Nesting depth of the list item whose marker starts at `markerPos`, or null if there is none.
 */
export function getListDepthAt(state: EditorState, tree: Tree, markerPos: number): number | null {
  let node: SyntaxNode | null = tree.resolveInner(markerPos, 1);
  while (node && node.name !== 'ListItem') node = node.parent;
  if (!node || node.from !== markerPos) return null;
  return listItemDepth(node);
}

export function isInsideNode(tree: Tree, pos: number, name: string): boolean {
  for (let node: SyntaxNode | null = tree.resolveInner(pos, 1); node; node = node.parent) {
    if (node.name === name) return true;
  }
  return false;
}

export function hasAncestor(node: SyntaxNode, name: string): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (p.name === name) return true;
  }
  return false;
}
