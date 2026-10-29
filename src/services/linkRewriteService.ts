import * as vscode from 'vscode';
import * as path from 'path';
import { findLinkOccurrences, findMarkdownNotesInRoots } from './noteLinkService';

/** Which candidate of the link resolver matched (see `resolveOutgoingLink`). */
export type ResolutionBase = 'source' | 'root' | 'workspace' | 'basename';

export interface NoteIndex {
  /** Note paths in scan order (the order the basename match walks). */
  notes: string[];
  byLowerPath: Map<string, string>;
}

export interface ResolveEnv {
  primaryRoot?: string;
  workspaceFolderOf: (fsPath: string) => string | undefined;
}

export interface RenameOperation {
  oldPath: string;
  newPath: string;
  isFolder: boolean;
}

export interface NoteSource {
  fsPath: string;
  text: string;
}

export interface FileRewrite {
  oldFsPath: string;
  newFsPath: string;
  /** Original link path -> rewritten link path. */
  rewrites: Map<string, string>;
}

export interface RenamePlan {
  files: FileRewrite[];
  /** Affected links that could not be rewritten to resolve to the renamed note. */
  skipped: number;
}

export interface ApplyResult {
  updatedLinks: number;
  updatedNotes: number;
  failedNotes: string[];
}

const NOTE_EXTENSION_RE = /\.(md|markdown)$/i;

function stripNoteExtension(name: string): string {
  return name.replace(NOTE_EXTENSION_RE, '');
}

function ensureNoteExtension(target: string): string {
  return /\.[a-z0-9]+$/i.test(target) ? target : `${target}.md`;
}

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

