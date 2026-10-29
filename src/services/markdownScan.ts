// Pure Markdown link scanning without `vscode` imports, shared by the extension host and the webviews.

export const EXTERNAL_PROTOCOL_RE = /^(https?:|mailto:|tel:|vscode:|data:|#)/i;

/**
 * Extracts the clean target path and optional line number from a raw link target.
 * Supports:
 * - Colon line numbers: file.ts:42, file.ts:42:5, [[note:42]]
 * - GitHub hash anchors: file.ts#L42, file.ts#L42-L50, [[note#L42]]
 */
export function parseLinkTargetAndLine(rawTarget: string): { cleanTarget: string; lineNumber?: number } {
  let clean = rawTarget.trim();

  // Strip wrapping markdown link or wiki link delimiters if present
  const mdMatch = clean.match(/^\[.*\]\((.*)\)$/);
  if (mdMatch) {
    clean = mdMatch[1].trim();
  }
  clean = clean.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();

  // Strip trailing title attributes: e.g. path/to/file.md "Title"
  clean = clean.split(/\s+["']/)[0].trim();

  let lineNumber: number | undefined;

  // 1. Check for GitHub anchor #L42 or #L42-L50
  const hashMatch = clean.match(/#L(\d+)(?:-L\d+)?$/i);
  if (hashMatch) {
    lineNumber = parseInt(hashMatch[1], 10);
    clean = clean.split('#')[0].trim();
  } else if (clean.includes('#')) {
    // Other anchor like #section
    clean = clean.split('#')[0].trim();
  }

  // 2. Check for colon line syntax: :42 or :42:10 (avoiding drive letter C:\...)
  if (!lineNumber) {
    const trailingColonMatch = clean.match(/:(\d+)(?::\d+)?$/);
    if (trailingColonMatch) {
      const idx = trailingColonMatch.index!;
      // Ensure it's not a single drive letter like C:
      if (idx > 1 || (idx === 1 && !/^[a-zA-Z]:/.test(clean))) {
        lineNumber = parseInt(trailingColonMatch[1], 10);
        clean = clean.substring(0, idx).trim();
      }
    }
  }

  return { cleanTarget: clean, lineNumber };
}

export interface LinkOccurrence {
  type: 'wiki' | 'markdown' | 'image';
  /** Offset range of the whole link in the text. */
  start: number;
  end: number;
  /** Offset range of the path part, without alias, label, title, `#anchor` or `:line` suffix. */
  pathStart: number;
  pathEnd: number;
  path: string;
  /** Wiki-link alias (`[[target|alias]]`), if present. */
  alias?: string;
  /** Markdown link label or image alt text. */
  label?: string;
  /** 1-based line of the link start. */
  line: number;
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Returns offset ranges covered by fenced code blocks and inline code spans.
 */
export function findCodeRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lines = text.split('\n');
  let offset = 0;
  let fence: { char: string; length: number; start: number } | undefined;

  for (const line of lines) {
    const lineEnd = offset + line.length;
    const fenceMatch = line.match(FENCE_RE);

    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.length &&
        line.slice(fenceMatch[0].length).trim() === ''
      ) {
        ranges.push([fence.start, lineEnd]);
        fence = undefined;
      }
    } else if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length, start: offset };
    } else {
      // Inline code: a backtick run closed by a run of the same length on the same line
      let i = 0;
      while (i < line.length) {
        if (line[i] !== '`') {
          i++;
          continue;
        }
        let runEnd = i;
        while (line[runEnd] === '`') runEnd++;
        const run = line.slice(i, runEnd);
        let close = line.indexOf(run, runEnd);
        while (close !== -1 && (line[close - 1] === '`' || line[close + run.length] === '`')) {
          close = line.indexOf(run, close + 1);
        }
        if (close === -1) {
          i = runEnd;
          continue;
        }
        ranges.push([offset + i, offset + close + run.length]);
        i = close + run.length;
      }
    }

    offset = lineEnd + 1;
  }

  if (fence) {
    ranges.push([fence.start, text.length]);
  }
  return ranges;
}

/**
 * Locates the path part inside a raw link target that starts at `targetStart`.
 * Returns undefined for external targets or when the path cannot be located exactly.
 */
function locateLinkPath(
  rawTarget: string,
  targetStart: number
): { path: string; pathStart: number; pathEnd: number } | undefined {
  const trimmed = rawTarget.trim();
  if (!trimmed || EXTERNAL_PROTOCOL_RE.test(trimmed)) {
    return undefined;
  }
  const { cleanTarget } = parseLinkTargetAndLine(trimmed);
  if (!cleanTarget || !trimmed.startsWith(cleanTarget)) {
    return undefined;
  }
  const pathStart = targetStart + (rawTarget.length - rawTarget.trimStart().length);
  return { path: cleanTarget, pathStart, pathEnd: pathStart + cleanTarget.length };
}

