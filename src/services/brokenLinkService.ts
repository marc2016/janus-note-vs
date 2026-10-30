import * as vscode from 'vscode';
import * as path from 'path';
import { ExtractedLink, LinkOccurrence, findLinkOccurrences, findMarkdownNotesInRoots, resolveOutgoingLink } from './noteLinkService';
import { AliasIndex, NoteMetadataEntry, buildAliasIndex, parseFrontmatter } from './noteMetadataService';
import { ghostKeyForTarget } from './noteGraphService';
import { ApplyResult, TextEdit, applyNoteEdits, readNoteText } from './linkRewriteService';

export interface BrokenReference {
  sourceUri: vscode.Uri;
  /** 1-based line of the link. */
  line: number;
  occurrence: LinkOccurrence;
}

export interface BrokenTarget {
  /** Graph ghost key: target without `.md`, lower-cased. */
  key: string;
  /** Most frequent spelling of the target, without `.md`. */
  name: string;
  references: BrokenReference[];
}

export interface BrokenLinkScan {
  targets: BrokenTarget[];
  notes: vscode.Uri[];
  aliasIndex: AliasIndex;
}

const NOTE_EXTENSION_RE = /\.(md|markdown)$/i;

function toLink(text: string, o: LinkOccurrence, target = o.path): ExtractedLink {
  return {
    raw: text.slice(o.start, o.end),
    target,
    label: o.alias ?? o.label ?? target,
    type: o.type === 'wiki' ? 'wiki' : 'markdown',
  };
}

/**
 * Finds every note link in the collection that does not resolve, grouped by the graph's ghost
 * key and sorted by number of references. Code, external, anchor-only, folder and non-note
 * targets are not reported.
 */
export async function scanBrokenLinks(roots: vscode.Uri[], primaryRoot: vscode.Uri | undefined): Promise<BrokenLinkScan> {
  const notes = await findMarkdownNotesInRoots(roots);
  const texts = new Map<string, string>();
  const metadata: NoteMetadataEntry[] = [];
  for (const note of notes) {
    const text = await readNoteText(note);
    if (text === undefined) continue;
    texts.set(note.fsPath, text);
    const { title, aliases, tags } = parseFrontmatter(text);
    metadata.push({ uri: note, metadata: { title, aliases, tags } });
  }
  const aliasIndex = buildAliasIndex(metadata);

  const groups = new Map<string, { spellings: Map<string, number>; references: BrokenReference[] }>();
  const cache = new Map<string, Promise<boolean>>();
  for (const note of notes) {
    const text = texts.get(note.fsPath);
    if (text === undefined) continue;
    for (const occurrence of findLinkOccurrences(text)) {
      if (occurrence.path.endsWith('/')) continue;
      const key = ghostKeyForTarget(occurrence.path);
      if (key === undefined) continue;

      const cacheKey = `${path.dirname(note.fsPath)}\n${occurrence.type}\n${occurrence.path.toLowerCase()}`;
      let resolves = cache.get(cacheKey);
      if (!resolves) {
        resolves = resolveOutgoingLink(toLink(text, occurrence), note, primaryRoot, notes, aliasIndex).then(
          (r) => r.exists
        );
        cache.set(cacheKey, resolves);
      }
      if (await resolves) continue;

      let group = groups.get(key);
      if (!group) {
        group = { spellings: new Map(), references: [] };
        groups.set(key, group);
      }
      const spelling = occurrence.path.replace(/\\/g, '/').replace(NOTE_EXTENSION_RE, '');
      group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
      group.references.push({ sourceUri: note, line: occurrence.line, occurrence });
    }
  }

  const targets: BrokenTarget[] = [...groups].map(([key, group]) => {
    let name = key;
    let best = 0;
    for (const [spelling, count] of group.spellings) {
      if (count > best) {
        name = spelling;
        best = count;
      }
    }
    return { key, name, references: group.references };
  });
  targets.sort((a, b) => b.references.length - a.references.length || a.name.localeCompare(b.name));
  return { targets, notes, aliasIndex };
}

