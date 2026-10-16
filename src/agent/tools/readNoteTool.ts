import * as vscode from 'vscode';
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
      targetUri = vscode.Uri.parse(options.input.noteUri);
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

      const resultPayload = {
        noteUri: targetUri.toString(),
        noteContent,
        hasTasksCompanion: status.tasksExist,
        tasks: status.tasks || null,
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