/**
 * Finds every wiki-link and Markdown link (and optionally image) occurrence with its
 * position, skipping fenced code blocks and inline code spans. Unlike
 * `extractDocumentLinks`, repeated links are all returned.
 */
export function findLinkOccurrences(
  text: string,
  options: { includeImages?: boolean } = {}
): LinkOccurrence[] {
  const codeRanges = findCodeRanges(text);
  const inCode = (offset: number) => codeRanges.some(([s, e]) => offset >= s && offset < e);
  const lineAt = (offset: number) => text.slice(0, offset).split('\n').length;
  const results: LinkOccurrence[] = [];
  const wikiRanges: Array<[number, number]> = [];
  let match: RegExpExecArray | null;

  const wikiRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  while ((match = wikiRe.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    wikiRanges.push([start, end]);
    if (inCode(start)) continue;
    const located = locateLinkPath(match[1], start + 2);
    if (!located) continue;
    const occurrence: LinkOccurrence = { type: 'wiki', start, end, ...located, line: lineAt(start) };
    if (match[2] !== undefined) {
      occurrence.alias = match[2].trim();
    }
    results.push(occurrence);
  }

  const mdRe = options.includeImages
    ? /(!?)\[([^\]]*)\]\(([^)]+)\)/g
    : /(?<!!)()\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = mdRe.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (inCode(start) || wikiRanges.some(([s, e]) => start < e && end > s)) continue;
    const isImage = match[1] === '!';
    if (!isImage && !match[2]) continue;
    const targetStart = start + match[0].indexOf('](') + 2;
    const located = locateLinkPath(match[3], targetStart);
    if (!located) continue;
    results.push({
      type: isImage ? 'image' : 'markdown',
      start,
      end,
      ...located,
      label: match[2].trim(),
      line: lineAt(start),
    });
  }

  return results.sort((a, b) => a.start - b.start);
}

export interface FencedBlock {
  /** First word of the info string, lower-cased (`mermaid`, `js`, …); empty without one. */
  info: string;
  /** Start of the opening fence line and end of the closing fence line. */
  from: number;
  to: number;
  /** Range of the code between the fence lines (empty when the block has no code lines). */
  codeFrom: number;
  codeTo: number;
  code: string;
}

/**
 * Finds closed, top-level fenced code blocks. Text inside a block never starts another block,
 * and an unclosed fence (e.g. one being typed) yields no block.
 */
export function findFencedBlocks(text: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const lines = text.split('\n');
  let offset = 0;
  let open: { char: string; length: number; from: number; codeFrom: number; info: string } | undefined;

  for (const line of lines) {
    const lineEnd = offset + line.length;
    const fenceMatch = line.match(FENCE_RE);
    if (open) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === open.char &&
        fenceMatch[1].length >= open.length &&
        line.slice(fenceMatch[0].length).trim() === ''
      ) {
        const codeTo = Math.max(open.codeFrom, offset - 1);
        blocks.push({
          info: open.info,
          from: open.from,
          to: lineEnd,
          codeFrom: open.codeFrom,
          codeTo,
          code: text.slice(open.codeFrom, codeTo),
        });
        open = undefined;
      }
    } else if (fenceMatch) {
      const info = line.slice(fenceMatch[0].length).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      open = { char: fenceMatch[1][0], length: fenceMatch[1].length, from: offset, codeFrom: lineEnd + 1, info };
    }
    offset = lineEnd + 1;
  }
  return blocks;
}

/**
 * Finds a Mermaid block again after edits: the block with the same code (nearest to `line` if
 * several), otherwise the block whose opening fence is on `line` (1-based).
 */
export function locateMermaidBlock(
  text: string,
  target: { code: string; line: number }
): (FencedBlock & { line: number }) | undefined {
  const lineOf = (offset: number) => text.slice(0, offset).split('\n').length;
  const blocks = findFencedBlocks(text)
    .filter((b) => b.info === 'mermaid')
    .map((b) => ({ ...b, line: lineOf(b.from) }));
  const sameCode = blocks
    .filter((b) => b.code.trim() === target.code.trim())
    .sort((a, b) => Math.abs(a.line - target.line) - Math.abs(b.line - target.line));
  return sameCode[0] ?? blocks.find((b) => b.line === target.line);
}

/** The code of the first ```mermaid block in an AI answer, else of the first fenced block without language. */
export function extractMermaidCode(answer: string): string | undefined {
  const blocks = findFencedBlocks(answer.replace(/\r\n/g, '\n'));
  const block = blocks.find((b) => b.info === 'mermaid') ?? blocks.find((b) => b.info === '');
  const code = block?.code.trim();
  return code ? code : undefined;
}
