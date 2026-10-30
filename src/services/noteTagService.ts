import * as vscode from 'vscode';
import { findMarkdownNotesInRoots } from './noteLinkService';
import { NoteMetadata, NoteMetadataEntry, getNotesMetadata } from './noteMetadataService';

export interface TagInfo {
  /** Most frequent spelling across the collection (alphabetically first on a tie). */
  display: string;
  /** Notes that have this exact tag (case-insensitive). */
  notes: vscode.Uri[];
}

export interface TagIndex {
  /** Lower-cased tag -> info, for every tag that occurs in a note. */
  tags: Map<string, TagInfo>;
  /** Notes carrying `tag`: the tag itself or any `tag/…` child, in scan order. */
  notesWithTag(tag: string): vscode.Uri[];
  /** Lower-cased tags of a note, with parents of nested tags (`projekt/alpha` -> `projekt`). */
  tagsOf(uri: vscode.Uri): string[];
}

/** A note's tags: frontmatter and inline tags, case-insensitively unique, first spelling kept. */
export function noteTags(metadata: NoteMetadata): string[] {
  const seen = new Map<string, string>();
  for (const tag of [...metadata.tags, ...(metadata.inlineTags ?? [])]) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) seen.set(key, tag);
  }
  return [...seen.values()];
}

/** Lower-cased tags plus all parents of nested tags. */
export function expandTags(tags: string[]): string[] {
  const expanded = new Set<string>();
  for (const tag of tags) {
    const parts = tag.toLowerCase().split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) expanded.add(parts.slice(0, i).join('/'));
  }
  return [...expanded];
}

export function buildTagIndex(entries: NoteMetadataEntry[]): TagIndex {
  const spellings = new Map<string, Map<string, number>>();
  const notesByTag = new Map<string, vscode.Uri[]>();
  const expandedByNote = new Map<string, string[]>();

  for (const { uri, metadata } of entries) {
    const tags = noteTags(metadata);
    expandedByNote.set(uri.toString(), expandTags(tags));
    for (const tag of tags) {
      const key = tag.toLowerCase();
      if (!spellings.has(key)) spellings.set(key, new Map());
      const counts = spellings.get(key)!;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
      if (!notesByTag.has(key)) notesByTag.set(key, []);
      notesByTag.get(key)!.push(uri);
    }
  }

  const tags = new Map<string, TagInfo>();
  for (const [key, counts] of spellings) {
    const display = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    tags.set(key, { display, notes: notesByTag.get(key)! });
  }

  return {
    tags,
    notesWithTag: (tag) => {
      const key = tag.toLowerCase().replace(/^#/, '');
      return entries.filter((e) => expandedByNote.get(e.uri.toString())!.includes(key)).map((e) => e.uri);
    },
    tagsOf: (uri) => expandedByNote.get(uri.toString()) ?? [],
  };
}

/** Tag index over all notes under `roots`; unchanged notes come from the metadata cache. */
export async function getTagIndex(roots: vscode.Uri[]): Promise<TagIndex> {
  return buildTagIndex(await getNotesMetadata(await findMarkdownNotesInRoots(roots)));
}
