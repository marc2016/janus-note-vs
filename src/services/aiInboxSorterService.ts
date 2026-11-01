import * as vscode from 'vscode';
import * as path from 'path';
import { z } from 'zod';
import { AiModelService } from './aiModelService';
import { CompanionManager } from '../companion/companionManager';
import { findLinkOccurrences, findMarkdownNotesInRoot } from './noteLinkService';
import {
  DEFAULT_ROOT_FOLDERS,
  DefaultRootFolder,
  formatRelativePathWithLocalizedRoot,
  getLocalizedRootFolderLabel,
} from '../commands/notesRootCommands';
import { DAILY_NOTES_FOLDER, isDailyNotePath } from './dailyNotePaths';
import { SORTED_LINK_RE } from './sortedLinkScan';
import { InboxSortUndoRecord, writeNoteText } from './inboxSortUndo';
import { AiTaskGeneratorService, SortedBlockForTasks } from './aiTaskGeneratorService';

const RawInboxSortItemSchema = z.object({
  block: z.coerce.number().int().positive(),
  title: z.string().optional(),
  action: z.enum(['append', 'create']).optional().default('append'),
  targetRelativePath: z.string().min(1),
});

const RawInboxSortResponseSchema = z.union([
  z.object({
    items: z.array(z.unknown()),
  }),
  z.array(z.unknown()),
]);

/** A deterministic slice of inbox.md; `index` is 1-based and used to reference it in the AI prompt. */
export interface InboxBlock {
  index: number;
  text: string;
  heading?: string;
  /** 0-based line of the block's first and last non-blank line, relative to the split body. */
  startLine?: number;
  endLine?: number;
}

export interface InboxSortProposal {
  block: InboxBlock;
  title: string;
  action: 'append' | 'create';
  targetRelativePath: string;
}

export interface ExecutedInboxSortItem extends InboxSortProposal {
  targetUri: vscode.Uri;
  effectiveAction: 'append' | 'create';
}

export interface SortInboxResult {
  /** The sorted note: `inbox.md` or a daily note. */
  inboxUri: vscode.Uri;
  source: 'inbox' | 'daily';
  sortedItems: ExecutedInboxSortItem[];
  /** Blocks the AI model did not assign to a valid target. */
  unassignedBlocks: InboxBlock[];
  /** Selected proposals that were not executed because their block changed during sorting. */
  skippedChanged: InboxSortProposal[];
  /** Blocks left in inbox.md after sorting, or blocks of a daily note still without a link. */
  remainingBlockCount: number;
  skippedEmpty?: boolean;
  cancelled?: boolean;
  /** What this run changed; set only when at least one block was written. */
  undo?: InboxSortUndoRecord;
  /** Number of tasks extracted from the written blocks. */
  createdTasks?: number;
  /** Error message when task extraction was requested but failed; the blocks stay written. */
  taskExtractionFailed?: string;
}

export interface NoteOutline {
  relativePath: string;
  title?: string;
  headings: string[];
}

const DEFAULT_INBOX_WELCOME_FIRST_LINE = 'Willkommen in deinen Janus Notes!';

export const MAX_NOTES_WITH_OUTLINE = 200;
const MAX_HEADINGS_PER_NOTE = 10;
const MAX_HEADING_LENGTH = 80;
const MAX_BLOCK_PROMPT_CHARS = 2000;

