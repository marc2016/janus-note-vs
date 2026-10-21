import * as vscode from 'vscode';
import * as path from 'path';
import { z } from 'zod';
import { AiModelService } from './aiModelService';
import { FolderTasksService } from './folderTasksService';
import { TaskItem, TaskItemSchema, TaskPrioritySchema } from '../models/tasks';

const ExtractedTaskSchema = z.object({
  title: z.string().min(1),
  priority: TaskPrioritySchema.optional().default('medium'),
  dueDate: z.string().optional(),
});

const ExtractedTasksResponseSchema = z.union([
  z.object({
    tasks: z.array(ExtractedTaskSchema),
  }),
  z.array(ExtractedTaskSchema),
]);

export interface GenerateTasksResult {
  tasksUri: vscode.Uri;
  addedTasks: TaskItem[];
  totalTasks: number;
}

export function normalizeDueDate(raw?: string): string | undefined {
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

/**
 * Extracts a JSON object or array from an LLM response that may contain Markdown code fences or surrounding text.
 */
export function parseAiExtractedTasks(
  rawResponse: string
): Array<{ title: string; priority: 'low' | 'medium' | 'high'; dueDate?: string }> {
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

  const validated = ExtractedTasksResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return [];
  }

  const list = Array.isArray(validated.data) ? validated.data : validated.data.tasks;
  return list
    .map((item) => ({
      title: item.title.trim(),
      priority: item.priority || 'medium',
      dueDate: normalizeDueDate(item.dueDate),
    }))
    .filter((item) => item.title.length > 0);
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
      '{"tasks": [{"title": "Kurzer, prägnanter Aufgabentitel", "priority": "low" | "medium" | "high", "dueDate": "YYYY-MM-DD"}]}',
      'Wenn für eine Aufgabe kein Fälligkeitsdatum genannt wird, lasse das Feld dueDate weg oder setze null.',
      'Wenn keine neuen Aufgaben in der Notiz enthalten sind, antworte mit {"tasks": []}.',
    ].join('\n');

    const userPrompt = [
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

      const newTask = TaskItemSchema.parse({
        id: `t-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        title: candidate.title.trim(),
        completed: false,
        status: 'todo',
        priority: candidate.priority,
        dueDate: candidate.dueDate,
        note: noteFileName,
        createdAt: now,
      });

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
}
