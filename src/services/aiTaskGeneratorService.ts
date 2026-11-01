import * as vscode from 'vscode';
import * as path from 'path';
import { z } from 'zod';
import { AiModelService } from './aiModelService';
import { FolderTasksService } from './folderTasksService';
import { TaskItem, TaskItemSchema, TaskPrioritySchema } from '../models/tasks';

const ExtractedTaskSchema = z.object({
  title: z.string().min(1),
  priority: TaskPrioritySchema.optional().default('medium'),
  dueDate: z.string().nullish(),
  scheduledDate: z.string().nullish(),
});

const ExtractedTasksResponseSchema = z.union([
  z.object({
    tasks: z.array(ExtractedTaskSchema),
  }),
  z.array(ExtractedTaskSchema),
]);

const ExtractedBlockTaskSchema = ExtractedTaskSchema.extend({
  block: z.coerce.number().int().positive(),
});

const ExtractedBlockTasksResponseSchema = z.union([
  z.object({
    tasks: z.array(z.unknown()),
  }),
  z.array(z.unknown()),
]);

/** Prompt rules for task fields and dates, shared by single-note and sorted-block extraction. */
const TASK_FIELD_RULES = [
  'dueDate ist die Frist, bis wann die Aufgabe erledigt sein muss (z.B. "bis", "Frist", "Abgabe").',
  'scheduledDate ist der Tag, an dem laut Notiz an der Aufgabe gearbeitet wird (z.B. "am Montag kümmere ich mich darum").',
  'Löse relative Angaben wie "nächsten Montag" anhand des heutigen Datums auf. Wird ein Datum nicht genannt, lasse das Feld weg oder setze null.',
];

/** Longest block text sent for task extraction from sorted blocks. */
const MAX_BLOCK_TASK_PROMPT_CHARS = 4000;

export interface GenerateTasksResult {
  tasksUri: vscode.Uri;
  addedTasks: TaskItem[];
  totalTasks: number;
}

/** A block written by an inbox sort run, with the note it was written to. */
export interface SortedBlockForTasks {
  text: string;
  targetUri: vscode.Uri;
}

export interface BlockTasksResult {
  tasksUri: vscode.Uri;
  existedBefore: boolean;
  added: TaskItem[];
}

export function normalizeTaskDate(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const deMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (deMatch) {
    const day = Number(deMatch[1]);
    const month = Number(deMatch[2]);
    let year = Number(deMatch[3]);
    if (year < 100) year += 2000;
    const dStr = day < 10 ? `0${day}` : String(day);
    const mStr = month < 10 ? `0${month}` : String(month);
    return `${year}-${mStr}-${dStr}`;
  }
  return undefined;
}

/** Today's local date as `YYYY-MM-DD`. */
function localIsoDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Extracts a JSON object or array from an LLM response that may contain Markdown code fences or surrounding text.
 */
function parseJsonResponse(rawResponse: string): unknown {
  const cleaned = rawResponse
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  if (!cleaned) {
    return undefined;
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
  return parsed;
}

export function parseAiExtractedTasks(
  rawResponse: string
): Array<{ title: string; priority: 'low' | 'medium' | 'high'; dueDate?: string; scheduledDate?: string }> {
  const parsed = parseJsonResponse(rawResponse);
  if (parsed === undefined) {
    return [];
  }

  const validated = ExtractedTasksResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return [];
  }

  const list = Array.isArray(validated.data) ? validated.data : validated.data.tasks;
  return list
    .map((item) => ({
      title: item.title.trim(),
      priority: item.priority || 'medium',
      dueDate: normalizeTaskDate(item.dueDate),
      scheduledDate: normalizeTaskDate(item.scheduledDate),
    }))
    .filter((item) => item.title.length > 0);
}

/**
 * Parses tasks that reference a sorted block by number; invalid items and unknown block numbers are dropped.
 */
export function parseAiBlockTasks(
  rawResponse: string,
  blockCount: number
): Array<{ block: number; title: string; priority: 'low' | 'medium' | 'high'; dueDate?: string; scheduledDate?: string }> {
  const parsed = parseJsonResponse(rawResponse);
  const validated = ExtractedBlockTasksResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return [];
  }
  const rawList = Array.isArray(validated.data) ? validated.data : validated.data.tasks;
  const results: ReturnType<typeof parseAiBlockTasks> = [];
  for (const rawItem of rawList) {
    const item = ExtractedBlockTaskSchema.safeParse(rawItem);
    if (!item.success || item.data.block > blockCount || !item.data.title.trim()) {
      continue;
    }
    results.push({
      block: item.data.block,
      title: item.data.title.trim(),
      priority: item.data.priority || 'medium',
      dueDate: normalizeTaskDate(item.data.dueDate),
      scheduledDate: normalizeTaskDate(item.data.scheduledDate),
    });
  }
  return results;
}

