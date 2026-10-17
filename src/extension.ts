import * as vscode from 'vscode';
import { CompanionManager } from './companion/companionManager';
import { CompanionCodeLensProvider } from './companion/companionCodeLensProvider';
import { CompanionWatcher } from './companion/companionWatcher';
import { TasksEditorProvider } from './editors/tasksEditorProvider';
import { ChartEditorProvider } from './editors/chartEditorProvider';
import { MarkdownEditorProvider } from './editors/markdownEditorProvider';
import { GlobalTasksViewProvider } from './editors/globalTasksViewProvider';
import { FolderTasksService } from './services/folderTasksService';
import { DiffContentProvider, NoteDiffViewer } from './agent/diffViewer';
import { ReadNoteTool } from './agent/tools/readNoteTool';
import { MutateTasksTool } from './agent/tools/mutateTasksTool';
import { MutateChartTool } from './agent/tools/mutateChartTool';
import { JanusChatParticipant } from './agent/chatParticipant';
import { isMarkdownNote } from './companion/companionPaths';
import {
  setNotesRootCommand,
  resetNotesRootCommand,
  initNotesRootCommand,
  updateNotesContextKeys,
  checkNotesRootStatus,
} from './commands/notesRootCommands';
import {
  createFolderCommand,
  createNoteCommand,
  renameItemCommand,
  deleteItemCommand,
} from './commands/notesFileCommands';
import { NotesTreeDataProvider, NotesTreeItem, FolderTreeItem } from './ui/notesTreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
  // 1. Core Services
  const companionManager = new CompanionManager();
  const folderTasksService = new FolderTasksService();
  const codeLensProvider = new CompanionCodeLensProvider(companionManager);
  const companionWatcher = new CompanionWatcher(codeLensProvider);
  const notesTreeDataProvider = new NotesTreeDataProvider(companionManager, folderTasksService);
  const globalTasksViewProvider = new GlobalTasksViewProvider(
    context,
    folderTasksService,
    () => notesTreeDataProvider.refresh()
  );
  const notesTreeView = vscode.window.createTreeView('janus.notesView', {
    treeDataProvider: notesTreeDataProvider,
    showCollapseAll: true,
  });

  // 2. Diff and Review Services
  const diffContentProvider = new DiffContentProvider();
  const noteDiffViewer = new NoteDiffViewer(diffContentProvider);

  context.subscriptions.push(
    companionWatcher,
    vscode.languages.registerCodeLensProvider({ language: 'markdown' }, codeLensProvider),
    vscode.workspace.registerTextDocumentContentProvider(DiffContentProvider.scheme, diffContentProvider),
    notesTreeView,
    TasksEditorProvider.register(context),
    ChartEditorProvider.register(context),
    MarkdownEditorProvider.register(context)
  );

  // Listen to companion & note file changes to refresh tree view and context state
  context.subscriptions.push(
    companionWatcher.onDidChangeCompanion(() => {
      notesTreeDataProvider.refresh();
      globalTasksViewProvider.refresh();
      updateNotesContextKeys(companionManager);
    })
  );

  // Initial context keys update on activation
  updateNotesContextKeys(companionManager);

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
        vscode.window.showErrorMessage('Keine Notiz oder kein Ordner ausgewählt.');
        return;
      }
      const folderUri = isMarkdownNote(targetUri.fsPath)
        ? vscode.Uri.file(targetUri.fsPath.replace(/[\\/][^\\/]+$/, ''))
        : targetUri;
      await vscode.commands.executeCommand('janus.openFolderTasks', folderUri);
      codeLensProvider.refresh();
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
      const folderUri = vscode.Uri.file(targetUri.fsPath.replace(/[\\/][^\\/]+$/, ''));
      const folderTasksUri = vscode.Uri.joinPath(folderUri, 'tasks.json');
      const items: vscode.QuickPickItem[] = [
        {
          label: '$(checklist) Ordner-Aufgaben öffnen',
          description: folderTasksUri.fsPath,
        },
      ];

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
        placeHolder: 'Select Janus action',
      });

      if (!selected) return;

      if (selected.label.includes('Ordner-Aufgaben')) {
        await vscode.commands.executeCommand('janus.openFolderTasks', folderUri);
      } else if (selected.label.includes('Open Diagram View')) {
        await vscode.commands.executeCommand('vscode.openWith', status.chartUri, ChartEditorProvider.viewType);
      } else if (selected.label.includes('Create Diagram View')) {
        await vscode.commands.executeCommand('janus.createChartCompanion', targetUri);
      }
    }),

    vscode.commands.registerCommand('janus.createFolder', (item?: NotesTreeItem) =>
      createFolderCommand(item, notesTreeView, companionManager, notesTreeDataProvider)
    ),
    vscode.commands.registerCommand('janus.createNote', (item?: NotesTreeItem) =>
      createNoteCommand(item, notesTreeView, companionManager, notesTreeDataProvider)
    ),
    vscode.commands.registerCommand('janus.renameItem', (item?: NotesTreeItem) =>
      renameItemCommand(item, notesTreeView, companionManager, notesTreeDataProvider)
    ),
    vscode.commands.registerCommand('janus.deleteItem', (item?: NotesTreeItem) =>
      deleteItemCommand(item, notesTreeView, companionManager, notesTreeDataProvider)
    ),
    vscode.commands.registerCommand('janus.openAllTasks', async () => {
      const status = await checkNotesRootStatus(companionManager);
      const rootUri = status.notesRootUri;
      if (!rootUri) {
        vscode.window.showErrorMessage('Kein Notizen-Ordner im Workspace gefunden.');
        return;
      }
      await globalTasksViewProvider.open(rootUri);
    }),
    vscode.commands.registerCommand('janus.openFolderTasks', async (item?: NotesTreeItem | vscode.Uri) => {
      let folderUri: vscode.Uri | undefined;
      if (item instanceof FolderTreeItem) {
        folderUri = item.uri;
      } else if (item instanceof vscode.Uri) {
        folderUri = item;
      } else {
        const status = await checkNotesRootStatus(companionManager);
        folderUri = status.notesRootUri;
      }
      if (!folderUri) {
        vscode.window.showErrorMessage('Kein Ziel-Ordner für Aufgaben ausgewählt.');
        return;
      }
      const tasksUri = vscode.Uri.joinPath(folderUri, 'tasks.json');
      try {
        await vscode.workspace.fs.stat(tasksUri);
      } catch {
        await folderTasksService.writeFolderCompanion(tasksUri, {
          version: 1,
          tasks: [],
        });
        notesTreeDataProvider.refresh();
      }
      await vscode.commands.executeCommand('vscode.openWith', tasksUri, TasksEditorProvider.viewType);
    }),
    vscode.commands.registerCommand('janus.setNotesRoot', setNotesRootCommand),
    vscode.commands.registerCommand('janus.resetNotesRoot', resetNotesRootCommand),
    vscode.commands.registerCommand('janus.initNotesRoot', async () => {
      await initNotesRootCommand(companionManager, notesTreeDataProvider);
    }),
    vscode.commands.registerCommand('janus.refreshNotesTree', () => {
      notesTreeDataProvider.refresh();
      updateNotesContextKeys(companionManager);
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('janus.notesRoot') || e.affectsConfiguration('janus.initialized')) {
        codeLensProvider.refresh();
        notesTreeDataProvider.refresh();
        updateNotesContextKeys(companionManager);
      }
    })
  );

  console.log('Janus Note extension successfully initialized.');
}

export function deactivate() {}