const FENCE_RE = /^\s*(```|~~~)/;
const BLOCK_HEADING_RE = /^#{2,6}\s+(.+?)\s*$/;
const SORT_TIMESTAMP_SUFFIX_RE = /\s*\(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?\)\s*$/;

function isJournalPath(relativePath: string): boolean {
  return relativePath.replace(/\\/g, '/').split('/')[0].toLowerCase() === DAILY_NOTES_FOLDER;
}

function mapSegmentToCanonicalRootFolder(segment: string): DefaultRootFolder | null {
  const lower = segment.trim().toLowerCase();
  if (
    lower === 'meetings' ||
    lower === 'meeting' ||
    lower === 'general meetings' ||
    lower === 'general-meetings' ||
    lower === 'allgemeine meetings' ||
    lower === 'allgemeine-meetings' ||
    lower === 'besprechungen' ||
    lower === 'termine'
  ) {
    return 'meetings';
  }
  if (
    lower === 'projects' ||
    lower === 'project' ||
    lower === 'projekte' ||
    lower === 'projekt'
  ) {
    return 'projects';
  }
  if (
    lower === 'knowledge' ||
    lower === 'knowledge base' ||
    lower === 'knowledge-base' ||
    lower === 'wissensbasis' ||
    lower === 'wissen' ||
    lower === 'notizen' ||
    lower === 'notes' ||
    lower === 'ideen' ||
    lower === 'ideas' ||
    lower === 'wiki' ||
    lower === 'docs'
  ) {
    return 'knowledge';
  }
  return null;
}

/**
 * Normalizes and validates a relative Markdown path inside notesRoot.
 * Enforces that every sorted note path starts with one of the three canonical internal
 * English root folders (`meetings/`, `projects/`, `knowledge/`) and rejects path traversal ('..')
 * or pointing back to root 'inbox.md'.
 */
export function sanitizeRelativeNotePath(rawPath: string): string | null {
  const normalized = rawPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/|\/)+/, '')
    .replace(/\/+/g, '/');

  if (!normalized) {
    return null;
  }

  const segments = normalized.split('/').filter((s) => s.length > 0);
  if (segments.length === 0 || segments.some((seg) => seg === '.' || seg === '..')) {
    return null;
  }

  const lastIdx = segments.length - 1;
  if (!/\.(md|markdown)$/i.test(segments[lastIdx])) {
    segments[lastIdx] = `${segments[lastIdx]}.md`;
  }

  if (segments.length === 1 && segments[0].toLowerCase() === 'inbox.md') {
    return null;
  }

  // Daily notes are never sort targets
  if (segments[0].toLowerCase() === DAILY_NOTES_FOLDER) {
    return null;
  }

  const mappedRoot = mapSegmentToCanonicalRootFolder(segments[0]);
  if (mappedRoot) {
    if (segments.length === 1) {
      // e.g. someone passed "meetings" -> "meetings.md"
      return null;
    }
    segments[0] = mappedRoot;
  } else {
    // Enforce canonical root category guardrail:
    // If a subfolder was given (e.g. "App-Launch/todo.md"), place it under "projects/App-Launch/todo.md";
    // if only a bare filename was given (e.g. "note.md"), place it under "knowledge/note.md".
    if (segments.length > 1) {
      segments.unshift('projects');
    } else {
      segments.unshift('knowledge');
    }
  }

  const result = segments.join('/');
  if (result.toLowerCase() === 'inbox.md') {
    return null;
  }

  return result;
}

/**
 * Extracts actionable user content from inbox.md by stripping the leading `# Inbox` heading
 * and the default welcome paragraph (any paragraph starting with the welcome line).
 */
export function extractMeaningfulInboxBody(rawInboxText: string): string {
  const body = rawInboxText
    .replace(/\r\n/g, '\n')
    .replace(/^\s*#\s+Inbox\b[^\n]*\n?/i, '')
    .trimStart();
  if (!body.startsWith(DEFAULT_INBOX_WELCOME_FIRST_LINE)) {
    return body.trim();
  }
  const paragraphEnd = body.search(/\n[ \t]*\n/);
  return paragraphEnd === -1 ? '' : body.slice(paragraphEnd).trim();
}

/** Marks every line that lies inside a fenced code block (including the fence lines). */
function markFencedLines(lines: string[]): boolean[] {
  const fenced: boolean[] = [];
  let openFence: string | null = null;
  for (const line of lines) {
    const match = line.match(FENCE_RE);
    if (openFence) {
      fenced.push(true);
      if (match && match[1] === openFence) {
        openFence = null;
      }
    } else if (match) {
      fenced.push(true);
      openFence = match[1];
    } else {
      fenced.push(false);
    }
  }
  return fenced;
}

/**
 * Splits the inbox body into blocks without the AI model. If any `##`–`######` heading exists
 * outside fenced code, every such heading starts a block (text before the first one is its own
 * block); otherwise blank-line-separated paragraphs form the blocks.
 */
export function splitInboxBlocks(body: string): InboxBlock[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const fenced = markFencedLines(lines);
  const headingMode = lines.some((line, i) => !fenced[i] && BLOCK_HEADING_RE.test(line));

  const chunks: number[][] = [];
  let current: number[] = [];
  const flush = () => {
    if (current.length > 0) {
      chunks.push(current);
    }
    current = [];
  };

  lines.forEach((line, i) => {
    if (headingMode) {
      if (!fenced[i] && BLOCK_HEADING_RE.test(line)) {
        flush();
      }
      current.push(i);
    } else if (!fenced[i] && line.trim() === '') {
      flush();
    } else {
      current.push(i);
    }
  });
  flush();

  const blocks: InboxBlock[] = [];
  for (const chunk of chunks) {
    const contentLines = chunk.filter((i) => lines[i].trim() !== '');
    if (contentLines.length === 0) {
      continue;
    }
    const text = chunk.map((i) => lines[i]).join('\n').trim();
    const headingMatch = headingMode ? text.split('\n')[0].match(BLOCK_HEADING_RE) : null;
    blocks.push({
      index: blocks.length + 1,
      text,
      heading: headingMatch ? headingMatch[1].trim() : undefined,
      startLine: contentLines[0],
      endLine: contentLines[contentLines.length - 1],
    });
  }
  return blocks;
}

/** Compares block texts while ignoring trailing whitespace per line. */
function normalizeBlockText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

export { SORTED_LINK_RE };

function hasSortedLink(text: string): boolean {
  const lines = text.split('\n');
  const fenced = markFencedLines(lines);
  return lines.some((line, i) => !fenced[i] && SORTED_LINK_RE.test(line.trim()));
}

/**
 * Splits a daily note into the blocks that still need sorting. Frontmatter and the first `#`
 * heading are blanked out (not removed), so `startLine`/`endLine` are line numbers of the file.
 * A paragraph consisting only of link lines belongs to the block before it, and blocks that
 * already contain a link line are dropped.
 */
export function splitDailyNoteBlocks(text: string): InboxBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.replace(/^﻿/, '').trim() === '---') {
    const close = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
    if (close > 0) {
      lines.fill('', 0, close + 1);
    }
  }
  const fenced = markFencedLines(lines);
  const titleIdx = lines.findIndex((line, i) => !fenced[i] && /^#\s+/.test(line));
  if (titleIdx !== -1) {
    lines[titleIdx] = '';
  }

  const merged: InboxBlock[] = [];
  for (const block of splitInboxBlocks(lines.join('\n'))) {
    const linkOnly = block.text.split('\n').every((line) => SORTED_LINK_RE.test(line.trim()));
    const previous = merged[merged.length - 1];
    if (linkOnly && previous) {
      previous.text = `${previous.text}\n\n${block.text}`;
      previous.endLine = block.endLine;
      continue;
    }
    merged.push({ ...block });
  }

  return merged
    .filter((block) => !hasSortedLink(block.text))
    .map((block, i) => ({ ...block, index: i + 1 }));
}

/** Inserts `-> [[target]]` after each given block end line (bottom-up), keeping the file's line ending. */
export function insertSortedLinks(text: string, links: Array<{ endLine: number; target: string }>): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const link of [...links].sort((a, b) => b.endLine - a.endLine)) {
    lines.splice(link.endLine + 1, 0, '', `-> [[${link.target}]]`);
  }
  return lines.join(eol);
}

