import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../../companion/companionManager';
import { isMarkdownNote } from '../../companion/companionPaths';

export interface ReadNoteToolInput {
  noteUri?: string;
}

export class ReadNoteTool implements vscode.LanguageModelTool<ReadNoteToolInput> {
  constructor(private companionManager: CompanionManager) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ReadNoteToolInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    let targetUri: vscode.Uri | undefined;

    if (options.input.noteUri) {
      targetUri = options.input.noteUri.includes('://')
        ? vscode.Uri.parse(options.input.noteUri)
        : vscode.Uri.file(options.input.noteUri);
    } else {
      targetUri = vscode.window.activeTextEditor?.document.uri;
    }

    if (!targetUri) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: No active markdown note found and no noteUri was provided.')
      ]);
    }

    if (!isMarkdownNote(targetUri.fsPath)) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Warning: Target file '${targetUri.fsPath}' is not recognized as a Markdown note.`)
      ]);
    }

    try {
      const docBytes = await vscode.workspace.fs.readFile(targetUri);
      const noteContent = Buffer.from(docBytes).toString('utf-8');

      const status = await this.companionManager.getCompanionStatus(targetUri);
      const folderTasksUri = vscode.Uri.file(path.join(path.dirname(targetUri.fsPath), 'tasks.json'));

      let tasks = status.tasks || null;
      let hasTasksCompanion = status.tasksExist;

      if (!hasTasksCompanion) {
        try {
          await vscode.workspace.fs.stat(folderTasksUri);
          tasks = await this.companionManager.readTasksCompanion(folderTasksUri);
          hasTasksCompanion = true;
        } catch {
          // No folder tasks.json yet
        }
      }

      const resultPayload = {
        noteUri: targetUri.toString(),
        folderTasksUri: folderTasksUri.toString(),
        noteContent,
        hasTasksCompanion,
        tasks,
        hasChartCompanion: status.chartExist,
        chart: status.chart || null,
      };

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(resultPayload, null, 2))
      ]);
    } catch (err: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error reading note or companions: ${err?.message || String(err)}`)
      ]);
    }
  }
}
