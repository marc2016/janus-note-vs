import { ChangeSet, ChangeSpec, EditorState, Line, StateCommand, countColumn } from '@codemirror/state';
import { KeyBinding } from '@codemirror/view';
import { indentLess, indentMore } from '@codemirror/commands';
import type { SyntaxNode, Tree } from '@lezer/common';
import {
  ListItemInfo,
  getListTree,
  findListItemAtLine,
  toListItemInfo,
  previousSiblingItem,
  nextSiblingItem,
  parentItem,
  isInsideNode,
  hasAncestor,
} from './listStructure';

const PLAIN_INDENT = 2;

type Direction = 1 | -1;

interface ListMove {
  info: ListItemInfo;
  delta: number;
  inBlockquote: boolean;
}

/** Lines touched by the selection, following CodeMirror's convention of excluding a trailing line-start. */
function selectedLines(state: EditorState): Line[] {
  const seen = new Set<number>();
  const lines: Line[] = [];
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from);
    let last = state.doc.lineAt(range.to);
    if (!range.empty && range.to === last.from && last.number > first.number) {
      last = state.doc.line(last.number - 1);
    }
    for (let n = first.number; n <= last.number; n++) {
      if (!seen.has(n)) {
        seen.add(n);
        lines.push(state.doc.line(n));
      }
    }
  }
  return lines.sort((a, b) => a.number - b.number);
}

/** Length of a leading blockquote prefix (`>`, `> >`) that indentation must be inserted after. */
function quotePrefixLength(text: string): number {
  return text.match(/^(?:[ \t]*>)*/)![0].length;
}

/** Shifts a line's indentation by `delta` columns, inserting/removing spaces after any quote prefix. */
function shiftLine(state: EditorState, line: Line, delta: number, inBlockquote: boolean): ChangeSpec | null {
  if (delta === 0 || line.text.trim() === '') return null;
  const prefix = inBlockquote ? quotePrefixLength(line.text) : 0;
  const at = line.from + prefix;

  if (delta > 0) {
    return { from: at, insert: ' '.repeat(delta) };
  }

  // Remove whitespace until -delta columns are gone (or the indentation runs out).
  const text = line.text;
  const startCol = countColumn(text, state.tabSize, prefix);
  let end = prefix;
  while (end < text.length && (text[end] === ' ' || text[end] === '\t')) {
    if (countColumn(text, state.tabSize, end) - startCol >= -delta) break;
    end++;
  }
  return end > prefix ? { from: at, to: line.from + end } : null;
}

/**
 * Computes the indentation moves for all top-most list items touched by the selection.
 * Returns null when the selection does not touch any list item.
 */
function planListMoves(
  state: EditorState,
  tree: Tree,
  dir: Direction
): { moves: ListMove[]; plainLines: Line[] } | null {
  const lines = selectedLines(state);
  const itemsByFrom = new Map<number, SyntaxNode>();
  const plainCandidates: Line[] = [];

  for (const line of lines) {
    const node = findListItemAtLine(state, tree, line);
    if (node) itemsByFrom.set(node.from, node);
    else plainCandidates.push(line);
  }
  if (itemsByFrom.size === 0) return null;

  // Keep only top-most items: children move along with a selected ancestor.
  const topItems = [...itemsByFrom.values()]
    .filter((node) => {
      for (let p = parentItem(node); p; p = parentItem(p)) {
        if (itemsByFrom.has(p.from)) return false;
      }
      return true;
    })
    .sort((a, b) => a.from - b.from);

  const moves: ListMove[] = [];
  const covered: Array<[number, number]> = [];

  for (const node of topItems) {
    const info = toListItemInfo(state, node);
    if (!info) continue;
    covered.push([info.startLine, info.endLine]);

    let newIndent: number | null = null;
    if (dir === 1) {
      // A run of selected siblings nests under the nearest unselected previous sibling.
      let target = previousSiblingItem(node);
      while (target && itemsByFrom.has(target.from)) target = previousSiblingItem(target);
      const targetInfo = target ? toListItemInfo(state, target) : null;
      if (targetInfo) newIndent = targetInfo.contentCol;
    } else {
      const parent = parentItem(node);
      const parentInfo = parent ? toListItemInfo(state, parent) : null;
      if (parentInfo) newIndent = parentInfo.indentCol;
    }

    if (newIndent !== null && newIndent !== info.indentCol) {
      moves.push({ info, delta: newIndent - info.indentCol, inBlockquote: hasAncestor(node, 'Blockquote') });
    }
  }

  const plainLines = plainCandidates.filter(
    (line) => !covered.some(([from, to]) => line.number >= from && line.number <= to)
  );
  return { moves, plainLines };
}