function fallbackBlockTitle(block: InboxBlock): string {
  if (block.heading) {
    return block.heading;
  }
  const firstLine = block.text.split('\n')[0].replace(/^\s*([-*+]|\d+\.)\s+/, '').trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 60).trimEnd()}…` : firstLine || 'Inbox-Notiz';
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/**
 * Reads title (first `#` heading or file name) and `##` headings of each note as context for
 * target classification. Only the first `maxNotesWithOutline` notes (by path) get an outline.
 */
export async function collectNoteOutlines(
  notesRootUri: vscode.Uri,
  noteUris: vscode.Uri[],
  maxNotesWithOutline: number = MAX_NOTES_WITH_OUTLINE
): Promise<NoteOutline[]> {
  const relativePaths = noteUris
    .map((uri) => ({
      uri,
      relativePath: path.relative(notesRootUri.fsPath, uri.fsPath).replace(/\\/g, '/'),
    }))
    .filter((n) => n.relativePath.toLowerCase() !== 'inbox.md' && !isJournalPath(n.relativePath))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const outlines: NoteOutline[] = [];
  for (const [i, note] of relativePaths.entries()) {
    if (i >= maxNotesWithOutline) {
      outlines.push({ relativePath: note.relativePath, headings: [] });
      continue;
    }
    let text = '';
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(note.uri)).toString('utf-8');
    } catch {
      outlines.push({ relativePath: note.relativePath, headings: [] });
      continue;
    }

    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const fenced = markFencedLines(lines);
    let title: string | undefined;
    const headings: string[] = [];
    lines.forEach((line, idx) => {
      if (fenced[idx]) {
        return;
      }
      const titleMatch = line.match(/^#\s+(.+?)\s*$/);
      if (titleMatch && !title) {
        title = titleMatch[1];
        return;
      }
      const headingMatch = line.match(/^##\s+(.+?)\s*$/);
      if (headingMatch && headings.length < MAX_HEADINGS_PER_NOTE) {
        const clean = headingMatch[1].replace(SORT_TIMESTAMP_SUFFIX_RE, '').trim();
        if (clean) {
          headings.push(truncate(clean, MAX_HEADING_LENGTH));
        }
      }
    });

    outlines.push({
      relativePath: note.relativePath,
      title: truncate(title ?? path.basename(note.relativePath).replace(/\.(md|markdown)$/i, ''), MAX_HEADING_LENGTH),
      headings,
    });
  }
  return outlines;
}

function formatNoteOutline(outline: NoteOutline): string {
  if (!outline.title) {
    return `- ${outline.relativePath}`;
  }
  const headings = outline.headings.length > 0 ? `: ${outline.headings.join('; ')}` : '';
  return `- ${outline.relativePath} — "${outline.title}"${headings}`;
}

/**
 * Formats a Date into `YYYY-MM-DD HH:mm` local time.
 */
export function formatInboxTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * Formats a sorted section for appending to an existing note with a heading containing the topic
 * (`title`) and a suffix: `## <Thema> (YYYY-MM-DD HH:mm)` for the inbox, `## <Thema> (YYYY-MM-DD)`
 * for daily notes.
 */
