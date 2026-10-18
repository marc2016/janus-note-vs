import * as vscode from 'vscode';
import * as path from 'path';
import { z } from 'zod';
import { AiModelService } from './aiModelService';
import { CompanionManager } from '../companion/companionManager';
import { findMarkdownNotesInRoot } from './noteLinkService';
import {
  DEFAULT_ROOT_FOLDERS,
  DefaultRootFolder,
  formatRelativePathWithLocalizedRoot,
  getLocalizedRootFolderLabel,
} from '../commands/notesRootCommands';

const RawInboxSortItemSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  sourceText: z.string().optional(),
  action: z.enum(['append', 'create']).optional().default('append'),
  targetRelativePath: z.string().min(1),
});

const RawInboxSortResponseSchema = z.union([
  z.object({
    items: z.array(RawInboxSortItemSchema),
  }),
  z.array(RawInboxSortItemSchema),
]);

export interface InboxSortProposal {
  title: string;
  content: string;
  sourceText: string;
  action: 'append' | 'create';
  targetRelativePath: string;
}

export interface ExecutedInboxSortItem extends InboxSortProposal {
  targetUri: vscode.Uri;
  effectiveAction: 'append' | 'create';
}

export interface SortInboxResult {
  inboxUri: vscode.Uri;
  sortedItems: ExecutedInboxSortItem[];
  remainingItems: InboxSortProposal[];
  skippedEmpty?: boolean;
  cancelled?: boolean;
}

const DEFAULT_INBOX_WELCOME_LINES = [
  'Willkommen in deinen Janus Notes!',
  'Hier kannst du neue Notizen und Gedanken erfassen.',
];

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
 * and default initialization welcome text.
 */
