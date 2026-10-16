import * as vscode from 'vscode';
import { CompanionManager } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';

export class JanusChatParticipant {
  public static readonly participantId = 'janus';

  constructor(private companionManager: CompanionManager) {}

  public register(context: vscode.ExtensionContext): vscode.Disposable {
    const handler: vscode.ChatRequestHandler = async (
      request: vscode.ChatRequest,
      _chatContext: vscode.ChatContext,
      response: vscode.ChatResponseStream,
      token: vscode.CancellationToken
    ) => {
      // 1. Gather active context
      const activeDoc = vscode.window.activeTextEditor?.document;
      let activeNoteInfo = 'No active markdown note currently open.';

      if (activeDoc && isMarkdownNote(activeDoc.uri.fsPath)) {
        const status = await this.companionManager.getCompanionStatus(activeDoc.uri);
        activeNoteInfo = `Active note: "${activeDoc.uri.fsPath}". ` +
          `Tasks companion exists: ${status.tasksExist}. ` +
          `Chart companion exists: ${status.chartExist}.`;
      }

      // 2. Select Language Model
      const model = request.model;
      if (!model) {
        response.markdown(
          '**No Language Model Available**\n\n' +
          'VS Code has not provided a language model. Please make sure GitHub Copilot or another Language Model provider is enabled in VS Code.'
        );
        return;
      }

      // 3. Prepare system prompt & messages
      const systemPrompt = `You are Janus (@janus), an AI assistant for note-taking and project planning.
Janus Note combines:
1. Human Perspective: Clean Markdown notes for thinking and writing.
2. Agent Perspective: Schema-validated companion files (*.tasks.json, *.chart.json) for machine-operable tasks and diagrams.

Current environment:
${activeNoteInfo}

Available Janus tools:
- janus_read_note_and_companions: Read note text & attached task/chart companions
- janus_mutate_tasks: Add, update, check off, or set tasks in *.tasks.json
- janus_mutate_chart: Update or create diagram in *.chart.json

Help the user by reasoning about their thoughts, structuring tasks, generating diagrams, and proposing updates.`;

      const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        vscode.LanguageModelChatMessage.User(request.prompt),
      ];

      // 4. Send request and stream response
      try {
        response.progress('Janus is thinking...');

        // Pass declared tools to the language model if available
        const tools = vscode.lm.tools.filter((t) => t.name.startsWith('janus_'));

        const chatResponse = await model.sendRequest(
          messages,
          {
            tools: tools as any,
          },
          token
        );

        for await (const fragment of chatResponse.text) {
          response.markdown(fragment);
        }
      } catch (err: any) {
        response.markdown(`\n\nError communicating with model: ${err?.message || String(err)}`);
      }
    };

    const participant = vscode.chat.createChatParticipant(JanusChatParticipant.participantId, handler);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'public', 'icon.png');

    return participant;
  }
}