export function formatAppendedInboxSection(
  title: string,
  rawContent: string,
  suffix: string = formatInboxTimestamp()
): string {
  const timestamp = suffix;
  const trimmed = rawContent.trim();
  const leadingHeadingMatch = trimmed.match(/^#{1,6}\s+([^\n]+)\n*([\s\S]*)$/);
  if (leadingHeadingMatch) {
    const existingHeadingText = leadingHeadingMatch[1].trim();
    const restBody = leadingHeadingMatch[2].trim();
    const headingWithTime = existingHeadingText.includes(timestamp)
      ? `## ${existingHeadingText}`
      : `## ${existingHeadingText} (${timestamp})`;
    return restBody ? `${headingWithTime}\n\n${restBody}` : headingWithTime;
  }

  const cleanTitle = title.replace(/^#{1,6}\s+/, '').trim() || 'Inbox-Notiz';
  return `## ${cleanTitle} (${timestamp})\n\n${trimmed}`;
}

/**
 * Rewrites relative Markdown link and image paths in a block moved from `fromDir` to `toDir`, so
 * they keep pointing to the same file. Only paths that resolve to an existing file from `fromDir`
 * change; wiki-links, external, absolute and unresolved targets and links in code stay as they are.
 */
export async function rewriteRelativePaths(
  text: string,
  fromDir: string,
  toDir: string,
  exists: (fsPath: string) => Promise<boolean>
): Promise<string> {
  if (path.resolve(fromDir) === path.resolve(toDir)) return text;
  const rewrites: Array<{ start: number; end: number; path: string }> = [];
  for (const occurrence of findLinkOccurrences(text, { includeImages: true })) {
    if (occurrence.type === 'wiki') continue;
    const linkPath = occurrence.path;
    if (!linkPath || linkPath.startsWith('/') || path.isAbsolute(linkPath)) continue;
    const resolved = path.resolve(fromDir, linkPath);
    if (!(await exists(resolved))) continue;
    const rel = path.relative(toDir, resolved).split(path.sep).join('/');
    if (rel !== linkPath) {
      rewrites.push({ start: occurrence.pathStart, end: occurrence.pathEnd, path: rel });
    }
  }
  let result = text;
  for (const r of rewrites.reverse()) {
    result = result.slice(0, r.start) + r.path + result.slice(r.end);
  }
  return result;
}

/**
 * Parses and validates the JSON block assignments from an LLM response. Unknown block numbers
 * and invalid paths are dropped; only the first assignment per block is kept.
 */
export function parseAiInboxSortItems(rawResponse: string, blocks: InboxBlock[]): InboxSortProposal[] {
  const cleaned = rawResponse
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  if (!cleaned) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');

    if (objStart !== -1 && objEnd > objStart) {
      parsed = JSON.parse(cleaned.slice(objStart, objEnd + 1));
    } else if (arrStart !== -1 && arrEnd > arrStart) {
      parsed = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
    } else {
      throw new Error('KI-Antwort enthielt kein gültiges JSON-Format.');
    }
  }

  const validated = RawInboxSortResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return [];
  }

  const rawList = Array.isArray(validated.data) ? validated.data : validated.data.items;
  const blocksByIndex = new Map(blocks.map((b) => [b.index, b]));
  const assigned = new Set<number>();
  const results: InboxSortProposal[] = [];

  for (const rawItem of rawList) {
    const item = RawInboxSortItemSchema.safeParse(rawItem);
    if (!item.success) {
      continue;
    }
    const block = blocksByIndex.get(item.data.block);
    const safePath = sanitizeRelativeNotePath(item.data.targetRelativePath);
    if (!block || !safePath || assigned.has(block.index)) {
      continue;
    }
    assigned.add(block.index);
    results.push({
      block,
      title: item.data.title?.trim() || fallbackBlockTitle(block),
      action: item.data.action || 'append',
      targetRelativePath: safePath,
    });
  }

  return results;
}

/** One block in the sort preview; `target` is a sanitized note path, missing for blocks without a target. */
interface PreviewRow {
  block: InboxBlock;
  title: string;
  target?: string;
  picked: boolean;
}

type PreviewItem = vscode.QuickPickItem & { row?: PreviewRow; isToggleMode?: boolean; isExtractTasks?: boolean };

type PreviewOutcome =
  | { kind: 'accept'; selected: PreviewItem[] }
  | { kind: 'edit'; row: PreviewRow; selected: PreviewItem[] }
  | { kind: 'cancel' };

const EDIT_TARGET_BUTTON: vscode.QuickInputButton = { iconPath: new vscode.ThemeIcon('edit'), tooltip: 'Ziel ändern' };

/** Shows the multi-select sort preview once; pressing a row's edit button closes it with an edit request. */
function showSortPreview(items: PreviewItem[], options: { title: string; placeholder: string }): Promise<PreviewOutcome> {
  const qp = vscode.window.createQuickPick<PreviewItem>();
  qp.canSelectMany = true;
  qp.ignoreFocusOut = true;
  qp.matchOnDescription = true;
  qp.title = options.title;
  qp.placeholder = options.placeholder;
  qp.items = items;
  qp.selectedItems = items.filter((item) => item.picked);

  return new Promise((resolve) => {
    let done = false;
    const finish = (outcome: PreviewOutcome) => {
      if (done) {
        return;
      }
      done = true;
      resolve(outcome);
      qp.dispose();
    };
    qp.onDidAccept(() => finish({ kind: 'accept', selected: [...qp.selectedItems] }));
    qp.onDidTriggerItemButton((e) => {
      if (e.item.row) {
        finish({ kind: 'edit', row: e.item.row, selected: [...qp.selectedItems] });
      }
    });
    // Also fires on dispose after accept or edit; `done` keeps that from counting as cancel
    qp.onDidHide(() => finish({ kind: 'cancel' }));
    qp.show();
  });
}

const INVALID_TARGET_MESSAGE =
  'Ungültiger Pfad – erlaubt sind Notizen unter meetings/, projects/ oder knowledge/ (ohne "..", nicht inbox.md oder journal/).';

/**
 * Lets the user pick an existing note in the canonical root folders or enter a new note path.
 * Returns a sanitized relative path, or undefined when the user cancels.
 */
