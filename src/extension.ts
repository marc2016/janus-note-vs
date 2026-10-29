import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from './companion/companionManager';
import { CompanionCodeLensProvider } from './companion/companionCodeLensProvider';
import { CompanionWatcher } from './companion/companionWatcher';
import { TasksEditorProvider } from './editors/tasksEditorProvider';
import { ChartEditorProvider } from './editors/chartEditorProvider';
import { MarkdownEditorProvider, showInboxSortResult } from './editors/markdownEditorProvider';
import { GlobalTasksViewProvider } from './editors/globalTasksViewProvider';
import { CalendarViewProvider } from './editors/calendarViewProvider';
import { CalendarDayDetailsViewProvider } from './editors/calendarDayDetailsViewProvider';
import { SettingsViewProvider } from './editors/settingsViewProvider';
import { FolderOverviewViewProvider } from './editors/folderOverviewViewProvider';
import { NoteGraphViewProvider } from './editors/noteGraphViewProvider';
import { ExportCompendiumViewProvider } from './editors/exportCompendiumViewProvider';
import {
  ChatViewProvider,
  DIAGRAM_FROM_SELECTION_REQUEST,
  DiagramContext,
  SelectionContext,
} from './editors/chatViewProvider';
import { collectMarkdownNotesFromSelection } from './services/noteLinkService';
import { FolderTasksService } from './services/folderTasksService';
import { CalendarService } from './services/calendarService';
import { AiModelService } from './services/aiModelService';
import { AiTaskGeneratorService } from './services/aiTaskGeneratorService';
import { AiInboxSorterService } from './services/aiInboxSorterService';
import { AiFolderSummaryService } from './services/aiFolderSummaryService';
import { JanusSearchService } from './services/janusSearchService';
import { PdfExportService } from './services/pdfExportService';
import { DiffContentProvider, NoteDiffViewer } from './agent/diffViewer';
import { ReadNoteTool } from './agent/tools/readNoteTool';
import { MutateTasksTool } from './agent/tools/mutateTasksTool';
import { MutateChartTool } from './agent/tools/mutateChartTool';
import { SearchNotesTool } from './agent/tools/searchNotesTool';
import { JanusChatParticipant } from './agent/chatParticipant';
import { isMarkdownNote } from './companion/companionPaths';
import {
  setNotesRootCommand,
  resetNotesRootCommand,
  initNotesRootCommand,
  addLinkedFolderCommand,
  removeLinkedFolderCommand,
  updateNotesContextKeys,
  checkNotesRootStatus,
} from './commands/notesRootCommands';
import {
  createFolderCommand,
  createNoteCommand,
  renameItemCommand,
  editTemplatesCommand,
  openDailyNoteCommand,
  deleteItemCommand,
} from './commands/notesFileCommands';
import {
  NotesTreeDataProvider,
  NotesTreeItem,
  FolderTreeItem,
  LinkedFolderTreeItem,
} from './ui/notesTreeDataProvider';

export function getActiveNoteUri(): vscode.Uri | undefined {
  const tabGroups = vscode.window.tabGroups;
  const activeTab = tabGroups?.activeTabGroup?.activeTab;
  if (activeTab?.input) {
    const input: any = activeTab.input;

    if (input instanceof vscode.TabInputWebview || (input && typeof input.viewType === 'string')) {
      if (input.viewType === CalendarViewProvider.monthViewType) {
        return vscode.Uri.parse('janus-calendar:///all');
      }
      if (input.viewType === GlobalTasksViewProvider.viewType) {
        return vscode.Uri.parse('janus-tasks:///all');
      }
      if (input.viewType === NoteGraphViewProvider.viewType) {
        return vscode.Uri.parse('janus-graph:///all');
      }
    }

    if (input instanceof vscode.TabInputText && input.uri) {
      return input.uri;
    }
    if (input instanceof vscode.TabInputCustom && input.uri) {
      return input.uri;
    }
    if (input && typeof input === 'object' && input.uri instanceof vscode.Uri) {
      return input.uri;
    }
  }

  return vscode.window.activeTextEditor?.document?.uri;
}

