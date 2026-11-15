import { ChangeSet, ChangeSpec, EditorState, Line, StateCommand, Transaction, countColumn } from '@codemirror/state';
import { KeyBinding } from '@codemirror/view';
import { indentLess, indentMore } from '@codemirror/commands';
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown';
import { linkedTaskIdRange } from '../../../services/linkedTaskLines';
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

/** Text after the marker of an empty list item: only spaces, optionally with a task checkbox. */
const EMPTY_ITEM_REST = /^ *(?:\[[ xX]\] *)?$/;

/**
 * Enter on an empty list item leaves it instead of continuing the list: a nested item moves one
 * level up (like Shift-Tab), a top-level item loses its marker and the list ends.
 * Returns false for every other case so the default Markdown Enter handles it.
 */
export const exitEmptyListItem: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  const { ranges, main } = state.selection;
  if (ranges.length !== 1 || !main.empty) return false;

  const tree = getListTree(state);
  if (!tree) return false;

  const line = state.doc.lineAt(main.head);
  const node = findListItemAtLine(state, tree, line);
  const info = node ? toListItemInfo(state, node) : null;
  // Single-line items only: an item spanning more lines has children or continuation text
  if (!node || !info || info.startLine !== line.number || info.endLine !== line.number) return false;
  if (main.head < info.markTo) return false;
  if (!EMPTY_ITEM_REST.test(state.doc.sliceString(info.markTo, line.to))) return false;

  if (parentItem(node)) {
    return outdentListOrLines({ state, dispatch });
  }

  // Top level: clear the line, keeping a blockquote prefix (`> `)
  let keep = 0;
  if (hasAncestor(node, 'Blockquote')) {
    keep = quotePrefixLength(line.text);
    if (line.text[keep] === ' ') keep++;
  }
  const from = line.from + keep;
  dispatch(
    state.update({
      changes: { from, to: line.to },
      selection: { anchor: from },
      scrollIntoView: true,
      userEvent: 'delete',
    })
  );
  return true;
};

/**
 * Shift-Enter in a list item: splits the line at the cursor and continues the same item on a new
 * line without a marker, indented to the item's content column (keeping a blockquote prefix).
 * Returns false outside list items so the default Shift-Enter applies.
 */
/**
 * The line end to use instead of the cursor when an empty cursor sits in front of the (hidden) task ID of a
 * linked task line, so line breaks keep the ID on its line; null otherwise.
 */
function lineEndBehindTaskId(state: EditorState): number | null {
  const range = state.selection.main;
  if (state.selection.ranges.length !== 1 || !range.empty) return null;
  const line = state.doc.lineAt(range.head);
  const idRange = linkedTaskIdRange(line.text);
  return idRange && range.head >= line.from + idRange.from ? line.to : null;
}

/** Enter in front of the hidden task ID of a linked task line continues the list after the ID. */
export const enterBehindTaskId: StateCommand = ({ state, dispatch }) => {
  const lineEnd = lineEndBehindTaskId(state);
  if (lineEnd === null || state.readOnly) return false;
  const atLineEnd = state.update({ selection: { anchor: lineEnd }, filter: false }).state;
  let result: Transaction | null = null;
  if (!insertNewlineContinueMarkup({ state: atLineEnd, dispatch: (tr) => (result = tr) }) || !result) return false;
  const tr: Transaction = result;
  dispatch(state.update({ changes: tr.changes, selection: tr.selection, scrollIntoView: true, userEvent: 'input' }));
  return true;
};

export const insertListLineBreak: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly || state.selection.ranges.length !== 1) return false;
  const lineEnd = lineEndBehindTaskId(state);
  const range = lineEnd === null ? state.selection.main : { from: lineEnd, to: lineEnd };

  const tree = getListTree(state);
  if (!tree || isInsideNode(tree, range.from, 'Table')) return false;

  const line = state.doc.lineAt(range.from);
  const node = findListItemAtLine(state, tree, line);
  const info = node ? toListItemInfo(state, node) : null;
  if (!node || !info) return false;

  // Text may only be split after the marker; on continuation lines after the indentation
  const contentStart =
    info.startLine === line.number
      ? info.markTo + (line.text.slice(info.markTo - line.from).match(/^ */)![0].length)
      : line.from + line.text.match(/^(?:[ \t]*>)*[ \t]*/)![0].length;
  if (range.from < (info.startLine === line.number ? info.markTo : line.from)) return false;

  // Drop spaces around the break so no trailing or leading spaces remain
  let from = range.from;
  while (from > contentStart && line.text[from - 1 - line.from] === ' ') from--;
  let to = range.to;
  const toLine = state.doc.lineAt(to);
  while (to < toLine.to && state.doc.sliceString(to, to + 1) === ' ') to++;

  let prefix = '';
  if (hasAncestor(node, 'Blockquote')) {
    const quoteLen = quotePrefixLength(line.text);
    prefix = line.text.slice(0, quoteLen) + (line.text[quoteLen] === ' ' ? ' ' : '');
  }
  const pad = Math.max(0, info.contentCol - countColumn(prefix, state.tabSize));
  const insert = '\n' + prefix + ' '.repeat(pad);

  dispatch(
    state.update({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      scrollIntoView: true,
      userEvent: 'input',
    })
  );
  return true;
};