async function pickSortTarget(outlines: NoteOutline[], currentTarget?: string): Promise<string | undefined> {
  type TargetItem = vscode.QuickPickItem & { target?: string; isNew?: boolean };
  const noteItems: TargetItem[] = outlines
    .filter((o) => sanitizeRelativeNotePath(o.relativePath) === o.relativePath)
    .map((o) => ({
      label: `${o.relativePath === currentTarget ? '$(check) ' : ''}${formatRelativePathWithLocalizedRoot(o.relativePath)}`,
      description: o.title,
      target: o.relativePath,
    }));
  const items: TargetItem[] = [{ label: '$(new-file) Neue Notiz…', isNew: true }];
  if (noteItems.length > 0) {
    items.push({ label: 'Bestehende Notizen (Abschnitt wird angehängt)', kind: vscode.QuickPickItemKind.Separator }, ...noteItems);
  }

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Ziel für den Abschnitt wählen',
    placeHolder: 'Bestehende Notiz suchen oder neue Notiz anlegen',
    matchOnDescription: true,
  });
  if (!picked) {
    return undefined;
  }
  if (!picked.isNew) {
    return picked.target;
  }

  const folder = currentTarget ? `${path.posix.dirname(currentTarget)}/` : '';
  const value = await vscode.window.showInputBox({
    title: 'Neue Notiz',
    prompt: 'Pfad der neuen Notiz relativ zum Notizen-Ordner, z. B. projects/App-Launch/feedback.md',
    value: folder,
    valueSelection: [folder.length, folder.length],
    validateInput: (input) => {
      const normalized = sanitizeRelativeNotePath(input);
      if (!normalized) {
        return INVALID_TARGET_MESSAGE;
      }
      return normalized === input.trim()
        ? undefined
        : { message: `Wird gespeichert als ${normalized}`, severity: vscode.InputBoxValidationSeverity.Info };
    },
  });
  return value === undefined ? undefined : sanitizeRelativeNotePath(value) ?? undefined;
}

type SortSource =
  | { kind: 'inbox'; uri: vscode.Uri; relPath: string; openDoc?: vscode.TextDocument }
  | { kind: 'daily'; uri: vscode.Uri; relPath: string; openDoc?: vscode.TextDocument; date: string };

function matchingDocument(doc: vscode.TextDocument | undefined, uri: vscode.Uri): vscode.TextDocument | undefined {
  return doc && path.normalize(doc.uri.fsPath) === path.normalize(uri.fsPath) ? doc : undefined;
}

export class AiInboxSorterService {
  constructor(
    private readonly aiModelService: AiModelService,
    private readonly companionManager: CompanionManager = new CompanionManager(),
    private readonly taskGenerator: AiTaskGeneratorService = new AiTaskGeneratorService(aiModelService)
  ) {}

  public isExtractTasksEnabled(): boolean {
    return vscode.workspace.getConfiguration('janus.ai').get<boolean>('inboxSortExtractTasks', false);
  }

  public isConfirmPreviewEnabled(): boolean {
    const cfg = vscode.workspace.getConfiguration('janus.ai');
    return cfg.get<boolean>('inboxSortConfirm', true);
  }