export async function findBrokenLinks(roots: vscode.Uri[], primaryRoot: vscode.Uri | undefined): Promise<BrokenTarget[]> {
  return (await scanBrokenLinks(roots, primaryRoot)).targets;
}

/** The distinct notes that reference a target, in reference order. */
export function referencingNotes(target: BrokenTarget): vscode.Uri[] {
  const seen = new Map<string, vscode.Uri>();
  for (const ref of target.references) {
    if (!seen.has(ref.sourceUri.fsPath)) seen.set(ref.sourceUri.fsPath, ref.sourceUri);
  }
  return [...seen.values()];
}

/**
 * Where "Notiz anlegen" creates the missing note: targets with a folder go below the notes root,
 * name-only targets into `folder`. Returns undefined when a name-only target has no folder yet.
 */
export function missingNoteLocation(
  target: BrokenTarget,
  primaryRoot: vscode.Uri,
  folder?: vscode.Uri
): vscode.Uri | undefined {
  const name = target.name.replace(/^\.\//, '');
  const segments = name.split('/').filter(Boolean);
  if (segments.length > 1 && !segments.includes('..')) {
    return vscode.Uri.joinPath(primaryRoot, ...segments.slice(0, -1), `${segments[segments.length - 1]}.md`);
  }
  // Name-only (or a path leaving the notes root): the user picks the folder
  return folder ? vscode.Uri.joinPath(folder, `${path.posix.basename(name)}.md`) : undefined;
}

/** Whether "Notiz anlegen" needs a folder from the user for this target. */
export function needsFolderChoice(target: BrokenTarget, primaryRoot: vscode.Uri): boolean {
  return missingNoteLocation(target, primaryRoot) === undefined;
}

/** Creates the missing note with a `# <name>` heading. */
export async function createMissingNote(noteUri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(noteUri.fsPath)));
  const title = path.basename(noteUri.fsPath).replace(NOTE_EXTENSION_RE, '');
  await vscode.workspace.fs.writeFile(noteUri, Buffer.from(`# ${title}\n\n`, 'utf-8'));
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Orders notes by how similar their file name is to `target`: exact, prefix, substring, then edit distance. */
export function rankNotesBySimilarity(target: string, notes: vscode.Uri[]): vscode.Uri[] {
  const wanted = path.posix.basename(target.replace(/\\/g, '/')).replace(NOTE_EXTENSION_RE, '').toLowerCase();
  const scored = notes.map((uri) => {
    const name = path.basename(uri.fsPath).replace(NOTE_EXTENSION_RE, '').toLowerCase();
    const tier =
      name === wanted ? 0
      : name.startsWith(wanted) || wanted.startsWith(name) ? 1
      : name.includes(wanted) || wanted.includes(name) ? 2
      : 3;
    return { uri, tier, distance: editDistance(name, wanted) };
  });
  scored.sort((a, b) => a.tier - b.tier || a.distance - b.distance || a.uri.fsPath.localeCompare(b.uri.fsPath));
  return scored.map((s) => s.uri);
}

/** Groups a target's references by note: note path -> broken link paths in that note. */
function brokenPathsByNote(target: BrokenTarget): Map<string, Set<string>> {
  const byNote = new Map<string, Set<string>>();
  for (const ref of target.references) {
    let paths = byNote.get(ref.sourceUri.fsPath);
    if (!paths) {
      paths = new Set();
      byNote.set(ref.sourceUri.fsPath, paths);
    }
    paths.add(ref.occurrence.path);
  }
  return byNote;
}

function sameFile(a: string, b: string): boolean {
  return path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase();
}

/**
 * Candidate link paths pointing from `sourceFsPath` to `noteFsPath`, preferred first:
 * wiki-links use the file name when it is unique, then the notes-root-relative path;
 * Markdown links use the path relative to the source note.
 */
