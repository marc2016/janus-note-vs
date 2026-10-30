import * as vscode from 'vscode';
import { findInlineTags } from './markdownScan';

export interface NoteMetadata {
  title?: string;
  aliases: string[];
  /** Tags from the frontmatter `tags` key. */
  tags: string[];
  /** Inline `#tags` of the note body (filled by `getNotesMetadata`). */
  inlineTags?: string[];
}

export interface NoteFrontmatter extends NoteMetadata {
  /** Offset of the first character after the frontmatter block (0 without frontmatter). */
  bodyStart: number;
}

export interface NoteMetadataEntry {
  uri: vscode.Uri;
  metadata: NoteMetadata;
}

/** Lower-cased alias -> note, first note in scan order wins. */
export type AliasIndex = Map<string, vscode.Uri>;

const KEY_RE = /^([A-Za-z_][\w-]*)\s*:(.*)$/;
const BLOCK_ITEM_RE = /^\s+-\s+(.*)$|^-\s+(.*)$/;

function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = trimmed.match(/^"(.*)"$/) || trimmed.match(/^'(.*)'$/);
  return quoted ? quoted[1] : trimmed;
}

/** Drops a trailing YAML comment (` # ...`) from an unquoted value. */
function stripComment(value: string): string {
  const trimmed = value.trim();
  if (/^["']/.test(trimmed)) return trimmed;
  return trimmed.replace(/\s+#.*$/, '').trim();
}

/** Splits an inline list body (`a, "b, c", 'd'`) at commas outside quotes. */
function splitInlineList(body: string): string[] {
  const items: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const char of body) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ',') {
      items.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  items.push(current);
  return items.map(unquote).filter(Boolean);
}

const EMPTY: NoteFrontmatter = { aliases: [], tags: [], bodyStart: 0 };

/**
 * Reads `title`, `aliases`/`alias` and `tags`/`tag` from a note's YAML frontmatter block.
 * Only the forms Janus needs are supported: scalars, quoted strings, inline and block lists.
 * A missing or malformed block yields empty metadata.
 */
export function parseFrontmatter(text: string): NoteFrontmatter {
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const lines: Array<{ text: string; end: number }> = [];
  let offset = start;
  while (offset <= text.length) {
    const newline = text.indexOf('\n', offset);
    const end = newline === -1 ? text.length : newline + 1;
    lines.push({ text: text.slice(offset, newline === -1 ? text.length : newline).replace(/\r$/, ''), end });
    if (newline === -1) break;
    offset = end;
  }

  if (lines.length === 0 || lines[0].text !== '---') return { ...EMPTY };
  const closeIndex = lines.findIndex((line, i) => i > 0 && (line.text === '---' || line.text === '...'));
  if (closeIndex === -1) return { ...EMPTY };

  const result: NoteFrontmatter = { aliases: [], tags: [], bodyStart: lines[closeIndex].end };
  const block = lines.slice(1, closeIndex).map((l) => l.text);

  for (let i = 0; i < block.length; i++) {
    const keyMatch = block[i].match(KEY_RE);
    if (!keyMatch) continue;
    const key = keyMatch[1].toLowerCase();
    if (!['title', 'alias', 'aliases', 'tag', 'tags'].includes(key)) continue;

    const rawValue = stripComment(keyMatch[2]);
    let values: string[];
    let isList = false;
    if (rawValue === '') {
      values = [];
      while (i + 1 < block.length) {
        const item = block[i + 1].match(BLOCK_ITEM_RE);
        if (!item) break;
        values.push(unquote(stripComment(item[1] ?? item[2])));
        i++;
      }
      isList = true;
    } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      values = splitInlineList(rawValue.slice(1, -1));
      isList = true;
    } else {
      values = [unquote(rawValue)];
    }
    values = values.filter(Boolean);

    if (key === 'title') {
      if (!isList && values[0]) result.title = values[0];
    } else if (key === 'alias' || key === 'aliases') {
      result.aliases.push(...values);
    } else {
      const tags = isList ? values : values.flatMap((v) => v.split(/[,\s]+/));
      result.tags.push(...tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean));
    }
  }

  return result;
}

const metadataCache = new Map<string, { mtime: number; metadata: NoteMetadata }>();

/** Clears the metadata cache (tests and configuration changes). */
export function clearNoteMetadataCache(): void {
  metadataCache.clear();
}

/**
 * Returns the frontmatter metadata of `uris` in the given order. Notes whose modification
 * time is unchanged are served from the cache; missing notes are skipped and evicted.
 */
export async function getNotesMetadata(uris: vscode.Uri[]): Promise<NoteMetadataEntry[]> {
  const entries: NoteMetadataEntry[] = [];
  for (const uri of uris) {
    let mtime: number | undefined;
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      mtime = typeof stat?.mtime === 'number' ? stat.mtime : undefined;
    } catch {
      metadataCache.delete(uri.fsPath);
      continue;
    }

    const cached = metadataCache.get(uri.fsPath);
    if (cached && mtime !== undefined && cached.mtime === mtime) {
      entries.push({ uri, metadata: cached.metadata });
      continue;
    }

    let text: string;
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
    } catch {
      metadataCache.delete(uri.fsPath);
      continue;
    }
    const { title, aliases, tags, bodyStart } = parseFrontmatter(text);
    const inlineTags = findInlineTags(text, { bodyStart }).map((t) => t.tag);
    const metadata: NoteMetadata = { title, aliases, tags, inlineTags };
    if (mtime !== undefined) {
      metadataCache.set(uri.fsPath, { mtime, metadata });
    }
    entries.push({ uri, metadata });
  }
  return entries;
}

/** Builds the alias lookup; the first note in `entries` order wins for duplicate aliases. */
export function buildAliasIndex(entries: NoteMetadataEntry[]): AliasIndex {
  const index: AliasIndex = new Map();
  for (const { uri, metadata } of entries) {
    for (const alias of metadata.aliases) {
      const key = alias.toLowerCase();
      if (!index.has(key)) index.set(key, uri);
    }
  }
  return index;
}