  public async setConfirmPreviewEnabled(enabled: boolean): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('janus.ai');
    const target =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
    await cfg.update('inboxSortConfirm', enabled, target);
  }

  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private async readInboxText(
    inboxUri: vscode.Uri,
    openInboxDocument: vscode.TextDocument | undefined
  ): Promise<string | undefined> {
    if (openInboxDocument) {
      return openInboxDocument.getText();
    }
    if (!(await this.fileExists(inboxUri))) {
      return undefined;
    }
    return Buffer.from(await vscode.workspace.fs.readFile(inboxUri)).toString('utf-8');
  }

  /**
   * Splits `<notesRoot>/inbox.md` into blocks, lets the AI assign each block to a note within the
   * three canonical root categories (`meetings`, `projects`, `knowledge`), optionally shows a
   * multi-select preview QuickPick, moves the original block text verbatim (strictly appending to
   * existing files), and removes only the blocks that were written from `inbox.md`.
   */
  public async sortInbox(
    contextUri?: vscode.Uri,
    openInboxDocument?: vscode.TextDocument,
    token?: vscode.CancellationToken
  ): Promise<SortInboxResult> {
    const notesRootUri = this.companionManager.getNotesRootUri(contextUri);
    if (!notesRootUri) {
      throw new Error('Kein Notizen-Ordner im Workspace gefunden.');
    }

    const inboxUri = vscode.Uri.joinPath(notesRootUri, 'inbox.md');
    return this.runSort(
      notesRootUri,
      { kind: 'inbox', uri: inboxUri, relPath: 'inbox.md', openDoc: matchingDocument(openInboxDocument, inboxUri) },
      token
    );
  }

  /**
   * Sorts a daily note (`journal/YYYY-MM-DD.md`): copies each block into its target note and
   * inserts a `-> [[target]]` line below it instead of removing it. Blocks that already have such
   * a line are skipped.
   */
  public async sortDailyNote(
    noteUri: vscode.Uri,
    openDocument?: vscode.TextDocument,
    token?: vscode.CancellationToken
  ): Promise<SortInboxResult> {
    const notesRootUri = this.companionManager.getNotesRootUri(noteUri);
    if (!notesRootUri) {
      throw new Error('Kein Notizen-Ordner im Workspace gefunden.');
    }
    const relPath = path.relative(notesRootUri.fsPath, noteUri.fsPath).replace(/\\/g, '/');
    const date = isDailyNotePath(relPath);
    if (!date) {
      throw new Error('Diese Notiz ist keine Tagesnotiz.');
    }
    return this.runSort(
      notesRootUri,
      { kind: 'daily', uri: noteUri, relPath, date, openDoc: matchingDocument(openDocument, noteUri) },
      token
    );
  }

  private async buildPreviewItems(
    notesRootUri: vscode.Uri,
    rows: PreviewRow[],
    directModePicked: boolean,
    extractTasksPicked: boolean
  ): Promise<PreviewItem[]> {
    const items: PreviewItem[] = [];
    for (const row of rows) {
      const detail = row.block.text.replace(/\s+/g, ' ').slice(0, 140);
      if (!row.target) {
        items.push({ label: '$(circle-slash) Kein Ziel', description: row.title, detail, buttons: [EDIT_TARGET_BUTTON], picked: row.picked, row });
        continue;
      }
      const exists = await this.fileExists(vscode.Uri.joinPath(notesRootUri, ...row.target.split('/')));
      const actionLabel = exists ? '$(add) Anhängen an' : '$(new-file) Neu erstellen';
      items.push({
        label: `${actionLabel}: ${formatRelativePathWithLocalizedRoot(row.target)}`,
        description: `${row.title} (${row.target})`,
        detail,
        buttons: [EDIT_TARGET_BUTTON],
        picked: row.picked,
        row,
      });
    }
    items.push({
      label: '$(checklist) Aufgaben aus einsortierten Abschnitten erzeugen',
      description: 'Nur für diesen Lauf (Standard: janus.ai.inboxSortExtractTasks)',
      picked: extractTasksPicked,
      isExtractTasks: true,
    });
    items.push({
      label: '$(gear) Direkt-Modus aktivieren (zukünftig ohne Vorschau einsortieren)',
      description: 'Einstellung janus.ai.inboxSortConfirm umschalten',
      picked: directModePicked,
      isToggleMode: true,
    });
    return items;
  }

  private readSourceBlocks(source: SortSource, text: string): InboxBlock[] {
    return source.kind === 'inbox'
      ? splitInboxBlocks(extractMeaningfulInboxBody(text))
      : splitDailyNoteBlocks(text);
  }

  private async runSort(
    notesRootUri: vscode.Uri,
    source: SortSource,
    token?: vscode.CancellationToken
  ): Promise<SortInboxResult> {
    const inboxUri = source.uri;
    const openInboxDoc = source.openDoc;
    const isDaily = source.kind === 'daily';

    const emptyResult = (blocks: InboxBlock[], extra: Partial<SortInboxResult> = {}): SortInboxResult => ({
      inboxUri,
      source: source.kind,
      sortedItems: [],
      unassignedBlocks: blocks,
      skippedChanged: [],
      remainingBlockCount: blocks.length,
      ...extra,
    });

    const rawInboxText = await this.readInboxText(inboxUri, openInboxDoc);
    const blocks = this.readSourceBlocks(source, rawInboxText ?? '');
    if (blocks.length === 0) {
      return emptyResult([], { skippedEmpty: true });
    }

    const allNotes = await findMarkdownNotesInRoot(notesRootUri);
    const existingFolderSet = new Set<string>(DEFAULT_ROOT_FOLDERS);

    try {
      const rootEntries = await vscode.workspace.fs.readDirectory(notesRootUri);
      for (const [name, type] of rootEntries) {
        if (!name.startsWith('.') && type === vscode.FileType.Directory && !isJournalPath(name)) {
          existingFolderSet.add(name);
        }
      }
    } catch {
      // Ignore if directory read fails
    }

    const outlines = await collectNoteOutlines(notesRootUri, allNotes);
    for (const outline of outlines) {
      const dir = path.dirname(outline.relativePath).replace(/\\/g, '/');
      if (dir && dir !== '.') {
        existingFolderSet.add(dir);
      }
    }

    const foldersText = Array.from(existingFolderSet)
      .sort()
      .map((f) => {
        const topSeg = f.split('/')[0];
        const localized = getLocalizedRootFolderLabel(topSeg);
        return localized !== topSeg ? `- ${f}/ (${localized})` : `- ${f}/`;
      })
      .join('\n');

    const notesText =
      outlines.length > 0
        ? outlines.map(formatNoteOutline).join('\n')
        : '(Noch keine weiteren Notizen vorhanden)';

    const blocksText = blocks
      .map((b) => `[Block ${b.index}]\n${truncate(b.text, MAX_BLOCK_PROMPT_CHARS)}`)
      .join('\n\n');

    const systemPrompt = [
      'Du bist ein präziser Assistent zum thematischen Einsortieren von Inbox-Notizen in Janus Note.',
      'Die Inbox ist bereits in nummerierte Blöcke aufgeteilt. Ordne jeden Block entweder einer passenden BESTEHENDEN Notiz (`"action": "append"`) zu oder schlage eine NEUE Notiz vor (`"action": "create"`).',
      'Nutze Titel und Überschriften der bestehenden Notizen, um das passendste Ziel zu finden. Bevorzuge das Anhängen an eine thematisch passende bestehende Notiz gegenüber einer neuen Notiz.',
      'VERBINDLICHE ORDNER-STRUKTUR (WICHTIG):',
      'Auf oberster Ebene existieren EXAKT diese drei englischen Hauptordner (erfinde NIEMALS andere Hauptordner auf Root-Ebene!):',
      `- "meetings/" (${getLocalizedRootFolderLabel('meetings')}: allgemeine, projektübergreifende Meetings, Retros, 1:1s)`,
      `- "projects/" (${getLocalizedRootFolderLabel('projects')}: alle projektbezogenen Notizen und Unterordner, z.B. "projects/App-Launch/app-launch.md")`,
      `- "knowledge/" (${getLocalizedRootFolderLabel('knowledge')}: zeitloses Wissen, Referenzen, Ideen, Dokumentation, z.B. "knowledge/ki-prompts.md")`,
      'Weitere Regeln:',
      '1. Gib den Text der Blöcke NICHT zurück – referenziere jeden Block nur über seine Nummer (`block`).',
      '2. `title` ist eine kurze Themenbeschreibung des Blocks (wird als Überschrift verwendet).',
      '3. Verwende für `targetRelativePath` IMMER einen Pfad, der mit `meetings/`, `projects/` oder `knowledge/` beginnt und auf `.md` endet.',
      `4. Lass Blöcke weg, die du keinem sinnvollen Ziel zuordnen kannst – sie bleiben ${isDaily ? 'unverändert in der Tagesnotiz' : 'in der Inbox'}.`,
      '5. Antworte AUSSCHLIESSLICH mit gültigem JSON im folgenden Format (ohne Markdown-Erklärungen):',
      '{"items": [{"block": 1, "title": "Kurze Beschreibung", "action": "append" | "create", "targetRelativePath": "projects/Projektname/Notiz.md"}]}',
      'Wenn keine Blöcke zugeordnet werden können, antworte mit {"items": []}.',
    ].join('\n');

    const userPrompt = [
      'Bestehende Ordner im Notizen-Verzeichnis:',
      foldersText,
      '',
      'Bestehende Notizen im Notizen-Verzeichnis (Pfad — "Titel": Überschriften):',
      notesText,
      '',
      `Blöcke aus ${source.relPath}:`,
      blocksText,
    ].join('\n');

    const rawResponse = await this.aiModelService.completePrompt(systemPrompt, userPrompt, token);
    const proposals = parseAiInboxSortItems(rawResponse, blocks);
    const assignedBlocks = new Set(proposals.map((p) => p.block));
    const unassignedBlocks = blocks.filter((b) => !assignedBlocks.has(b));

    if (proposals.length === 0) {
      return emptyResult(blocks);
    }

    let selectedProposals = proposals;
    let unassignedAtConfirm = unassignedBlocks;
    let extractTasks = this.isExtractTasksEnabled();

    if (this.isConfirmPreviewEnabled()) {
      const proposalByBlock = new Map(proposals.map((p) => [p.block, p]));
      const rows: PreviewRow[] = blocks.map((block) => {
        const proposal = proposalByBlock.get(block);
        return proposal
          ? { block, title: proposal.title, target: proposal.targetRelativePath, picked: true }
          : { block, title: fallbackBlockTitle(block), picked: false };
      });
      let directModePicked = false;
      let extractTasksPicked = extractTasks;

      // The preview closes while the target picker is open and is rebuilt from `rows` afterwards
      for (;;) {
        const items = await this.buildPreviewItems(notesRootUri, rows, directModePicked, extractTasksPicked);
        const outcome = await showSortPreview(items, {
          title: isDaily ? 'KI Tagesnotiz-Sortierung – Vorschau bestätigen' : 'KI Inbox-Sortierung – Vorschau bestätigen',
          placeholder: isDaily
            ? 'Wähle die Abschnitte aus, die kopiert und in der Tagesnotiz verlinkt werden sollen ($(edit) ändert das Ziel)'
            : 'Wähle die Abschnitte aus, die einsortiert werden sollen ($(edit) ändert das Ziel, bestehende Dateien werden nur ergänzt)',
        });

        if (outcome.kind === 'cancel') {
          return emptyResult(blocks, { unassignedBlocks, cancelled: true });
        }

        for (const row of rows) {
          row.picked = outcome.selected.some((item) => item.row === row);
        }
        directModePicked = outcome.selected.some((item) => item.isToggleMode);
        extractTasksPicked = outcome.selected.some((item) => item.isExtractTasks);

        if (outcome.kind === 'accept') {
          break;
        }

        const target = await pickSortTarget(outlines, outcome.row.target);
        if (target) {
          outcome.row.target = target;
          outcome.row.picked = true;
        }
      }

      if (directModePicked) {
        await this.setConfirmPreviewEnabled(false);
      }
      extractTasks = extractTasksPicked;

      selectedProposals = [];
      for (const row of rows) {
        if (!row.picked || !row.target) {
          continue;
        }
        const exists = await this.fileExists(vscode.Uri.joinPath(notesRootUri, ...row.target.split('/')));
        selectedProposals.push({
          block: row.block,
          title: row.title,
          action: exists ? 'append' : 'create',
          targetRelativePath: row.target,
        });
      }
      unassignedAtConfirm = rows.filter((row) => !row.target).map((row) => row.block);

      if (selectedProposals.length === 0) {
        return emptyResult(blocks, { unassignedBlocks: unassignedAtConfirm, cancelled: true });
      }
    }

    // Re-read the inbox: the user may have edited it while the AI request or preview was pending.
    // Only blocks whose text is still present are written, and only those are removed afterwards.
    const currentText = (await this.readInboxText(inboxUri, openInboxDoc)) ?? '';
    const currentBlocks = this.readSourceBlocks(source, currentText);
    const consumed = new Set<number>();
    const executable: Array<{ proposal: InboxSortProposal; text: string; block: InboxBlock }> = [];
    const skippedChanged: InboxSortProposal[] = [];
    for (const proposal of selectedProposals) {
      const key = normalizeBlockText(proposal.block.text);
      const matchIdx = currentBlocks.findIndex(
        (b, i) => !consumed.has(i) && normalizeBlockText(b.text) === key
      );
      if (matchIdx === -1) {
        skippedChanged.push(proposal);
        continue;
      }
      consumed.add(matchIdx);
      executable.push({ proposal, text: currentBlocks[matchIdx].text, block: currentBlocks[matchIdx] });
    }

    const headingSuffix = source.kind === 'daily' ? source.date : formatInboxTimestamp();
    const sortedItems: ExecutedInboxSortItem[] = [];
    const links: Array<{ endLine: number; target: string }> = [];
    const existsCache = new Map<string, Promise<boolean>>();
    const pathExists = (fsPath: string) => {
      let cached = existsCache.get(fsPath);
      if (!cached) {
        cached = this.fileExists(vscode.Uri.file(fsPath));
        existsCache.set(fsPath, cached);
      }
      return cached;
    };
    const appended = new Map<string, InboxSortUndoRecord['appended'][number]>();
    const created: InboxSortUndoRecord['created'] = [];
    const createdFolders: vscode.Uri[] = [];
    const taskBlocks: SortedBlockForTasks[] = [];
    for (const { proposal: item, text: blockText, block } of executable) {
      links.push({ endLine: block.endLine ?? 0, target: item.targetRelativePath.replace(/\.(md|markdown)$/i, '') });
      const segments = item.targetRelativePath.split('/');
      const targetUri = vscode.Uri.joinPath(notesRootUri, ...segments);
      // Relative paths were written against the source note's folder; keep them pointing to the same files
      const text = await rewriteRelativePaths(
        blockText,
        path.dirname(inboxUri.fsPath),
        path.dirname(targetUri.fsPath),
        pathExists
      );
      if (segments.length > 1) {
        // Remember the folders this run creates, deepest first, so undo can remove them again
        for (let depth = segments.length - 1; depth >= 1; depth--) {
          const folderUri = vscode.Uri.joinPath(notesRootUri, ...segments.slice(0, depth));
          if (await this.fileExists(folderUri)) {
            break;
          }
          createdFolders.push(folderUri);
        }
        const parentUri = vscode.Uri.joinPath(notesRootUri, ...segments.slice(0, -1));
        await vscode.workspace.fs.createDirectory(parentUri);
      }

      taskBlocks.push({ text: blockText, targetUri });
      const exists = await this.fileExists(targetUri);
      if (exists) {
        // STRICT APPEND-ONLY PROTECTION: Never delete or overwrite existing content
        const existingBytes = await vscode.workspace.fs.readFile(targetUri);
        const existingText = Buffer.from(existingBytes).toString('utf-8');
        const trimmedExisting = existingText.replace(/\s+$/, '');
        const separator = trimmedExisting.length > 0 ? '\n\n' : '';
        const formattedSection = formatAppendedInboxSection(item.title, text, headingSuffix);
        const updatedText = `${trimmedExisting}${separator}${formattedSection}\n`;
        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(updatedText, 'utf-8'));
        const note = appended.get(targetUri.fsPath) ?? { uri: targetUri, textBefore: existingText, textAfter: '', sections: [] };
        note.textAfter = updatedText;
        note.sections.push(`${separator}${formattedSection}`);
        appended.set(targetUri.fsPath, note);

        sortedItems.push({
          ...item,
          targetUri,
          effectiveAction: 'append',
        });
      } else {
        const baseTitle = path
          .basename(item.targetRelativePath)
          .replace(/\.(md|markdown)$/i, '');
        const fileContent = /^#\s+/.test(text) ? `${text}\n` : `# ${baseTitle}\n\n${text}\n`;
        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(fileContent, 'utf-8'));
        created.push({ uri: targetUri, text: fileContent });

        sortedItems.push({
          ...item,
          targetUri,
          effectiveAction: 'create',
        });
      }
    }

    if (consumed.size === 0) {
      return emptyResult(currentBlocks, { unassignedBlocks: unassignedAtConfirm, skippedChanged });
    }

    const remainingBlocks = currentBlocks.filter((_, i) => !consumed.has(i));
    const updatedInboxContent = isDaily
      ? insertSortedLinks(currentText, links)
      : remainingBlocks.length > 0
        ? `# Inbox\n\n${remainingBlocks.map((b) => b.text).join('\n\n')}\n`
        : '# Inbox\n\n';

    await writeNoteText(inboxUri, updatedInboxContent, openInboxDoc);

    // Tasks come last: a failure here must not affect the blocks already written
    let createdTasks = 0;
    let taskExtractionFailed: string | undefined;
    let tasks: InboxSortUndoRecord['tasks'] = [];
    if (extractTasks) {
      try {
        const results = await this.taskGenerator.extractTasksFromBlocks(notesRootUri, taskBlocks, token);
        tasks = results.map((r) => ({ uri: r.tasksUri, existedBefore: r.existedBefore, added: r.added }));
        createdTasks = results.reduce((sum, r) => sum + r.added.length, 0);
      } catch (err: any) {
        taskExtractionFailed = err?.message || String(err);
      }
    }

    return {
      inboxUri,
      source: source.kind,
      sortedItems,
      unassignedBlocks: unassignedAtConfirm,
      skippedChanged,
      remainingBlockCount: remainingBlocks.length,
      createdTasks,
      taskExtractionFailed,
      undo: {
        source: {
          uri: inboxUri,
          kind: source.kind,
          textBefore: currentText,
          textAfter: updatedInboxContent,
          removedBlocks: isDaily ? [] : executable.map((e) => e.text),
          links: links.map((l) => `-> [[${l.target}]]`),
        },
        appended: [...appended.values()],
        created,
        createdFolders,
        tasks,
      },
    };
  }
}