export function extractMeaningfulInboxBody(rawInboxText: string): string {
  let body = rawInboxText.replace(/^\s*#\s+Inbox\b[^\n]*\n?/i, '');
  for (const line of DEFAULT_INBOX_WELCOME_LINES) {
    body = body.replace(line, '');
  }
  return body.trim();
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
 * Formats an inbox section for appending to an existing note with a heading
 * containing the topic (`title`), date, and time: `## <Thema> (YYYY-MM-DD HH:mm)`.
 */
export function formatAppendedInboxSection(
  title: string,
  rawContent: string,
  now: Date = new Date()
): string {
  const timestamp = formatInboxTimestamp(now);
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
 * Parses and validates the JSON sorting proposals from an LLM response.
 */
export function parseAiInboxSortItems(rawResponse: string): InboxSortProposal[] {
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
  const results: InboxSortProposal[] = [];

  for (const item of rawList) {
    const safePath = sanitizeRelativeNotePath(item.targetRelativePath);
    const content = item.content.trim();
    const title = item.title.trim();
    if (!safePath || !content || !title) {
      continue;
    }
    results.push({
      title,
      content,
      sourceText: (item.sourceText || item.content).trim(),
      action: item.action || 'append',
      targetRelativePath: safePath,
    });
  }

  return results;
}

export class AiInboxSorterService {
  constructor(
    private readonly aiModelService: AiModelService,
    private readonly companionManager: CompanionManager = new CompanionManager()
  ) {}

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

  /**
   * Analyzes `<notesRoot>/inbox.md`, proposes target notes/folders via AI within the three
   * canonical root categories (`meetings`, `projects`, `knowledge`), optionally shows
   * a multi-select preview QuickPick, strictly appends to existing files (never deleting or
   * overwriting existing content), and cleans up sorted entries from `inbox.md`.
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
    const isOpenInboxDoc =
      openInboxDocument &&
      path.normalize(openInboxDocument.uri.fsPath) === path.normalize(inboxUri.fsPath);

    let rawInboxText = '';
    if (isOpenInboxDoc && openInboxDocument) {
      rawInboxText = openInboxDocument.getText();
    } else {
      const exists = await this.fileExists(inboxUri);
      if (!exists) {
        return {
          inboxUri,
          sortedItems: [],
          remainingItems: [],
          skippedEmpty: true,
        };
      }
      rawInboxText = Buffer.from(await vscode.workspace.fs.readFile(inboxUri)).toString('utf-8');
    }

    const meaningfulBody = extractMeaningfulInboxBody(rawInboxText);
    if (!meaningfulBody) {
      return {
        inboxUri,
        sortedItems: [],
        remainingItems: [],
        skippedEmpty: true,
      };
    }

    const allNotes = await findMarkdownNotesInRoot(notesRootUri);
    const existingNoteRelPaths: string[] = [];
    const existingFolderSet = new Set<string>(DEFAULT_ROOT_FOLDERS);

    try {
      const rootEntries = await vscode.workspace.fs.readDirectory(notesRootUri);
      for (const [name, type] of rootEntries) {
        if (!name.startsWith('.') && type === vscode.FileType.Directory) {
          existingFolderSet.add(name);
        }
      }
    } catch {
      // Ignore if directory read fails
    }

    for (const noteUri of allNotes) {
      const rel = path.relative(notesRootUri.fsPath, noteUri.fsPath).replace(/\\/g, '/');
      if (rel.toLowerCase() === 'inbox.md') {
        continue;
      }
      existingNoteRelPaths.push(rel);
      const dir = path.dirname(rel).replace(/\\/g, '/');
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
      existingNoteRelPaths.length > 0
        ? existingNoteRelPaths
            .sort()
            .map((n) => `- ${n}`)
            .join('\n')
        : '(Noch keine weiteren Notizen vorhanden)';

    const systemPrompt = [
      'Du bist ein präziser Assistent zum thematischen Einsortieren von Inbox-Notizen in Janus Note.',
      'Analysiere den Inhalt aus `inbox.md` und teile ihn in logische, thematisch zusammenhängende Abschnitte auf.',
      'Ordne jeden Abschnitt entweder einer passenden BESTEHENDEN Notiz (`"action": "append"`) zu oder schlage eine NEUE Notiz vor (`"action": "create"`).',
      'VERBINDLICHE ORDNER-STRUKTUR (WICHTIG):',
      'Auf oberster Ebene existieren EXAKT diese drei englischen Hauptordner (erfinde NIEMALS andere Hauptordner auf Root-Ebene!):',
      `- "meetings/" (${getLocalizedRootFolderLabel('meetings')}: allgemeine, projektübergreifende Meetings, Retros, 1:1s)`,
      `- "projects/" (${getLocalizedRootFolderLabel('projects')}: alle projektbezogenen Notizen und Unterordner, z.B. "projects/App-Launch/app-launch.md")`,
      `- "knowledge/" (${getLocalizedRootFolderLabel('knowledge')}: zeitloses Wissen, Referenzen, Ideen, Dokumentation, z.B. "knowledge/ki-prompts.md")`,
      'Weitere Regeln:',
      '1. Verändere oder kürze den inhaltlichen Text des Nutzers NICHT (`content` soll den vollständigen Gedanken/Abschnitt im Markdown-Format enthalten).',
      '2. Gib unter `sourceText` den exakten Original-Abschnitt aus der Inbox an.',
      '3. Verwende für `targetRelativePath` IMMER einen Pfad, der mit `meetings/`, `projects/` oder `knowledge/` beginnt und auf `.md` endet.',
      '4. Antworte AUSSCHLIESSLICH mit gültigem JSON im folgenden Format (ohne Markdown-Erklärungen):',
      '{"items": [{"title": "Kurze Beschreibung", "content": "Markdown-Abschnitt", "sourceText": "Originaltext aus inbox.md", "action": "append" | "create", "targetRelativePath": "projects/Projektname/Notiz.md"}]}',
      'Wenn keine sortierbaren Inhalte vorliegen, antworte mit {"items": []}.',
    ].join('\n');

    const userPrompt = [
      'Bestehende Ordner im Notizen-Verzeichnis:',
      foldersText,
      '',
      'Bestehende Notizen im Notizen-Verzeichnis:',
      notesText,
      '',
      'Inhalt aus inbox.md:',
      meaningfulBody,
    ].join('\n');

    const rawResponse = await this.aiModelService.completePrompt(systemPrompt, userPrompt, token);
    const proposals = parseAiInboxSortItems(rawResponse);

    if (proposals.length === 0) {
      return {
        inboxUri,
        sortedItems: [],
        remainingItems: [],
      };
    }

    let selectedProposals = proposals;

    if (this.isConfirmPreviewEnabled()) {
      type SortQuickPickItem = vscode.QuickPickItem & {
        proposal?: InboxSortProposal;
        isToggleMode?: boolean;
      };

      const quickPickItems: SortQuickPickItem[] = [];
      for (const proposal of proposals) {
        const targetUri = vscode.Uri.joinPath(
          notesRootUri,
          ...proposal.targetRelativePath.split('/')
        );
        const alreadyExists = await this.fileExists(targetUri);
        const actionLabel = alreadyExists ? '$(add) Anhängen an' : '$(new-file) Neu erstellen';
        const displayPath = formatRelativePathWithLocalizedRoot(proposal.targetRelativePath);

        quickPickItems.push({
          label: `${actionLabel}: ${displayPath}`,
          description: `${proposal.title} (${proposal.targetRelativePath})`,
          detail: proposal.content.replace(/\s+/g, ' ').slice(0, 140),
          picked: true,
          proposal,
        });
      }

      quickPickItems.push({
        label: '$(gear) Direkt-Modus aktivieren (zukünftig ohne Vorschau einsortieren)',
        description: 'Einstellung janus.ai.inboxSortConfirm umschalten',
        picked: false,
        isToggleMode: true,
      });

      const picked = await vscode.window.showQuickPick(quickPickItems, {
        canPickMany: true,
        title: 'KI Inbox-Sortierung – Vorschau bestätigen',
        placeHolder:
          'Wähle die Abschnitte aus, die einsortiert werden sollen (Bestehende Dateien werden nur ergänzt, nichts wird gelöscht)',
      });

      if (!picked) {
        return {
          inboxUri,
          sortedItems: [],
          remainingItems: proposals,
          cancelled: true,
        };
      }

      if (picked.some((p) => p.isToggleMode)) {
        await this.setConfirmPreviewEnabled(false);
      }

      selectedProposals = picked
        .filter((p): p is SortQuickPickItem & { proposal: InboxSortProposal } => Boolean(p.proposal))
        .map((p) => p.proposal);

      if (selectedProposals.length === 0) {
        return {
          inboxUri,
          sortedItems: [],
          remainingItems: proposals,
          cancelled: true,
        };
      }
    }

    const sortedItems: ExecutedInboxSortItem[] = [];
    const selectedSet = new Set(selectedProposals);
    const remainingItems = proposals.filter((p) => !selectedSet.has(p));

    for (const item of selectedProposals) {
      const segments = item.targetRelativePath.split('/');
      const targetUri = vscode.Uri.joinPath(notesRootUri, ...segments);
      if (segments.length > 1) {
        const parentUri = vscode.Uri.joinPath(notesRootUri, ...segments.slice(0, -1));
        await vscode.workspace.fs.createDirectory(parentUri);
      }

      const exists = await this.fileExists(targetUri);
      if (exists) {
        // STRICT APPEND-ONLY PROTECTION: Never delete or overwrite existing content
        const existingBytes = await vscode.workspace.fs.readFile(targetUri);
        const existingText = Buffer.from(existingBytes).toString('utf-8');
        const trimmedExisting = existingText.replace(/\s+$/, '');
        const separator = trimmedExisting.length > 0 ? '\n\n' : '';
        const formattedSection = formatAppendedInboxSection(item.title, item.content);
        const updatedText = `${trimmedExisting}${separator}${formattedSection}\n`;
        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(updatedText, 'utf-8'));

        sortedItems.push({
          ...item,
          targetUri,
          effectiveAction: 'append',
        });
      } else {
        const baseTitle = path
          .basename(item.targetRelativePath)
          .replace(/\.(md|markdown)$/i, '');
        const trimmedContent = item.content.trim();
        const fileContent = /^#\s+/.test(trimmedContent)
          ? `${trimmedContent}\n`
          : `# ${baseTitle}\n\n${trimmedContent}\n`;
        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(fileContent, 'utf-8'));

        sortedItems.push({
          ...item,
          targetUri,
          effectiveAction: 'create',
        });
      }
    }

    // Update inbox.md: reset to "# Inbox\n\n" if all items were sorted, or keep remaining items intact
    let updatedInboxContent = '# Inbox\n\n';
    if (remainingItems.length > 0) {
      let remainingBody = meaningfulBody;
      for (const sorted of sortedItems) {
        if (sorted.sourceText && remainingBody.includes(sorted.sourceText)) {
          remainingBody = remainingBody.replace(sorted.sourceText, '').trim();
        } else if (sorted.content && remainingBody.includes(sorted.content)) {
          remainingBody = remainingBody.replace(sorted.content, '').trim();
        }
      }

      for (const rem of remainingItems) {
        const snippet = rem.sourceText || rem.content;
        if (snippet && !remainingBody.includes(snippet)) {
          remainingBody = remainingBody ? `${remainingBody}\n\n${snippet}` : snippet;
        }
      }

      updatedInboxContent = remainingBody.trim()
        ? `# Inbox\n\n${remainingBody.trim()}\n`
        : '# Inbox\n\n';
    }

    await vscode.workspace.fs.writeFile(inboxUri, Buffer.from(updatedInboxContent, 'utf-8'));

    if (isOpenInboxDoc && openInboxDocument) {
      const currentDocText = openInboxDocument.getText();
      if (currentDocText !== updatedInboxContent && typeof openInboxDocument.positionAt === 'function') {
        const fullRange = new vscode.Range(
          openInboxDocument.positionAt(0),
          openInboxDocument.positionAt(currentDocText.length)
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(openInboxDocument.uri, fullRange, updatedInboxContent);
        await vscode.workspace.applyEdit(edit);
      }
    }

    return {
      inboxUri,
      sortedItems,
      remainingItems,
    };
  }
}
