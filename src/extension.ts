import * as vscode from 'vscode';
import { CompanionManager } from './companion/companionManager';
import { CompanionCodeLensProvider } from './companion/companionCodeLensProvider';
import { CompanionWatcher } from './companion/companionWatcher';
import { TasksEditorProvider } from './editors/tasksEditorProvider';
import { ChartEditorProvider } from './editors/chartEditorProvider';
import { MarkdownEditorProvider } from './editors/markdownEditorProvider';
import { DiffContentProvider, NoteDiffViewer } from './agent/diffViewer';
import { ReadNoteTool } from './agent/tools/readNoteTool';
import { MutateTasksTool } from './agent/tools/mutateTasksTool';
import { MutateChartTool } from './agent/tools/mutateChartTool';
import { JanusChatParticipant } from './agent/chatParticipant';
import { isMarkdownNote } from './companion/companionPaths';

export function activate(context: vscode.ExtensionContext) {
  // 1. Core Services
  const companionManager = new CompanionManager();
  const codeLensProvider = new CompanionCodeLensProvider(companionManager);
  const companionWatcher = new CompanionWatcher(codeLensProvider);

  // 2. Diff and Review Services
  const diffContentProvider = new DiffContentProvider();
  const noteDiffViewer = new NoteDiffViewer(diffContentProvider);

  context.subscriptions.push(
    companionWatcher,
    vscode.languages.registerCodeLensProvider({ language: 'markdown' }, codeLensProvider),
    vscode.workspace.registerTextDocumentContentProvider(DiffContentProvider.scheme, diffContentProvider),
    TasksEditorProvider.register(context),
    ChartEditorProvider.register(context),
    MarkdownEditorProvider.register(context)
  );

  // 3. Register Language Model Tools
  if (vscode.lm && typeof vscode.lm.registerTool === 'function') {
    context.subscriptions.push(
      vscode.lm.registerTool('janus_read_note_and_companions', new ReadNoteTool(companionManager)),
      vscode.lm.registerTool('janus_mutate_tasks', new MutateTasksTool(companionManager)),
      vscode.lm.registerTool('janus_mutate_chart', new MutateChartTool(companionManager))
    );
  }

  // 4. Register Chat Participant (@janus)
  if (vscode.chat && typeof vscode.chat.createChatParticipant === 'function') {
    const chatParticipant = new JanusChatParticipant(companionManager);
    context.subscriptions.push(chatParticipant.register(context));
  }

  // 5. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('janus.createTasksCompanion', async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showErrorMessage('No markdown note selected to create tasks companion for.');
        return;
      }
      try {
        const tasksUri = await companionManager.createTasksCompanion(targetUri);
        await vscode.commands.executeCommand('vscode.openWith', tasksUri, TasksEditorProvider.viewType);
        codeLensProvider.refresh();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to create tasks companion: ${err?.message || String(err)}`);
      }
    }),

    vscode.commands.registerCommand('janus.createChartCompanion', async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showErrorMessage('No markdown note selected to create diagram companion for.');
        return;
      }
      try {
        const chartUri = await companionManager.createChartCompanion(targetUri);
        await vscode.commands.executeCommand('vscode.openWith', chartUri, ChartEditorProvider.viewType);
        codeLensProvider.refresh();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to create chart companion: ${err?.message || String(err)}`);
      }
    }),

    vscode.commands.registerCommand('janus.openMarkdownEditor', async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri || !isMarkdownNote(targetUri.fsPath)) {
        vscode.window.showErrorMessage('Please open or select a Markdown note first.');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', targetUri, MarkdownEditorProvider.viewType);
    }),

    vscode.commands.registerCommand('janus.openCompanion', async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri || !isMarkdownNote(targetUri.fsPath)) {
        vscode.window.showErrorMessage('Please open or select a Markdown note first.');
        return;
      }

      const status = await companionManager.getCompanionStatus(targetUri);
      const items: vscode.QuickPickItem[] = [];

      if (status.tasksExist) {
        items.push({
          label: '$(checklist) Open Task Board',
          description: status.tasksUri.fsPath,
        });
      } else {
        items.push({
          label: '$(plus) Create Task Board',
          description: 'Create a new *.tasks.json companion',
        });
      }

      if (status.chartExist) {
        items.push({
          label: '$(graph) Open Diagram View',
          description: status.chartUri.fsPath,
        });
      } else {
        items.push({
          label: '$(plus) Create Diagram View',
          description: 'Create a new *.chart.json companion',
        });
      }

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select Janus companion action',
      });

      if (!selected) return;

      if (selected.label.includes('Open Task Board')) {
        await vscode.commands.executeCommand('vscode.openWith', status.tasksUri, TasksEditorProvider.viewType);
      } else if (selected.label.includes('Create Task Board')) {
        await vscode.commands.executeCommand('janus.createTasksCompanion', targetUri);
      } else if (selected.label.includes('Open Diagram View')) {
        await vscode.commands.executeCommand('vscode.openWith', status.chartUri, ChartEditorProvider.viewType);
      } else if (selected.label.includes('Create Diagram View')) {
        await vscode.commands.executeCommand('janus.createChartCompanion', targetUri);
      }
    })
  );

  console.log('Janus Note extension successfully initialized.');
}

export function deactivate() {}