function samePath(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function isInside(fsPath: string, folder: string): boolean {
  const rel = path.relative(folder.toLowerCase(), fsPath.toLowerCase());
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Sorts paths like `findMarkdownNotesInRoots` returns them: per root, depth-first by name. */
function sortLikeScan(paths: string[], roots: string[]): string[] {
  const rootIndex = (p: string) => {
    const idx = roots.findIndex((r) => isInside(p, r));
    return idx === -1 ? roots.length : idx;
  };
  return [...paths].sort((a, b) => {
    const ra = rootIndex(a);
    const rb = rootIndex(b);
    if (ra !== rb) return ra - rb;
    const base = roots[ra] ?? '';
    const sa = path.relative(base, a).split(path.sep);
    const sb = path.relative(base, b).split(path.sep);
    for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
      const cmp = sa[i].localeCompare(sb[i]);
      if (cmp !== 0) return cmp;
    }
    return sa.length - sb.length;
  });
}

export function createNoteIndex(notes: string[]): NoteIndex {
  const byLowerPath = new Map<string, string>();
  for (const note of notes) {
    byLowerPath.set(note.toLowerCase(), note);
  }
  return { notes, byLowerPath };
}

/**
 * Resolves a link path to a note of `index`, in the same candidate order as
 * `resolveOutgoingLink`, and reports which candidate matched.
 */
export function resolveNotePath(
  linkPath: string,
  sourceFsPath: string,
  index: NoteIndex,
  env: ResolveEnv
): { fsPath: string; base: ResolutionBase } | undefined {
  const normalized = ensureNoteExtension(linkPath.replace(/^\.\//, ''));
  const lookup = (candidate: string) => index.byLowerPath.get(candidate.toLowerCase());

  const fromSource = lookup(path.resolve(path.dirname(sourceFsPath), normalized));
  if (fromSource) return { fsPath: fromSource, base: 'source' };

  if (env.primaryRoot) {
    const fromRoot = lookup(path.resolve(env.primaryRoot, normalized));
    if (fromRoot) return { fsPath: fromRoot, base: 'root' };
  }

  const wsFolder = env.workspaceFolderOf(sourceFsPath);
  if (wsFolder) {
    const fromWs = lookup(path.resolve(wsFolder, normalized));
    if (fromWs) return { fsPath: fromWs, base: 'workspace' };
  }

  const baseLower = stripNoteExtension(path.basename(normalized)).toLowerCase();
  const byName = index.notes.find((n) => stripNoteExtension(path.basename(n)).toLowerCase() === baseLower);
  if (byName) return { fsPath: byName, base: 'basename' };

  return undefined;
}

/** Maps a path to its location after `op`; paths outside the renamed item are returned unchanged. */
export function mapRenamedPath(fsPath: string, op: RenameOperation): string {
  if (samePath(fsPath, op.oldPath)) return op.newPath;
  if (op.isFolder && isInside(fsPath, op.oldPath)) {
    // Case may differ on case-insensitive file systems, the length does not
    return path.join(op.newPath, fsPath.slice(op.oldPath.length + 1));
  }
  return fsPath;
}

function isAffected(fsPath: string, op: RenameOperation): boolean {
  return samePath(fsPath, op.oldPath) || (op.isFolder && isInside(fsPath, op.oldPath));
}

/**
 * Shapes a computed path like the original link path: `/` separators, `.md` extension
 * only if the original had one, and the original basename spelling if the name is unchanged.
 */
function shapeLikeOriginal(computed: string, originalPath: string): string {
  let result = toPosix(computed);
  if (!NOTE_EXTENSION_RE.test(originalPath)) {
    result = stripNoteExtension(result);
  }
  const originalName = path.posix.basename(toPosix(originalPath));
  const resultName = path.posix.basename(result);
  if (originalName !== resultName && stripNoteExtension(originalName).toLowerCase() === stripNoteExtension(resultName).toLowerCase()) {
    result = result.slice(0, result.length - resultName.length) + originalName;
  }
  return result;
}

export interface RewriteContext {
  newSourceFsPath: string;
  newTargetFsPath: string;
  isFolderRename: boolean;
  primaryRoot?: string;
  workspaceFolder?: string;
}

/**
 * Builds the new path for a link that resolved against `base`, keeping the link's form.
 * Returns undefined if the base directory is unknown.
 */
export function computeRewrittenPath(
  originalPath: string,
  base: ResolutionBase,
  ctx: RewriteContext
): string | undefined {
  if (base === 'basename') {
    if (ctx.isFolderRename) return originalPath;
    const posixOriginal = toPosix(originalPath);
    const dir = posixOriginal.includes('/') ? posixOriginal.slice(0, posixOriginal.lastIndexOf('/') + 1) : '';
    return dir + shapeLikeOriginal(path.basename(ctx.newTargetFsPath), originalPath);
  }

  const baseDir =
    base === 'source' ? path.dirname(ctx.newSourceFsPath) : base === 'root' ? ctx.primaryRoot : ctx.workspaceFolder;
  if (!baseDir) return undefined;

  let rel = toPosix(path.relative(baseDir, ctx.newTargetFsPath));
  if (originalPath.startsWith('./') && !rel.startsWith('../')) {
    rel = `./${rel}`;
  }
  return shapeLikeOriginal(rel, originalPath);
}

/** Notes-root-relative (or workspace-relative) path form, used when the form-preserving rewrite is ambiguous. */
function fallbackPath(originalPath: string, ctx: RewriteContext): string | undefined {
  for (const baseDir of [ctx.primaryRoot, ctx.workspaceFolder]) {
    if (!baseDir) continue;
    const rel = path.relative(baseDir, ctx.newTargetFsPath);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return shapeLikeOriginal(rel, originalPath);
    }
  }
  return undefined;
}

/**
 * Plans the link rewrites for renaming a note or folder. `sources` must contain every note
 * of the collection with its text before the rename, in scan order.
 */
export function buildRenamePlan(
  sources: NoteSource[],
  op: RenameOperation,
  env: ResolveEnv & { roots: string[] }
): RenamePlan {
  const before = createNoteIndex(sources.map((s) => s.fsPath));
  const after = createNoteIndex(sortLikeScan(sources.map((s) => mapRenamedPath(s.fsPath, op)), env.roots));
  const files: FileRewrite[] = [];
  let skipped = 0;

  for (const source of sources) {
    const newSourceFsPath = mapRenamedPath(source.fsPath, op);
    const rewrites = new Map<string, string>();
    const seen = new Set<string>();

    for (const occurrence of findLinkOccurrences(source.text)) {
      if (seen.has(occurrence.path)) continue;
      seen.add(occurrence.path);

      const resolved = resolveNotePath(occurrence.path, source.fsPath, before, env);
      if (!resolved || !isAffected(resolved.fsPath, op)) continue;

      const ctx: RewriteContext = {
        newSourceFsPath,
        newTargetFsPath: mapRenamedPath(resolved.fsPath, op),
        isFolderRename: op.isFolder,
        primaryRoot: env.primaryRoot,
        workspaceFolder: env.workspaceFolderOf(newSourceFsPath),
      };
      const resolvesToTarget = (candidate: string | undefined) => {
        if (candidate === undefined) return false;
        const result = resolveNotePath(candidate, newSourceFsPath, after, env);
        return !!result && samePath(result.fsPath, ctx.newTargetFsPath);
      };

      const candidate = computeRewrittenPath(occurrence.path, resolved.base, ctx);
      const fallback = fallbackPath(occurrence.path, ctx);
      const finalPath = resolvesToTarget(candidate) ? candidate : resolvesToTarget(fallback) ? fallback : undefined;

      if (finalPath === undefined) {
        skipped++;
      } else if (finalPath !== occurrence.path) {
        rewrites.set(occurrence.path, finalPath);
      }
    }

    if (rewrites.size > 0) {
      files.push({ oldFsPath: source.fsPath, newFsPath: newSourceFsPath, rewrites });
    }
  }

  return { files, skipped };
}

/** Replaces the planned link paths in `text`. Returns the new text and the number of replaced links. */
export function applyRewritesToText(text: string, rewrites: Map<string, string>): { text: string; count: number } {
  const occurrences = findLinkOccurrences(text).filter((o) => rewrites.has(o.path));
  let result = text;
  for (const o of [...occurrences].reverse()) {
    result = result.slice(0, o.pathStart) + rewrites.get(o.path)! + result.slice(o.pathEnd);
  }
  return { text: result, count: occurrences.length };
}

function findOpenDocument(fsPath: string): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find((d) => d.uri.fsPath === fsPath);
}

async function readNoteText(uri: vscode.Uri): Promise<string | undefined> {
  const doc = findOpenDocument(uri.fsPath);
  if (doc) return doc.getText();
  try {
    return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Reads all notes of the collection and plans the link rewrites for `op`.
 * Must run before the rename, while the old paths still exist.
 */
export async function planLinkUpdatesForRename(
  op: RenameOperation,
  roots: vscode.Uri[],
  primaryRoot: vscode.Uri | undefined
): Promise<RenamePlan> {
  const notes = await findMarkdownNotesInRoots(roots);
  const sources: NoteSource[] = [];
  for (const note of notes) {
    const text = await readNoteText(note);
    if (text !== undefined) {
      sources.push({ fsPath: note.fsPath, text });
    }
  }

  return buildRenamePlan(sources, op, {
    primaryRoot: primaryRoot?.fsPath,
    roots: roots.map((r) => r.fsPath),
    workspaceFolderOf: (fsPath) => vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath))?.uri.fsPath,
  });
}

/**
 * Applies a rename plan after the rename. Each note is re-read and re-scanned, so edits stay
 * correct if it changed since planning. Open documents get document edits (unsaved changes
 * are kept; documents that were not dirty are saved), other notes are written directly.
 */
export async function applyLinkRewritePlan(plan: RenamePlan): Promise<ApplyResult> {
  const result: ApplyResult = { updatedLinks: 0, updatedNotes: 0, failedNotes: [] };
  const edit = new vscode.WorkspaceEdit();
  const openDocs: Array<{ doc: vscode.TextDocument; count: number; wasDirty: boolean }> = [];

  for (const file of plan.files) {
    const uri = vscode.Uri.file(file.newFsPath);
    const doc = findOpenDocument(file.newFsPath);

    if (doc) {
      const text = doc.getText();
      const occurrences = findLinkOccurrences(text).filter((o) => file.rewrites.has(o.path));
      if (occurrences.length === 0) continue;
      for (const o of occurrences) {
        edit.replace(doc.uri, new vscode.Range(doc.positionAt(o.pathStart), doc.positionAt(o.pathEnd)), file.rewrites.get(o.path)!);
      }
      openDocs.push({ doc, count: occurrences.length, wasDirty: doc.isDirty });
      continue;
    }

    try {
      const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
      const updated = applyRewritesToText(text, file.rewrites);
      if (updated.count === 0) continue;
      await vscode.workspace.fs.writeFile(uri, Buffer.from(updated.text, 'utf-8'));
      result.updatedLinks += updated.count;
      result.updatedNotes++;
    } catch {
      result.failedNotes.push(path.basename(file.newFsPath));
    }
  }

  if (openDocs.length > 0) {
    const applied = await vscode.workspace.applyEdit(edit);
    for (const { doc, count, wasDirty } of openDocs) {
      if (!applied) {
        result.failedNotes.push(path.basename(doc.uri.fsPath));
        continue;
      }
      result.updatedLinks += count;
      result.updatedNotes++;
      if (!wasDirty) {
        await doc.save();
      }
    }
  }

  return result;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Informs the user about rewritten, skipped and failed links. Shows nothing if nothing happened. */
export function reportLinkUpdates(result: ApplyResult, skipped: number): void {
  const parts: string[] = [];
  if (result.updatedLinks > 0) {
    parts.push(
      `${plural(result.updatedLinks, 'Link', 'Links')} in ${plural(result.updatedNotes, 'Notiz', 'Notizen')} aktualisiert.`
    );
  }
  if (skipped > 0) {
    parts.push(`${plural(skipped, 'Link konnte', 'Links konnten')} nicht automatisch angepasst werden.`);
  }
  if (parts.length > 0) {
    void vscode.window.showInformationMessage(parts.join(' '));
  }
  if (result.failedNotes.length > 0) {
    void vscode.window.showWarningMessage(
      `Links in folgenden Notizen konnten nicht aktualisiert werden: ${result.failedNotes.join(', ')}`
    );
  }
}