/** Whether the text of `line` is a paragraph line of `item` itself (not code, a table or a nested block). */
function isParagraphLineOf(tree: Tree, line: Line, item: SyntaxNode): boolean {
  const contentStart = line.text.match(/^(?:[ \t]*>)*[ \t]*/)![0].length;
  for (let node: SyntaxNode | null = tree.resolveInner(line.from + contentStart, 1); node; node = node.parent) {
    if (node.name === 'Paragraph') return node.parent?.from === item.from && node.parent.name === 'ListItem';
    if (node.name === 'ListItem' || node.name === 'Document') return false;
  }
  return false;
}

/** Renumbers the ordered list containing the item whose marker starts at `markPos`, consecutively from its first number. */
function renumberListAt(state: EditorState, markPos: number): ChangeSet | null {
  const tree = getListTree(state);
  if (!tree) return null;
  let node: SyntaxNode | null = tree.resolveInner(markPos, 1);
  while (node && node.name !== 'ListItem') node = node.parent;
  const list = node?.parent;
  if (!list || list.name !== 'OrderedList') return null;

  const changes: ChangeSpec[] = [];
  let number: number | null = null;
  for (let child = list.firstChild; child; child = child.nextSibling) {
    const info = toListItemInfo(state, child);
    if (!info) continue;
    const current = info.markText.match(/^(\d+)/);
    if (!current) continue;
    if (number === null) number = parseInt(current[1], 10);
    else if (parseInt(current[1], 10) !== number) {
      changes.push({ from: info.markFrom, to: info.markFrom + current[1].length, insert: String(number) });
    }
    number++;
  }
  return changes.length ? state.changes(changes) : null;
}

/**
 * Enter on a continuation line of a list item (e.g. after Shift+Enter) starts a new item of the
 * same list below it. On the indented empty line right after Shift+Enter, that line becomes the item.
 * Returns false otherwise so the default Markdown Enter applies.
 */
export const insertItemFromContinuation: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly || state.selection.ranges.length !== 1) return false;
  const range = state.selection.main;
  const tree = getListTree(state);
  if (!tree || isInsideNode(tree, range.from, 'Table')) return false;

  const line = state.doc.lineAt(range.from);
  if (state.doc.lineAt(range.to).number !== line.number) return false;

  const lineContentStart = line.text.match(/^(?:[ \t]*>)*[ \t]*/)![0].length;
  const blank = lineContentStart >= line.text.length;
  let node: SyntaxNode | null;
  if (blank) {
    // Indented empty line directly below an item's text
    if (line.text.length === 0 || line.number === 1) return false;
    node = findListItemAtLine(state, tree, state.doc.line(line.number - 1));
  } else {
    node = findListItemAtLine(state, tree, line);
  }
  const info = node ? toListItemInfo(state, node) : null;
  if (!node || !info) return false;

  if (blank) {
    if (countColumn(line.text, state.tabSize) < info.contentCol) return false;
  } else if (info.startLine === line.number || !isParagraphLineOf(tree, line, node)) {
    return false;
  }

  let prefix = '';
  if (hasAncestor(node, 'Blockquote')) {
    const quoteLen = quotePrefixLength(line.text);
    prefix = line.text.slice(0, quoteLen) + (line.text[quoteLen] === ' ' ? ' ' : '');
  }
  const markLine = state.doc.lineAt(info.markFrom);
  const isTask = /^\s+\[[ xX]\]/.test(markLine.text.slice(info.markTo - markLine.from));
  const numbered = info.markText.match(/^(\d+)(.*)$/);
  const marker = numbered ? `${parseInt(numbered[1], 10) + 1}${numbered[2]}` : info.markText;
  const indent = ' '.repeat(Math.max(0, info.indentCol - countColumn(prefix, state.tabSize)));
  const itemStart = prefix + indent + marker + ' ' + (isTask ? '[ ] ' : '');

  let changes: ChangeSet;
  let markPos: number;
  let cursor: number;
  if (blank) {
    changes = state.changes({ from: line.from, to: line.to, insert: itemStart });
    markPos = line.from + prefix.length + indent.length;
    cursor = line.from + itemStart.length;
  } else {
    let from = range.from;
    const minFrom = line.from + lineContentStart;
    while (from > minFrom && line.text[from - 1 - line.from] === ' ') from--;
    let to = range.to;
    while (to < line.to && line.text[to - line.from] === ' ') to++;
    changes = state.changes({ from, to, insert: '\n' + itemStart });
    markPos = from + 1 + prefix.length + indent.length;
    cursor = from + 1 + itemStart.length;
  }

  if (numbered) {
    const renumber = renumberListAt(state.update({ changes }).state, markPos);
    if (renumber) {
      cursor = renumber.mapPos(cursor, 1);
      changes = changes.compose(renumber);
    }
  }

  dispatch(
    state.update({
      changes,
      selection: { anchor: cursor },
      scrollIntoView: true,
      userEvent: 'input',
    })
  );
  return true;
};

/** Enter on list lines: leave empty items, or start a new item after a continuation line. */
const listEnter: StateCommand = (target) =>
  exitEmptyListItem(target) || insertItemFromContinuation(target) || enterBehindTaskId(target);

/** Enter bindings that must run before the Markdown keymap's list continuation. */
export const listEnterKeymap: readonly KeyBinding[] = [
  { key: 'Enter', run: listEnter, shift: insertListLineBreak },
];
