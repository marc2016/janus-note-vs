// Pure helpers for linked task lines (`- [ ] Title ^t-xxxxxx`), shared by the editor webview and the sync service.

/** A task list item whose line ends with a task ID: prefix, checkbox, title, ID. */
const LINKED_LINE_RE = /^(\s*(?:>\s*)*[-*+]\s+)\[([ xX])\](\s+)(.*?)\s*\^(t-[a-z0-9]{6})\s*$/;
const ID_SUFFIX_RE = /\s+\^t-[a-z0-9]{6}\s*$/;
const FENCE_RE = /^\s*(?:>\s*)*(```|~~~)/;

export interface LinkedTaskLine {
  id: string;
  title: string;
  done: boolean;
  /** Zero-based line index in the text. */
  line: number;
}

/** Parses a single line; returns null when it is not a linked task line. */
export function parseLinkedTaskLine(lineText: string): Omit<LinkedTaskLine, 'line'> | null {
  const match = LINKED_LINE_RE.exec(lineText);
  if (!match) return null;
  return { id: match[5], title: match[4].trim(), done: match[2] !== ' ' };
}

/** All linked task lines of a note outside fenced code blocks, including those with an empty title. */
export function parseLinkedTaskLines(text: string): LinkedTaskLine[] {
  const result: LinkedTaskLine[] = [];
  let inCode = false;
  text.split(/\r?\n/).forEach((lineText, line) => {
    if (FENCE_RE.test(lineText)) {
      inCode = !inCode;
      return;
    }
    if (inCode) return;
    const parsed = parseLinkedTaskLine(lineText);
    if (parsed) result.push({ ...parsed, line });
  });
  return result;
}

/** Rewrites title and/or done state of a linked task line, keeping prefix, spacing and ID. */
export function rewriteLinkedTaskLine(lineText: string, change: { title?: string; done?: boolean }): string {
  const match = LINKED_LINE_RE.exec(lineText);
  if (!match) return lineText;
  const box = change.done === undefined ? match[2] : change.done ? 'x' : ' ';
  const title = change.title === undefined ? match[4].trim() : change.title.trim();
  return `${match[1]}[${box}]${match[3]}${title} ^${match[5]}`;
}

/** Removes the trailing task ID, leaving a plain line. */
export function removeLinkedTaskId(lineText: string): string {
  return lineText.replace(ID_SUFFIX_RE, '');
}

/** Position of the ` ^t-xxxxxx` suffix in a linked task line, or null. */
export function linkedTaskIdRange(lineText: string): { from: number; to: number } | null {
  const line = LINKED_LINE_RE.exec(lineText);
  if (!line || !ID_SUFFIX_RE.test(lineText)) return null;
  // Only the single space directly before `^` belongs to the ID; further spaces are typed title text
  const caret = lineText.search(/\^t-[a-z0-9]{6}\s*$/);
  const from = /\s/.test(lineText[caret - 1]) ? caret - 1 : caret;
  // One space after the checkbox always belongs to the title, so an empty title keeps a place to type
  const titleStart = line[1].length + 3 + 1;
  return { from: Math.max(from, titleStart), to: lineText.length };
}

/** A new task ID (`t-` + 6 base36 characters) that does not occur in `existingText`. */
export function newLinkedTaskId(existingText = '', random: () => number = Math.random): string {
  for (;;) {
    let id = 't-';
    for (let i = 0; i < 6; i++) id += Math.floor(random() * 36).toString(36);
    if (!existingText.includes(id)) return id;
  }
}

/** Note text without linked task lines (for AI extraction). */
export function withoutLinkedTaskLines(text: string): string {
  const linked = new Set(parseLinkedTaskLines(text).map((l) => l.line));
  return text
    .split(/\r?\n/)
    .filter((_, i) => !linked.has(i))
    .join('\n');
}
