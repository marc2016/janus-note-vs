// Pure scanner for `-> [[target]]` lines in daily notes, without editor or `vscode` imports,
// shared by the sorter, the editor host and the webview.

/** A line that marks a daily note block as sorted: `-> [[target]]`. */
export const SORTED_LINK_RE = /^->\s*\[\[([^\]\n]+)\]\]\s*$/;

const FENCE_RE = /^\s*(```|~~~)/;
const BLOCK_HEADING_RE = /^#{2,6}\s+(.+?)\s*$/;

export interface SortedLinkLine {
  /** 0-based line of the link line. */
  line: number;
  /** Link target as written, e.g. `projects/App-Launch/app-launch`. */
  target: string;
  /** Heading text of the block the link belongs to, without `#`. */
  heading?: string;
  /** 0-based line of that heading. */
  headingLine?: number;
  /** Nearest non-blank line above the link line; it was copied verbatim into the target. */
  anchorText?: string;
}

export function findSortedLinks(text: string): SortedLinkLine[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result: SortedLinkLine[] = [];
  let openFence: string | null = null;
  let heading: { text: string; line: number } | undefined;
  let lastContent: string | undefined;

  lines.forEach((line, i) => {
    const fence = line.match(FENCE_RE);
    if (openFence) {
      if (fence && fence[1] === openFence) openFence = null;
      lastContent = line.trim() ? line : lastContent;
      return;
    }
    if (fence) {
      openFence = fence[1];
      lastContent = line;
      return;
    }

    const link = line.trim().match(SORTED_LINK_RE);
    if (link) {
      result.push({
        line: i,
        target: link[1].split('|')[0].trim(),
        heading: heading?.text,
        headingLine: heading?.line,
        anchorText: lastContent?.trim(),
      });
      return;
    }

    const headingMatch = line.match(BLOCK_HEADING_RE);
    if (headingMatch) {
      heading = { text: headingMatch[1], line: i };
    } else if (/^#\s+/.test(line)) {
      heading = undefined;
    }
    if (line.trim()) {
      lastContent = line;
    }
  });

  return result;
}