function parseNumber(markText: string): number | null {
  const match = markText.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Renumbers ordered lists affected by the moves, on the state after indentation was applied.
 * New sub-lists start at 1, lists left behind by a moved item keep their original start number,
 * and every affected list is numbered consecutively from its start.
 */
function renumberAffectedLists(
  before: EditorState,
  after: EditorState,
  indentChanges: ChangeSet,
  moves: ListMove[]
): ChangeSet | null {
  const tree = getListTree(after);
  if (!tree) return null;

  const movedFrom = new Set<number>();
  // Followers: items that came right after a moved item, mapped to their original list's start number.
  const followerStart = new Map<number, number>();

  for (const { info } of moves) {
    movedFrom.add(indentChanges.mapPos(info.markFrom, 1));
    const next = nextSiblingItem(info.node);
    if (next && !moves.some((m) => m.info.node.from === next.from)) {
      const firstInList = info.node.parent?.firstChild;
      const firstInfo = firstInList ? toListItemInfo(before, firstInList) : null;
      const start = (firstInfo && parseNumber(firstInfo.markText)) ?? 1;
      followerStart.set(indentChanges.mapPos(next.from, 1), start);
    }
  }

  const lists = new Map<number, SyntaxNode>();
  for (const pos of [...movedFrom, ...followerStart.keys()]) {
    let node: SyntaxNode | null = tree.resolveInner(pos, 1);
    while (node && node.name !== 'ListItem') node = node.parent;
    if (node && node.from === pos && node.parent?.name === 'OrderedList') {
      lists.set(node.parent.from, node.parent);
    }
  }

  const changes: ChangeSpec[] = [];
  for (const list of lists.values()) {
    const items: ListItemInfo[] = [];
    for (let child = list.firstChild; child; child = child.nextSibling) {
      const info = toListItemInfo(after, child);
      if (info) items.push(info);
    }
    if (items.length === 0) continue;

    const first = items[0];
    let number: number;
    if (movedFrom.has(first.markFrom)) number = 1;
    else if (followerStart.has(first.markFrom)) number = followerStart.get(first.markFrom)!;
    else number = parseNumber(first.markText) ?? 1;

    for (const item of items) {
      const current = item.markText.match(/^(\d+)/);
      if (current && parseInt(current[1], 10) !== number) {
        changes.push({ from: item.markFrom, to: item.markFrom + current[1].length, insert: String(number) });
      }
      number++;
    }
  }

  return changes.length ? after.changes(changes) : null;
}

function changeIndentation(dir: Direction): StateCommand {
  return ({ state, dispatch }) => {
    if (state.readOnly) return false;

    const tree = getListTree(state);
    if (!tree) return dir === 1 ? indentMore({ state, dispatch }) : indentLess({ state, dispatch });

    // Table cells handle Tab/Shift-Tab navigation themselves.
    if (state.selection.ranges.some((r) => isInsideNode(tree, r.head, 'Table'))) return false;

    const plan = planListMoves(state, tree, dir);
    if (!plan) return dir === 1 ? indentMore({ state, dispatch }) : indentLess({ state, dispatch });

    const specs: ChangeSpec[] = [];
    for (const { info, delta, inBlockquote } of plan.moves) {
      for (let n = info.startLine; n <= info.endLine; n++) {
        const spec = shiftLine(state, state.doc.line(n), delta, inBlockquote);
        if (spec) specs.push(spec);
      }
    }
    for (const line of plan.plainLines) {
      const spec = shiftLine(state, line, dir * PLAIN_INDENT, false);
      if (spec) specs.push(spec);
    }

    // List boundary (first item / top level): nothing to do, but keep focus in the editor.
    if (specs.length === 0) return true;

    let changes = state.changes(specs);
    if (plan.moves.length > 0) {
      const afterIndent = state.update({ changes }).state;
      const renumber = renumberAffectedLists(state, afterIndent, changes, plan.moves);
      if (renumber) changes = changes.compose(renumber);
    }

    dispatch(
      state.update({
        changes,
        selection: state.selection.map(changes, 1),
        scrollIntoView: true,
        userEvent: dir === 1 ? 'input.indent' : 'delete.dedent',
      })
    );
    return true;
  };
}

/** Tab: nest list items under their previous sibling, or indent plain lines by 2 spaces. */
export const indentListOrLines: StateCommand = changeIndentation(1);

/** Shift-Tab: move list items one level up, or outdent plain lines by up to 2 spaces. */
export const outdentListOrLines: StateCommand = changeIndentation(-1);

export const listIndentationKeymap: readonly KeyBinding[] = [
  { key: 'Tab', run: indentListOrLines, shift: outdentListOrLines },
];