function newExtractedTask(
  candidate: { title: string; priority: 'low' | 'medium' | 'high'; dueDate?: string; scheduledDate?: string },
  noteFileName: string,
  createdAt: string,
  index: number
): TaskItem {
  return TaskItemSchema.parse({
    id: `t-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    title: candidate.title.trim(),
    completed: false,
    status: 'todo',
    priority: candidate.priority,
    dueDate: candidate.dueDate,
    scheduledDate: candidate.scheduledDate,
    note: noteFileName,
    createdAt,
  });
}

export class AiTaskGeneratorService {
  constructor(
    private readonly aiModelService: AiModelService,
    private readonly folderTasksService: FolderTasksService = new FolderTasksService()
  ) {}

  public async generateTasksForNote(
    noteUri: vscode.Uri,
    noteContent?: string,
    token?: vscode.CancellationToken
  ): Promise<GenerateTasksResult> {
    const text =
      noteContent !== undefined
        ? noteContent
        : Buffer.from(await vscode.workspace.fs.readFile(noteUri)).toString('utf-8');

    const folderDir = path.dirname(noteUri.fsPath);
    const tasksUri = vscode.Uri.file(path.join(folderDir, 'tasks.json'));
    const noteFileName = path.basename(noteUri.fsPath);

    const companion = await this.folderTasksService.readFolderCompanion(tasksUri);
    const existingNormalized = new Set(
      companion.tasks.map((t) => t.title.trim().toLowerCase())
    );

    const existingListText =
      companion.tasks.length > 0
        ? companion.tasks.map((t) => `- ${t.title} (${t.status})`).join('\n')
        : '(Keine bestehenden Aufgaben)';

    const systemPrompt = [
      'Du bist ein präziser Assistent zur Aufgaben-Extraktion in Janus Note.',
      'Analysiere die gegebene Markdown-Notiz und extrahiere alle konkreten, offenen Aufgaben (Action Items, To-dos, nächste Schritte).',
      'WICHTIG:',
      '1. Erstelle KEINE Duplikate zu bereits im Ordner vorhandenen Aufgaben.',
      '2. Behalte die Sprache der Notiz bei.',
      '3. Antworte AUSSCHLIESSLICH mit gültigem JSON im folgenden Format (ohne Markdown-Erklärungen):',
      '{"tasks": [{"title": "Kurzer, prägnanter Aufgabentitel", "priority": "low" | "medium" | "high", "dueDate": "YYYY-MM-DD", "scheduledDate": "YYYY-MM-DD"}]}',
      ...TASK_FIELD_RULES,
      'Wenn keine neuen Aufgaben in der Notiz enthalten sind, antworte mit {"tasks": []}.',
    ].join('\n');

    const userPrompt = [
      `Heutiges Datum: ${localIsoDate()}`,
      `Notiz-Datei: ${noteFileName}`,
      '',
      'Bereits vorhandene Aufgaben im Ordner:',
      existingListText,
      '',
      'Notiz-Inhalt:',
      text,
    ].join('\n');

    const rawResponse = await this.aiModelService.completePrompt(systemPrompt, userPrompt, token);
    const extracted = parseAiExtractedTasks(rawResponse);

    const addedTasks: TaskItem[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < extracted.length; i++) {
      const candidate = extracted[i];
      const norm = candidate.title.trim().toLowerCase();
      if (!norm || existingNormalized.has(norm)) {
        continue;
      }
      existingNormalized.add(norm);

      const newTask = newExtractedTask(candidate, noteFileName, now, i);
      companion.tasks.push(newTask);
      addedTasks.push(newTask);
    }

    if (addedTasks.length > 0) {
      await this.folderTasksService.writeFolderCompanion(tasksUri, companion);
    }

    return {
      tasksUri,
      addedTasks,
      totalTasks: companion.tasks.length,
    };
  }

  /**
   * Extracts tasks from blocks an inbox sort run wrote, in one request. Each task is added to the
   * `tasks.json` in the folder of its block's target note and linked to that note.
   */
  public async extractTasksFromBlocks(
    notesRootUri: vscode.Uri,
    blocks: SortedBlockForTasks[],
    token?: vscode.CancellationToken
  ): Promise<BlockTasksResult[]> {
    if (blocks.length === 0) {
      return [];
    }

    const folders = new Map<string, { tasksUri: vscode.Uri; existedBefore: boolean; companion: Awaited<ReturnType<FolderTasksService['readFolderCompanion']>>; titles: Set<string>; added: TaskItem[] }>();
    for (const block of blocks) {
      const folderDir = path.dirname(block.targetUri.fsPath);
      if (folders.has(folderDir)) {
        continue;
      }
      const tasksUri = vscode.Uri.file(path.join(folderDir, 'tasks.json'));
      let existedBefore = true;
      try {
        await vscode.workspace.fs.stat(tasksUri);
      } catch {
        existedBefore = false;
      }
      const companion = await this.folderTasksService.readFolderCompanion(tasksUri);
      const titles = new Set(companion.tasks.map((t) => t.title.trim().toLowerCase()));
      folders.set(folderDir, { tasksUri, existedBefore, companion, titles, added: [] });
    }

    const relative = (fsPath: string) => path.relative(notesRootUri.fsPath, fsPath).replace(/\\/g, '/') || '.';
    const existingText = [...folders.entries()]
      .map(([dir, f]) => {
        const list = f.companion.tasks.map((t) => `  - ${t.title} (${t.status})`).join('\n') || '  (Keine bestehenden Aufgaben)';
        return `- ${relative(dir)}/:\n${list}`;
      })
      .join('\n');
    const blocksText = blocks
      .map((b, i) => {
        const text = b.text.length > MAX_BLOCK_TASK_PROMPT_CHARS ? `${b.text.slice(0, MAX_BLOCK_TASK_PROMPT_CHARS)}…` : b.text;
        return `[Block ${i + 1}] (Ziel: ${relative(b.targetUri.fsPath)})\n${text}`;
      })
      .join('\n\n');

    const systemPrompt = [
      'Du bist ein präziser Assistent zur Aufgaben-Extraktion in Janus Note.',
      'Du erhältst nummerierte Abschnitte, die gerade in Notizen einsortiert wurden. Extrahiere aus jedem Abschnitt alle konkreten, offenen Aufgaben (Action Items, To-dos, nächste Schritte).',
      'WICHTIG:',
      '1. Erstelle KEINE Duplikate zu bereits im Zielordner vorhandenen Aufgaben.',
      '2. Behalte die Sprache des Abschnitts bei.',
      '3. Gib für jede Aufgabe die Nummer ihres Abschnitts als `block` an.',
      '4. Antworte AUSSCHLIESSLICH mit gültigem JSON im folgenden Format (ohne Markdown-Erklärungen):',
      '{"tasks": [{"block": 1, "title": "Kurzer, prägnanter Aufgabentitel", "priority": "low" | "medium" | "high", "dueDate": "YYYY-MM-DD", "scheduledDate": "YYYY-MM-DD"}]}',
      ...TASK_FIELD_RULES,
      'Wenn keine Aufgaben enthalten sind, antworte mit {"tasks": []}.',
    ].join('\n');

    const userPrompt = [
      `Heutiges Datum: ${localIsoDate()}`,
      '',
      'Bereits vorhandene Aufgaben je Zielordner:',
      existingText,
      '',
      'Einsortierte Abschnitte:',
      blocksText,
    ].join('\n');

    const rawResponse = await this.aiModelService.completePrompt(systemPrompt, userPrompt, token);
    const extracted = parseAiBlockTasks(rawResponse, blocks.length);
    const now = new Date().toISOString();

    extracted.forEach((candidate, i) => {
      const block = blocks[candidate.block - 1];
      const folder = folders.get(path.dirname(block.targetUri.fsPath))!;
      const norm = candidate.title.toLowerCase();
      if (folder.titles.has(norm)) {
        return;
      }
      folder.titles.add(norm);
      const task = newExtractedTask(candidate, path.basename(block.targetUri.fsPath), now, i);
      folder.companion.tasks.push(task);
      folder.added.push(task);
    });

    const results: BlockTasksResult[] = [];
    for (const folder of folders.values()) {
      if (folder.added.length === 0) {
        continue;
      }
      await this.folderTasksService.writeFolderCompanion(folder.tasksUri, folder.companion);
      results.push({ tasksUri: folder.tasksUri, existedBefore: folder.existedBefore, added: folder.added });
    }
    return results;
  }
}

