import * as vscode from 'vscode';
import { z } from 'zod';
import { CompanionManager } from '../../companion/companionManager';
import { getCompanionPaths, isTasksCompanion } from '../../companion/companionPaths';
import { TaskItem, TaskItemSchema, TasksCompanion } from '../../models/tasks';

export interface MutateTasksToolInput {
  noteUri: string;
  action: 'add' | 'update' | 'delete' | 'setAll';
  tasks?: TaskItem[];
}

const MutateTasksInputSchema = z.object({
  noteUri: z.string().min(1),
  action: z.enum(['add', 'update', 'delete', 'setAll']),
  tasks: z.array(TaskItemSchema).optional(),
});

export class MutateTasksTool implements vscode.LanguageModelTool<MutateTasksToolInput> {
  constructor(private companionManager: CompanionManager) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<MutateTasksToolInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const parseResult = MutateTasksInputSchema.safeParse(options.input);
    if (!parseResult.success) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Schema validation error: ${JSON.stringify(parseResult.error.format())}`
        )
      ]);
    }

    const { noteUri, action, tasks = [] } = parseResult.data;
    let targetTasksUri: vscode.Uri;

    try {
      const parsedUri = vscode.Uri.parse(noteUri);
      if (isTasksCompanion(parsedUri.fsPath)) {
        targetTasksUri = parsedUri;
      } else {
        const paths = getCompanionPaths(parsedUri.fsPath);
        targetTasksUri = vscode.Uri.file(paths.tasksPath);
      }
    } catch (err: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Invalid noteUri provided: ${err?.message || String(err)}`)
      ]);
    }

    try {
      let companion: TasksCompanion;
      try {
        companion = await this.companionManager.readTasksCompanion(targetTasksUri);
      } catch {
        companion = { version: 1, title: 'Tasks', tasks: [] };
      }

      if (action === 'setAll') {
        companion.tasks = tasks;
      } else if (action === 'add') {
        companion.tasks.push(...tasks);
      } else if (action === 'update') {
        for (const update of tasks) {
          const idx = companion.tasks.findIndex((t) => t.id === update.id);
          if (idx >= 0) {
            companion.tasks[idx] = { ...companion.tasks[idx], ...update, updatedAt: new Date().toISOString() };
          }
        }
      } else if (action === 'delete') {
        const deleteIds = new Set(tasks.map((t) => t.id));
        companion.tasks = companion.tasks.filter((t) => !deleteIds.has(t.id));
      }

      const updatedJson = Buffer.from(JSON.stringify(companion, null, 2), 'utf-8');
      await vscode.workspace.fs.writeFile(targetTasksUri, updatedJson);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Successfully applied '${action}' to '${targetTasksUri.fsPath}'. Task count: ${companion.tasks.length}.`
        )
      ]);
    } catch (err: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error mutating tasks companion: ${err?.message || String(err)}`)
      ]);
    }
  }
}