function retargetCandidates(
  type: LinkOccurrence['type'],
  sourceFsPath: string,
  noteFsPath: string,
  notes: vscode.Uri[],
  primaryRoot: vscode.Uri | undefined
): string[] {
  if (type !== 'wiki') {
    return [path.relative(path.dirname(sourceFsPath), noteFsPath).split(path.sep).join('/')];
  }
  const baseName = path.basename(noteFsPath).replace(NOTE_EXTENSION_RE, '');
  const candidates: string[] = [];
  const sameName = notes.filter(
    (n) => path.basename(n.fsPath).replace(NOTE_EXTENSION_RE, '').toLowerCase() === baseName.toLowerCase()
  );
  if (sameName.length === 1) candidates.push(baseName);
  if (primaryRoot) {
    const rel = path.relative(primaryRoot.fsPath, noteFsPath);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      candidates.push(rel.split(path.sep).join('/').replace(NOTE_EXTENSION_RE, ''));
    }
  }
  candidates.push(path.relative(path.dirname(sourceFsPath), noteFsPath).split(path.sep).join('/').replace(NOTE_EXTENSION_RE, ''));
  return candidates;
}

/**
 * Points every reference of `target` to `noteUri`. Each new path is checked with the link
 * resolver; references without a path that resolves to the note are skipped.
 */
export async function retargetBrokenLinks(
  target: BrokenTarget,
  noteUri: vscode.Uri,
  scan: Pick<BrokenLinkScan, 'notes' | 'aliasIndex'>,
  primaryRoot: vscode.Uri | undefined
): Promise<{ result: ApplyResult; skipped: number }> {
  // note path -> (link type + original path) -> new path
  const plan = new Map<string, Map<string, string>>();
  let skipped = 0;
  for (const ref of target.references) {
    const source = ref.sourceUri.fsPath;
    const key = `${ref.occurrence.type}\n${ref.occurrence.path}`;
    let rewrites = plan.get(source);
    if (!rewrites) {
      rewrites = new Map();
      plan.set(source, rewrites);
    }
    if (rewrites.has(key)) continue;

    let chosen: string | undefined;
    for (const candidate of retargetCandidates(ref.occurrence.type, source, noteUri.fsPath, scan.notes, primaryRoot)) {
      const resolved = await resolveOutgoingLink(
        toLink('', ref.occurrence, candidate),
        ref.sourceUri,
        primaryRoot,
        scan.notes,
        scan.aliasIndex
      );
      if (resolved.exists && sameFile(vscode.Uri.parse(resolved.uri).fsPath, noteUri.fsPath)) {
        chosen = candidate;
        break;
      }
    }
    if (chosen === undefined) {
      skipped++;
      continue;
    }
    rewrites.set(key, chosen);
  }

  const result = await applyNoteEdits(
    [...plan].map(([fsPath, rewrites]) => ({
      fsPath,
      edits: (text: string): TextEdit[] =>
        findLinkOccurrences(text)
          .filter((o) => rewrites.has(`${o.type}\n${o.path}`))
          .map((o) => ({ start: o.pathStart, end: o.pathEnd, text: rewrites.get(`${o.type}\n${o.path}`)! })),
    }))
  );
  return { result, skipped };
}

/** Visible text that replaces a removed link: wiki alias or target, Markdown label. */
export function plainLinkText(o: LinkOccurrence): string {
  if (o.type === 'wiki') return o.alias ?? o.path;
  return o.label ?? o.path;
}

/** Replaces every reference of `target` with its visible text. */
export function removeBrokenLinks(target: BrokenTarget): Promise<ApplyResult> {
  return applyNoteEdits(
    [...brokenPathsByNote(target)].map(([fsPath, paths]) => ({
      fsPath,
      edits: (text: string): TextEdit[] =>
        findLinkOccurrences(text)
          .filter((o) => paths.has(o.path) && ghostKeyForTarget(o.path) === target.key)
          .map((o) => ({ start: o.start, end: o.end, text: plainLinkText(o) })),
    }))
  );
}