export function activate(context: vscode.ExtensionContext) {
  // 1. Core Services
  const companionManager = new CompanionManager();
  const folderTasksService = new FolderTasksService();
  const aiModelService = new AiModelService(context);
  const aiTaskGeneratorService = new AiTaskGeneratorService(aiModelService, folderTasksService);
  const aiInboxSorterService = new AiInboxSorterService(aiModelService, companionManager);
  const janusSearchService = new JanusSearchService(companionManager, folderTasksService);
  const codeLensProvider = new CompanionCodeLensProvider(companionManager);
  const companionWatcher = new CompanionWatcher(codeLensProvider);
  const calendarService = new CalendarService(folderTasksService);
  const notesTreeDataProvider = new NotesTreeDataProvider(
    companionManager,
    folderTasksService,
    calendarService
  );
  const notesTreeView = vscode.window.createTreeView('janus.notesView', {
    treeDataProvider: notesTreeDataProvider,
    showCollapseAll: true,
    canSelectMany: true,
  });

  // Active editor synchronization with sidebar selection
  let syncDebounceTimer: NodeJS.Timeout | undefined;

  const syncSidebarSelectionWithActiveEditor = async (targetUri?: vscode.Uri) => {
    const uri = targetUri || getActiveNoteUri();
    if (!uri) {
      return;
    }

    try {
      const item = await notesTreeDataProvider.getTreeItemForUri(uri);
      if (!item) {
        return;
      }
      await notesTreeView.reveal(item, { select: true, focus: false, expand: true });
    } catch {
      // Gracefully ignore when view is not visible or reveal is not possible
    }
  };

  const scheduleSyncSidebarSelection = (targetUri?: vscode.Uri) => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }
    syncDebounceTimer = setTimeout(() => {
      void syncSidebarSelectionWithActiveEditor(targetUri);
    }, 150);
  };

  const globalTasksViewProvider = new GlobalTasksViewProvider(
    context,
    folderTasksService,
    () => notesTreeDataProvider.refresh(),
    () => scheduleSyncSidebarSelection(vscode.Uri.parse('janus-tasks:///all'))
  );
  const calendarDayDetailsViewProvider = new CalendarDayDetailsViewProvider(
    context,
    calendarService,
    folderTasksService,
    () => notesTreeDataProvider.refresh()
  );
  const calendarViewProvider = new CalendarViewProvider(
    context,
    calendarService,
    folderTasksService,
    () => notesTreeDataProvider.refresh(),
    calendarDayDetailsViewProvider,
    () => scheduleSyncSidebarSelection(vscode.Uri.parse('janus-calendar:///all'))
  );
  const settingsViewProvider = new SettingsViewProvider(context, aiModelService);
  const aiFolderSummaryService = new AiFolderSummaryService(aiModelService, folderTasksService);
  const folderOverviewViewProvider = new FolderOverviewViewProvider(
    context,
    aiFolderSummaryService,
    folderTasksService,
    () => notesTreeDataProvider.refresh(),
    () => companionManager.getNotesRootUri()
  );
  const exportCompendiumViewProvider = new ExportCompendiumViewProvider(context);
  const noteGraphViewProvider = new NoteGraphViewProvider(context, companionManager);
  const chatViewProvider = new ChatViewProvider(
    context,
    companionManager,
    janusSearchService,
    folderTasksService,
    aiModelService
  );
  const markdownEditor = MarkdownEditorProvider.create(
    context,
    companionManager,
    aiModelService,
    aiTaskGeneratorService,
    aiInboxSorterService,
    (uri) => scheduleSyncSidebarSelection(uri)
  );
  chatViewProvider.setDiagramApplier(markdownEditor.provider);

  let multiSelectionDebounceTimer: NodeJS.Timeout | undefined;
  const multiSelectionSub = notesTreeView.onDidChangeSelection(async (e) => {
    if (multiSelectionDebounceTimer) {
      clearTimeout(multiSelectionDebounceTimer);
    }
    if (e.selection && e.selection.length >= 2) {
      multiSelectionDebounceTimer = setTimeout(async () => {
        const status = await checkNotesRootStatus(companionManager);
        await folderOverviewViewProvider.openSelection(e.selection as any[], status.notesRootUri);
      }, 200);
    }
  });

  // 2. Diff and Review Services
  const diffContentProvider = new DiffContentProvider();
  const _noteDiffViewer = new NoteDiffViewer(diffContentProvider);

  context.subscriptions.push(
    companionWatcher,
    multiSelectionSub,
    {
      dispose: () => {
        if (multiSelectionDebounceTimer) {
          clearTimeout(multiSelectionDebounceTimer);
        }
      },
    },
    vscode.languages.registerCodeLensProvider({ language: 'markdown' }, codeLensProvider),
    vscode.workspace.registerTextDocumentContentProvider(DiffContentProvider.scheme, diffContentProvider),
    notesTreeView,
    {
      dispose: () => {
        if (syncDebounceTimer) {
          clearTimeout(syncDebounceTimer);
        }
      },
    },
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document?.uri) {
        scheduleSyncSidebarSelection(editor.document.uri);
      }
    }),
    ...(vscode.window.tabGroups?.onDidChangeTabs
      ? [
          vscode.window.tabGroups.onDidChangeTabs(() => {
            scheduleSyncSidebarSelection();
          }),
        ]
      : []),
    vscode.window.registerWebviewViewProvider(
      CalendarDayDetailsViewProvider.viewType,
      calendarDayDetailsViewProvider
    ),
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatViewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand('janus.focusChatView', async () => {
      await vscode.commands.executeCommand('janus.chatView.focus');
    }),
    TasksEditorProvider.register(context, (uri) => scheduleSyncSidebarSelection(uri)),
    ChartEditorProvider.register(context, (uri) => scheduleSyncSidebarSelection(uri)),
    markdownEditor.disposable,
    vscode.commands.registerCommand('janus.editDiagramWithAi', (diagram: DiagramContext) =>
      openChatForDiagram(chatViewProvider, diagram)
    ),
    vscode.commands.registerCommand('janus.summarizeSelection', (selection: SelectionContext) =>
      openChatForSelection(chatViewProvider, selection)
    )
  );

  // Listen to companion & note file changes to refresh tree view and context state
  context.subscriptions.push(
    companionWatcher.onDidChangeCompanion(() => {
      notesTreeDataProvider.refresh();
      globalTasksViewProvider.refresh();
      calendarViewProvider.refresh();
      calendarDayDetailsViewProvider.refresh();
      updateNotesContextKeys(companionManager);
    })
  );

  // Initial context keys update on activation
  updateNotesContextKeys(companionManager);
  void checkNotesRootStatus(companionManager).then((st) => {
    if (st.notesRootUri) {
      calendarDayDetailsViewProvider.setNotesRootUri(st.notesRootUri);
    }
    scheduleSyncSidebarSelection();
  });

  // 3. Register Language Model Tools
  if (vscode.lm && typeof vscode.lm.registerTool === 'function') {
    context.subscriptions.push(
      vscode.lm.registerTool('janus_search_notes', new SearchNotesTool(janusSearchService)),
      vscode.lm.registerTool('janus_read_note_and_companions', new ReadNoteTool(companionManager)),
      vscode.lm.registerTool('janus_mutate_tasks', new MutateTasksTool(companionManager)),
      vscode.lm.registerTool('janus_mutate_chart', new MutateChartTool(companionManager))
    );
  }

  // 4. Register Chat Participant (@janus)
  if (vscode.chat && typeof vscode.chat.createChatParticipant === 'function') {
    const chatParticipant = new JanusChatParticipant(
      companionManager,
      janusSearchService,
      folderTasksService,
      aiModelService
    );
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
    vscode.commands.registerCommand('janus.editTemplates', () => editTemplatesCommand(companionManager)),
    vscode.commands.registerCommand('janus.openDailyNote', () => openDailyNoteCommand(companionManager)),
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
      scheduleSyncSidebarSelection(vscode.Uri.parse('janus-tasks:///all'));
    }),
    vscode.commands.registerCommand('janus.openCalendar', async () => {
      const status = await checkNotesRootStatus(companionManager);
      const rootUri = status.notesRootUri;
      if (!rootUri) {
        vscode.window.showErrorMessage('Kein Notizen-Ordner im Workspace gefunden.');
        return;
      }
      await calendarViewProvider.open(rootUri);
      scheduleSyncSidebarSelection(vscode.Uri.parse('janus-calendar:///all'));
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
      scheduleSyncSidebarSelection(tasksUri);
    }),
    vscode.commands.registerCommand('janus.openNoteGraph', async () => {
      await noteGraphViewProvider.open();
      if (noteGraphViewProvider.getActivePanel()) {
        scheduleSyncSidebarSelection(vscode.Uri.parse('janus-graph:///all'));
      }
    }),
    vscode.commands.registerCommand('janus.openFolderOverview', async (item?: NotesTreeItem | vscode.Uri) => {
      let folderUri: vscode.Uri | undefined;
      if (item instanceof FolderTreeItem || item instanceof LinkedFolderTreeItem) {
        folderUri = item.uri;
      } else if (item instanceof vscode.Uri) {
        folderUri = item;
      } else if (item && typeof (item as any).resourceUri === 'object' && (item as any).resourceUri instanceof vscode.Uri) {
        folderUri = (item as any).resourceUri;
      } else if (item && typeof (item as any).uri === 'object' && (item as any).uri instanceof vscode.Uri) {
        folderUri = (item as any).uri;
      } else {
        const activeUri = getActiveNoteUri();
        if (activeUri && isMarkdownNote(activeUri.fsPath)) {
          folderUri = vscode.Uri.file(path.dirname(activeUri.fsPath));
        } else {
          const status = await checkNotesRootStatus(companionManager);
          folderUri = status.notesRootUri;
        }
      }
      if (!folderUri) {
        vscode.window.showErrorMessage('Kein Ordner für die Übersicht ausgewählt.');
        return;
      }
      await folderOverviewViewProvider.open(folderUri);
    }),
    vscode.commands.registerCommand('janus.openSettings', async () => {
      await settingsViewProvider.open();
    }),
    vscode.commands.registerCommand('janus.selectAiModel', async () => {
      await settingsViewProvider.open();
    }),
    vscode.commands.registerCommand('janus.generateTasksFromNote', async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri || !isMarkdownNote(targetUri.fsPath)) {
        vscode.window.showErrorMessage('Bitte zuerst eine Markdown-Notiz öffnen oder auswählen.');
        return;
      }
      try {
        const result = await aiTaskGeneratorService.generateTasksForNote(targetUri);
        notesTreeDataProvider.refresh();
        if (result.addedTasks.length > 0) {
          const action = await vscode.window.showInformationMessage(
            `${result.addedTasks.length} neue Aufgabe(n) wurden zum Ordner hinzugefügt.`,
            'Aufgaben öffnen'
          );
          if (action === 'Aufgaben öffnen') {
            await vscode.commands.executeCommand(
              'vscode.openWith',
              result.tasksUri,
              TasksEditorProvider.viewType
            );
          }
        } else {
          vscode.window.showInformationMessage('Keine neuen Aufgaben in dieser Notiz gefunden.');
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`KI-Aufgaben-Generierung fehlgeschlagen: ${err?.message || String(err)}`);
      }
    }),
    vscode.commands.registerCommand('janus.sortInbox', async (uri?: vscode.Uri) => {
      try {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        const result = await aiInboxSorterService.sortInbox(
          targetUri,
          vscode.window.activeTextEditor?.document
        );
        notesTreeDataProvider.refresh();
        showInboxSortResult(result);
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `KI-Inbox-Sortierung fehlgeschlagen: ${err?.message || String(err)}`
        );
      }
    }),
    vscode.commands.registerCommand('janus.setNotesRoot', setNotesRootCommand),
    vscode.commands.registerCommand('janus.resetNotesRoot', resetNotesRootCommand),
    vscode.commands.registerCommand('janus.initNotesRoot', async () => {
      await initNotesRootCommand(companionManager, notesTreeDataProvider);
    }),
    vscode.commands.registerCommand('janus.addLinkedFolder', async (uri?: vscode.Uri) => {
      await addLinkedFolderCommand(uri, notesTreeDataProvider, companionManager);
    }),
    vscode.commands.registerCommand('janus.removeLinkedFolder', async (item?: any) => {
      await removeLinkedFolderCommand(item, notesTreeDataProvider, companionManager);
    }),
    vscode.commands.registerCommand('janus.refreshNotesTree', () => {
      notesTreeDataProvider.refresh();
      updateNotesContextKeys(companionManager);
    }),
    vscode.commands.registerCommand('janus.exportNoteToPdf', async (item?: NotesTreeItem | vscode.Uri) => {
      let targetUri: vscode.Uri | undefined;
      if (item instanceof vscode.Uri) {
        targetUri = item;
      } else if (item && typeof item === 'object' && 'resourceUri' in item && (item as any).resourceUri instanceof vscode.Uri) {
        targetUri = (item as any).resourceUri;
      } else {
        targetUri = getActiveNoteUri();
      }

      if (!targetUri || !isMarkdownNote(targetUri.fsPath)) {
        vscode.window.showErrorMessage('Bitte öffnen oder wählen Sie zuerst eine Markdown-Notiz aus.');
        return;
      }

      const defaultPdfPath = targetUri.fsPath.replace(/\.(md|markdown)$/i, '.pdf');
      const defaultPdfUri = vscode.Uri.file(defaultPdfPath);

      const destinationUri = await vscode.window.showSaveDialog({
        defaultUri: defaultPdfUri,
        filters: { 'PDF Dokument': ['pdf'] },
        saveLabel: 'PDF exportieren',
        title: 'Notiz als PDF exportieren',
      });

      if (!destinationUri) {
        return;
      }

      try {
        const noteDoc = await vscode.workspace.openTextDocument(targetUri);
        const markdown = noteDoc.getText();

        const config = vscode.workspace.getConfiguration('janus.export');
        const customBrowser = config.get<string>('browserPath');

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Janus Note: PDF wird generiert...',
            cancellable: false,
          },
          async () => {
            const service = new PdfExportService(customBrowser);
            await service.exportNoteToPdf({
              markdown,
              outputPath: destinationUri.fsPath,
              noteFilePath: targetUri!.fsPath,
              title: path.basename(targetUri!.fsPath, path.extname(targetUri!.fsPath)),
            });
          }
        );

        const action = await vscode.window.showInformationMessage(
          `PDF erfolgreich exportiert: ${path.basename(destinationUri.fsPath)}`,
          'Öffnen',
          'Im Dateimanager anzeigen'
        );

        if (action === 'Öffnen') {
          await vscode.env.openExternal(destinationUri);
        } else if (action === 'Im Dateimanager anzeigen') {
          await vscode.commands.executeCommand('revealFileInOS', destinationUri);
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if (errorMsg.includes('janus.export.browserPath')) {
          const opt = await vscode.window.showErrorMessage(errorMsg, 'Einstellungen öffnen');
          if (opt === 'Einstellungen öffnen') {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'janus.export.browserPath');
          }
        } else {
          vscode.window.showErrorMessage(`Fehler beim PDF-Export: ${errorMsg}`);
        }
      }
    }),
    vscode.commands.registerCommand('janus.exportFolderToPdf', async (item?: any, allSelectedItems?: any[]) => {
      let targets: any[] = [];
      if (Array.isArray(allSelectedItems) && allSelectedItems.length > 0) {
        targets = allSelectedItems;
      } else if (item) {
        targets = [item];
      } else {
        const activeUri = getActiveNoteUri();
        if (activeUri) {
          targets = [activeUri];
        }
      }

      if (targets.length === 0) {
        vscode.window.showErrorMessage('Bitte wählen Sie einen Ordner oder Notizen für den Export aus.');
        return;
      }

      const status = await checkNotesRootStatus(companionManager);
      const noteUris = await collectMarkdownNotesFromSelection(targets);

      if (noteUris.length === 0) {
        vscode.window.showWarningMessage('Keine Markdown-Notizen im ausgewählten Bereich gefunden.');
        return;
      }

      let defaultTitle = 'Notizensammlung';
      if (targets.length === 1) {
        const target = targets[0];
        const targetUri: vscode.Uri | undefined = target instanceof vscode.Uri ? target : (target?.resourceUri || target?.uri);
        if (targetUri) {
          defaultTitle = path.basename(targetUri.fsPath);
        }
      } else {
        defaultTitle = `Auswahl (${noteUris.length} Notizen)`;
      }

      await exportCompendiumViewProvider.open(defaultTitle, noteUris, status.notesRootUri);
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('janus.notesRoot') ||
        e.affectsConfiguration('janus.initialized') ||
        e.affectsConfiguration('janus.includeFolders')
      ) {
        codeLensProvider.refresh();
        notesTreeDataProvider.refresh();
        updateNotesContextKeys(companionManager);
      }
    })
  );

  console.log('Janus Note extension successfully initialized.');
}

export function deactivate() {}

/** Attaches a diagram to the Janus chat and shows the chat (from the editor's `KI` button). */
export async function openChatForDiagram(chat: ChatViewProvider, diagram: DiagramContext): Promise<void> {
  chat.setDiagramContext(diagram);
  await vscode.commands.executeCommand('janus.chatView.focus');
  chat.focusInput();
  // From the selection popup: build the diagram from the selected text right away
  if (diagram.sourceText) {
    await chat.processUserMessage(DIAGRAM_FROM_SELECTION_REQUEST);
  }
}

/** Shows the Janus chat and summarizes the selected text there (from the editor's selection popup). */
export async function openChatForSelection(chat: ChatViewProvider, selection: SelectionContext): Promise<void> {
  await vscode.commands.executeCommand('janus.chatView.focus');
  chat.focusInput();
  await chat.startSelectionSummary(selection);
}
