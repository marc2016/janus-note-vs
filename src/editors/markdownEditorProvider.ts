import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';
import {
  findMarkdownNotesInRoot,
  findMarkdownNotesInRoots,
  getNoteLinksData,
  loadAliasIndex,
  resolveOutgoingLink,
  findLinkCandidatesAcrossRoots,
  parseLinkTargetAndLine,
} from '../services/noteLinkService';
import { findLinkCandidatesInRoot } from '../companion/noteLinking';
import { AiModelService } from '../services/aiModelService';
import { AiTaskGeneratorService } from '../services/aiTaskGeneratorService';
import { AiInboxSorterService, SortInboxResult } from '../services/aiInboxSorterService';
import { TasksEditorProvider } from './tasksEditorProvider';
import { ChartEditorProvider } from './chartEditorProvider';
import { WebviewSyncTracker } from './webviewSyncTracker';
import { isDailyNotePath } from '../services/dailyNotePaths';
import { resolveSortedLinks } from '../services/sortedLinkService';
import { saveImageNextToNote, validateImage } from '../services/imageAssetService';
import { findFencedBlocks, locateMermaidBlock } from '../services/markdownScan';

/**
 * Reports the outcome of an inbox sorting run, shared by the `janus.sortInbox` command and the
 * editor footer button.
 */
export function showInboxSortResult(result: SortInboxResult): void {
  if (result.cancelled) {
    return;
  }
  const isDaily = result.source === 'daily';
  if (result.skippedEmpty) {
    void vscode.window.showInformationMessage(
      isDaily
        ? 'Die Tagesnotiz enthält keine neuen Einträge zum Einsortieren.'
        : 'Die Inbox (inbox.md) ist leer – es gibt keine Einträge zum Einsortieren.'
    );
    return;
  }

  const changedHint =
    result.skippedChanged.length > 0
      ? ` ${result.skippedChanged.length} Abschnitt(e) wurden währenddessen geändert und nicht ${isDaily ? 'kopiert' : 'verschoben'}.`
      : '';

  if (result.sortedItems.length > 0) {
    const firstTarget = result.sortedItems[0];
    const summary = isDaily
      ? `${result.sortedItems.length} Abschnitt(e) einsortiert und verlinkt.`
      : `${result.sortedItems.length} Abschnitt(e) einsortiert, ${result.remainingBlockCount} in der Inbox verblieben.`;
    void vscode.window
      .showInformationMessage(
        `${summary}${changedHint}`,
        'Notiz öffnen'
      )
      .then((action) => {
        if (action === 'Notiz öffnen') {
          void vscode.commands.executeCommand(
            'vscode.openWith',
            firstTarget.targetUri,
            MarkdownEditorProvider.viewType
          );
        }
      });
  } else if (changedHint) {
    void vscode.window.showInformationMessage(`Keine Abschnitte einsortiert.${changedHint}`);
  } else {
    void vscode.window.showInformationMessage(
      `Keine sortierbaren Abschnitte in der ${isDaily ? 'Tagesnotiz' : 'Inbox'} erkannt.`
    );
  }
}

export type MermaidReplaceResult = 'ok' | 'changed' | 'missing' | 'invalid';

/** Webview messages that change or save the document and must be handled in arrival order. */
const ORDERED_MESSAGE_TYPES = new Set(['updateContent', 'save']);
export type InsertTextResult = 'ok' | 'changed' | 'missing';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'janus.markdownEditor';
  private readonly aiModelService: AiModelService;
  private readonly aiTaskGeneratorService: AiTaskGeneratorService;
  private readonly aiInboxSorterService: AiInboxSorterService;

  private readonly _onDidChangeActiveCustomEditor = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChangeActiveCustomEditor = this._onDidChangeActiveCustomEditor.event;

  private readonly _activePanels = new Map<string, vscode.WebviewPanel>();
  private readonly _syncTrackers = new WeakMap<vscode.WebviewPanel, WebviewSyncTracker>();
  private readonly _pendingLineReveals = new Map<string, number>();
  private readonly _readyPanels = new Set<string>();
  private readonly _orderedQueues = new WeakMap<vscode.WebviewPanel, Promise<void>>();
  private readonly _readyWaiters = new Map<string, Array<() => void>>();
  private readonly _pendingMermaidReplacements = new Map<number, (result: MermaidReplaceResult) => void>();
  private readonly _pendingTextInsertions = new Map<number, (result: InsertTextResult) => void>();
  private _mermaidRequestId = 0;

  public setPendingLineReveal(uri: vscode.Uri, line: number): void {
    this._pendingLineReveals.set(uri.toString(), line);
  }

  public getOpenWebviewPanel(uri: vscode.Uri): vscode.WebviewPanel | undefined {
    return this._activePanels.get(uri.toString());
  }

  private static readonly _lineHighlightDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    borderWidth: '0 0 0 4px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('focusBorder'),
  });

  private highlightLineInTextEditor(editor: vscode.TextEditor, range: vscode.Range): void {
    editor.setDecorations(MarkdownEditorProvider._lineHighlightDecorationType, [range]);

    const highlightTime = Date.now();
    const disposable = vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor === editor) {
        if (Date.now() - highlightTime > 300) {
          editor.setDecorations(MarkdownEditorProvider._lineHighlightDecorationType, []);
          disposable.dispose();
        }
      }
    });
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly companionManager: CompanionManager = new CompanionManager(),
    aiModelService?: AiModelService,
    aiTaskGeneratorService?: AiTaskGeneratorService,
    aiInboxSorterService?: AiInboxSorterService
  ) {
    this.aiModelService = aiModelService || new AiModelService(context);
    this.aiTaskGeneratorService =
      aiTaskGeneratorService || new AiTaskGeneratorService(this.aiModelService);
    this.aiInboxSorterService =
      aiInboxSorterService ||
      new AiInboxSorterService(this.aiModelService, this.companionManager);
  }

  public static register(
    context: vscode.ExtensionContext,
    companionManager?: CompanionManager,
    aiModelService?: AiModelService,
    aiTaskGeneratorService?: AiTaskGeneratorService,
    aiInboxSorterService?: AiInboxSorterService,
    onActiveChange?: (uri: vscode.Uri) => void
  ): vscode.Disposable {
    return MarkdownEditorProvider.create(
      context,
      companionManager,
      aiModelService,
      aiTaskGeneratorService,
      aiInboxSorterService,
      onActiveChange
    ).disposable;
  }

  /** Like `register`, but also returns the provider so other features can reach open editors. */
  public static create(
    context: vscode.ExtensionContext,
    companionManager?: CompanionManager,
    aiModelService?: AiModelService,
    aiTaskGeneratorService?: AiTaskGeneratorService,
    aiInboxSorterService?: AiInboxSorterService,
    onActiveChange?: (uri: vscode.Uri) => void
  ): { provider: MarkdownEditorProvider; disposable: vscode.Disposable } {
    const provider = new MarkdownEditorProvider(
      context,
      companionManager,
      aiModelService,
      aiTaskGeneratorService,
      aiInboxSorterService
    );
    if (onActiveChange) {
      provider.onDidChangeActiveCustomEditor(onActiveChange);
    }
    const disposable = vscode.window.registerCustomEditorProvider(MarkdownEditorProvider.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    });
    return { provider, disposable };
  }

  /** Which kind of sorting the footer offers for a note: `inbox.md`, a daily note, or none. */
  getSortSource(uri: vscode.Uri): 'inbox' | 'daily' | undefined {
    const notesRoot = this.companionManager.getNotesRootUri(uri);
    if (!notesRoot) {
      return undefined;
    }
    const relPath = path.relative(notesRoot.fsPath, uri.fsPath).replace(/\\/g, '/');
    if (relPath.toLowerCase() === 'inbox.md') {
      return 'inbox';
    }
    return isDailyNotePath(relPath) ? 'daily' : undefined;
  }

  private waitForReadyPanel(uri: vscode.Uri, timeoutMs: number): Promise<vscode.WebviewPanel | undefined> {
    const key = uri.toString();
    if (this._readyPanels.has(key)) {
      return Promise.resolve(this._activePanels.get(key));
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(undefined), timeoutMs);
      const waiters = this._readyWaiters.get(key) ?? [];
      waiters.push(() => {
        clearTimeout(timer);
        resolve(this._activePanels.get(key));
      });
      this._readyWaiters.set(key, waiters);
    });
  }

  /**
   * Replaces the code of the Mermaid block whose code is `baseCode` with `newCode`, through the
   * editor webview (one undoable edit). Opens the note if needed. Never overwrites a block that
   * changed since the proposal was made, and never inserts invalid Mermaid.
   */
  async replaceMermaidCode(
    uri: vscode.Uri,
    baseCode: string,
    newCode: string,
    line = 1,
    timeoutMs = 10000
  ): Promise<MermaidReplaceResult> {
    const document = await vscode.workspace.openTextDocument(uri);
    const block = locateMermaidBlock(document.getText(), { code: baseCode, line });
    if (!block || block.code.trim() !== baseCode.trim()) {
      return 'changed';
    }

    if (!this._activePanels.has(uri.toString())) {
      await vscode.commands.executeCommand('vscode.openWith', uri, MarkdownEditorProvider.viewType);
    }
    const panel = await this.waitForReadyPanel(uri, timeoutMs);
    if (!panel) {
      return 'missing';
    }

    const requestId = ++this._mermaidRequestId;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._pendingMermaidReplacements.delete(requestId);
        resolve('missing');
      }, timeoutMs);
      this._pendingMermaidReplacements.set(requestId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      void panel.webview.postMessage({
        type: 'replaceMermaidCode',
        requestId,
        codeFrom: block.codeFrom,
        codeTo: block.codeTo,
        baseCode: block.code,
        newCode,
      });
    });
  }

  /**
   * Inserts `insert` on its own lines after the text `anchorText` (the occurrence nearest to
   * `line`), through the editor webview as one undoable edit. Opens the note if needed.
   */
  async insertAfterText(
    uri: vscode.Uri,
    anchorText: string,
    insert: string,
    line = 1,
    timeoutMs = 10000
  ): Promise<InsertTextResult> {
    const document = await vscode.workspace.openTextDocument(uri);
    if (!document.getText().includes(anchorText)) {
      return 'changed';
    }
    if (!this._activePanels.has(uri.toString())) {
      await vscode.commands.executeCommand('vscode.openWith', uri, MarkdownEditorProvider.viewType);
    }
    const panel = await this.waitForReadyPanel(uri, timeoutMs);
    if (!panel) {
      return 'missing';
    }
    const requestId = ++this._mermaidRequestId;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._pendingTextInsertions.delete(requestId);
        resolve('missing');
      }, timeoutMs);
      this._pendingTextInsertions.set(requestId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      void panel.webview.postMessage({ type: 'insertAfterText', requestId, anchorText, insert, line });
    });
  }

  /**
   * Entry point for webview messages. Document edits and saves of one panel are handled strictly
   * in order, so a save never runs before the edits sent just before it are applied. Other
   * messages (AI requests, navigation) start right away and do not hold up the queue.
   */
  receiveWebviewMessage(
    message: any,
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    ...rest: [(() => void)?, (() => Promise<void>)?, (() => Promise<void>)?]
  ): Promise<void> {
    const handle = () => this.handleWebviewMessage(message, document, webviewPanel, ...rest);
    if (!ORDERED_MESSAGE_TYPES.has(message?.type)) {
      return handle();
    }
    const previous = this._orderedQueues.get(webviewPanel) ?? Promise.resolve();
    const next = previous.then(handle, handle);
    this._orderedQueues.set(webviewPanel, next.catch(() => undefined));
    return next;
  }

  /** `dist` plus all notes roots and workspace folders, so images inside the workspace can load. */
  getLocalResourceRoots(noteUri: vscode.Uri): vscode.Uri[] {
    const roots = [vscode.Uri.joinPath(this.context.extensionUri, 'dist')];
    const notesRoots = this.companionManager.getAllNotesRoots?.(noteUri) ?? [];
    const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri);
    for (const uri of [...notesRoots, ...workspaceRoots]) {
      if (!roots.some((r) => r.toString() === uri.toString())) {
        roots.push(uri);
      }
    }
    return roots;
  }

  /** Base URIs the webview needs to resolve image paths of this note. */
  getImageContext(
    webview: vscode.Webview,
    noteUri: vscode.Uri
  ): { imageBaseUri: string; workspaceRoots: Array<{ fsPath: string; webviewUri: string }> } {
    return {
      imageBaseUri: webview.asWebviewUri(vscode.Uri.file(path.dirname(noteUri.fsPath))).toString(),
      workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map((f) => ({
        fsPath: f.uri.fsPath,
        webviewUri: webview.asWebviewUri(f.uri).toString(),
      })),
    };
  }

  /** Sends display data for the `-> [[target]]` lines of a daily note to the webview. */
  async sendSortedLinks(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    const notesRoot = this.companionManager.getNotesRootUri(document.uri);
    if (!notesRoot) return;
    const date = isDailyNotePath(path.relative(notesRoot.fsPath, document.uri.fsPath).replace(/\\/g, '/'));
    if (!date) return;
    const links = await resolveSortedLinks(document.getText(), notesRoot, date);
    void webviewPanel.webview.postMessage({ type: 'sortedLinks', links });
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: this.getLocalResourceRoots(document.uri),
    };

    this._activePanels.set(document.uri.toString(), webviewPanel);

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

    const updateWebview = () => {
      try {
        const text = document.getText();
        void webviewPanel.webview.postMessage({
          type: 'init',
          content: text,
          ...this.getImageContext(webviewPanel.webview, document.uri),
        });
      } catch (err: any) {
        void webviewPanel.webview.postMessage({
          type: 'error',
          message: 'Error loading markdown: ' + (err?.message || String(err)),
        });
      }
    };

    const sendLinksUpdate = async () => {
      try {
        const [linksData, aiModel] = await Promise.all([
          getNoteLinksData(document.uri, document.getText(), this.companionManager),
          this.aiModelService.getActiveModelInfo(),
        ]);
        linksData.aiModel = aiModel;
        void webviewPanel.webview.postMessage({
          type: 'updateLinks',
          linksData,
        });
        void this.sendSortedLinks(document, webviewPanel);
      } catch (err) {
        console.warn('Failed to compute note links data:', err);
      }
    };

    const sendCandidatesUpdate = async () => {
      try {
        const roots = this.companionManager.getAllNotesRoots
          ? this.companionManager.getAllNotesRoots(document.uri)
          : (this.companionManager.getNotesRootUri(document.uri) ? [this.companionManager.getNotesRootUri(document.uri)!] : []);
        const primaryRoot = this.companionManager.getNotesRootUri(document.uri);
        if (roots.length > 0) {
          const candidates = await findLinkCandidatesAcrossRoots(roots, 6, primaryRoot);
          void webviewPanel.webview.postMessage({
            type: 'updateLinkCandidates',
            candidates,
          });
        }
      } catch (err) {
        console.warn('Failed to compute link candidates:', err);
      }
    };

    webviewPanel.webview.onDidReceiveMessage((message) =>
      this.receiveWebviewMessage(message, document, webviewPanel, updateWebview, sendLinksUpdate, sendCandidatesUpdate)
    );

    const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument((saved) => {
      if (saved.uri.toString() === document.uri.toString()) {
        void webviewPanel.webview.postMessage({ type: 'dirtyState', dirty: saved.isDirty });
      }
    });

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        const text = e.document.getText();
        const tracker = this.getSyncTracker(webviewPanel);
        if (tracker.shouldForward(text)) {
          void webviewPanel.webview.postMessage({
            type: 'update',
            content: text,
            ackSeq: tracker.lastAppliedSeq,
          });
        }
        void webviewPanel.webview.postMessage({ type: 'dirtyState', dirty: e.document.isDirty });
        void sendLinksUpdate();
      }
    });

    const aiModelChangeSubscription = this.aiModelService.onDidChangeModel(() => {
      void sendLinksUpdate();
    });

    const configChangeSubscription = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('janus.ai')) {
        void sendLinksUpdate();
      }
    });

    const companionWatcher = vscode.workspace.createFileSystemWatcher(
      '**/{tasks.json,*.tasks.json,*.chart.json,*.md,*.png,*.jpg,*.jpeg,*.svg,*.pdf}'
    );
    const refreshLinksOnFs = () => {
      void sendLinksUpdate();
      void sendCandidatesUpdate();
    };
    const subCreate = companionWatcher.onDidCreate(refreshLinksOnFs);
    const subChange = companionWatcher.onDidChange(refreshLinksOnFs);
    const subDelete = companionWatcher.onDidDelete(refreshLinksOnFs);

    const viewStateSubscription = webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        this._onDidChangeActiveCustomEditor.fire(document.uri);
      }
    });

    if (webviewPanel.active) {
      this._onDidChangeActiveCustomEditor.fire(document.uri);
    }

    webviewPanel.onDidDispose(() => {
      this._activePanels.delete(document.uri.toString());
      this._readyPanels.delete(document.uri.toString());
      this._pendingLineReveals.delete(document.uri.toString());
      viewStateSubscription.dispose();
      changeDocumentSubscription.dispose();
      saveDocumentSubscription.dispose();
      aiModelChangeSubscription.dispose();
      configChangeSubscription.dispose();
      subCreate.dispose();
      subChange.dispose();
      subDelete.dispose();
      companionWatcher.dispose();
    });

    updateWebview();
    void sendLinksUpdate();
    void sendCandidatesUpdate();
  }

  private getSyncTracker(panel: vscode.WebviewPanel): WebviewSyncTracker {
    let tracker = this._syncTrackers.get(panel);
    if (!tracker) {
      tracker = new WebviewSyncTracker();
      this._syncTrackers.set(panel, tracker);
    }
    return tracker;
  }

  public async handleWebviewMessage(
    message: any,
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    updateWebview?: () => void,
    sendLinksUpdate?: () => Promise<void>,
    sendCandidatesUpdate?: () => Promise<void>
  ): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    if (message.type === 'ready') {
      void webviewPanel.webview.postMessage({ type: 'dirtyState', dirty: Boolean(document.isDirty) });
      const key = document.uri.toString();
      this._readyPanels.add(key);
      this._readyWaiters.get(key)?.forEach((resolve) => resolve());
      this._readyWaiters.delete(key);
      updateWebview?.();
      void webviewPanel.webview.postMessage({ type: 'sortSource', source: this.getSortSource(document.uri) ?? null });
      if (sendLinksUpdate) {
        void sendLinksUpdate();
      } else {
        const [linksData, aiModel] = await Promise.all([
          getNoteLinksData(document.uri, document.getText(), this.companionManager),
          this.aiModelService.getActiveModelInfo(),
        ]);
        linksData.aiModel = aiModel;
        void webviewPanel.webview.postMessage({
          type: 'updateLinks',
          linksData,
        });
      }
      if (sendCandidatesUpdate) {
        void sendCandidatesUpdate();
      } else {
        const roots = this.companionManager.getAllNotesRoots
          ? this.companionManager.getAllNotesRoots(document.uri)
          : (this.companionManager.getNotesRootUri(document.uri) ? [this.companionManager.getNotesRootUri(document.uri)!] : []);
        const primaryRoot = this.companionManager.getNotesRootUri(document.uri);
        if (roots.length > 0) {
          const candidates = await findLinkCandidatesAcrossRoots(roots, 6, primaryRoot);
          void webviewPanel.webview.postMessage({
            type: 'updateLinkCandidates',
            candidates,
          });
        }
      }

      const pending = this._pendingLineReveals.get(document.uri.toString());
      if (pending !== undefined) {
        this._pendingLineReveals.delete(document.uri.toString());
        void webviewPanel.webview.postMessage({
          type: 'revealLine',
          line: pending,
        });
      }
      return;
    }

    if (message.type === 'selectAiModel') {
      await vscode.commands.executeCommand('janus.openSettings');
      return;
    }

    if (message.type === 'generateAiTasks') {
      void webviewPanel.webview.postMessage({
        type: 'aiTasksGenerating',
        isGenerating: true,
      });
      try {
        const result = await this.aiTaskGeneratorService.generateTasksForNote(
          document.uri,
          document.getText()
        );
        void webviewPanel.webview.postMessage({
          type: 'aiTasksGenerating',
          isGenerating: false,
        });
        if (sendLinksUpdate) {
          void sendLinksUpdate();
        }
        if (result.addedTasks.length > 0) {
          void vscode.window
            .showInformationMessage(
              `${result.addedTasks.length} neue Aufgabe(n) wurden zum Ordner hinzugefügt.`,
              'Aufgaben öffnen'
            )
            .then((action) => {
              if (action === 'Aufgaben öffnen') {
                void vscode.commands.executeCommand(
                  'vscode.openWith',
                  result.tasksUri,
                  TasksEditorProvider.viewType
                );
              }
            });
        } else {
          void vscode.window.showInformationMessage(
            'Keine neuen Aufgaben in dieser Notiz gefunden (oder bereits im Ordner vorhanden).'
          );
        }
      } catch (err: any) {
        void webviewPanel.webview.postMessage({
          type: 'aiTasksGenerating',
          isGenerating: false,
        });
        if (sendLinksUpdate) {
          void sendLinksUpdate();
        }
        const msg = err?.message || String(err);
        void vscode.window
          .showErrorMessage(
            `KI-Aufgaben-Generierung fehlgeschlagen: ${msg}`,
            'KI-Modell konfigurieren'
          )
          .then((choice) => {
            if (choice === 'KI-Modell konfigurieren') {
              void vscode.commands.executeCommand('janus.openSettings');
            }
          });
      }
      return;
    }

    if (message.type === 'saveImage' && typeof message.mime === 'string') {
      const fileName = typeof message.fileName === 'string' ? message.fileName : undefined;
      // Without data the webview already found the image unacceptable (or could not read it)
      const result =
        typeof message.data === 'string'
          ? await saveImageNextToNote(document.uri, {
              data: Buffer.from(message.data, 'base64'),
              mime: message.mime,
              fileName,
            }).catch((err: any) => ({ reason: `Das Bild konnte nicht gespeichert werden: ${err?.message || String(err)}` }))
          : { reason: validateImage(message.mime, Number(message.size) || 0, fileName) ?? 'Das Bild konnte nicht gelesen werden.' };
      if ('relPath' in result) {
        void webviewPanel.webview.postMessage({ type: 'imageSaved', requestId: message.requestId, relPath: result.relPath });
        void vscode.commands.executeCommand('janus.refreshNotesTree');
      } else {
        void webviewPanel.webview.postMessage({ type: 'imageRejected', requestId: message.requestId, reason: result.reason });
        void vscode.window.showWarningMessage(result.reason);
      }
      return;
    }

    if (message.type === 'textInserted' && typeof message.requestId === 'number') {
      this._pendingTextInsertions.get(message.requestId)?.(message.result);
      this._pendingTextInsertions.delete(message.requestId);
      return;
    }

    if (message.type === 'save') {
      try {
        await document.save();
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Notiz konnte nicht gespeichert werden: ${err?.message || String(err)}`);
      }
      void webviewPanel.webview.postMessage({ type: 'dirtyState', dirty: Boolean(document.isDirty) });
      return;
    }

    if (message.type === 'mermaidCodeReplaced' && typeof message.requestId === 'number') {
      this._pendingMermaidReplacements.get(message.requestId)?.(message.result);
      this._pendingMermaidReplacements.delete(message.requestId);
      return;
    }

    if (
      (message.type === 'editDiagramWithAi' || message.type === 'diagramFromSelection') &&
      typeof message.blockFrom === 'number'
    ) {
      // A block inserted in the webview reaches the document through the sync a moment later
      const findBlock = () =>
        findFencedBlocks(document.getText()).find((b) => b.info === 'mermaid' && b.from === message.blockFrom);
      let block = findBlock();
      for (let attempt = 0; !block && attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        block = findBlock();
      }
      const text = document.getText();
      if (block) {
        await vscode.commands.executeCommand('janus.editDiagramWithAi', {
          noteUri: document.uri.toString(),
          code: block.code,
          line: text.slice(0, block.from).split('\n').length,
          ...(message.type === 'diagramFromSelection' && typeof message.text === 'string'
            ? { sourceText: message.text }
            : {}),
        });
      }
      return;
    }

    if (message.type === 'summarizeSelection' && typeof message.text === 'string') {
      await vscode.commands.executeCommand('janus.summarizeSelection', {
        noteUri: document.uri.toString(),
        text: message.text,
        fromLine: Number(message.fromLine) || 1,
        toLine: Number(message.toLine) || Number(message.fromLine) || 1,
      });
      return;
    }

    if (message.type === 'sortAiInbox') {
      const sortSource = this.getSortSource(document.uri);
      if (!sortSource) {
        return;
      }
      void webviewPanel.webview.postMessage({
        type: 'aiInboxSorting',
        isSorting: true,
      });
      try {
        const result =
          sortSource === 'daily'
            ? await this.aiInboxSorterService.sortDailyNote(document.uri, document)
            : await this.aiInboxSorterService.sortInbox(document.uri, document);
        void webviewPanel.webview.postMessage({
          type: 'aiInboxSorting',
          isSorting: false,
        });
        updateWebview?.();
        if (sendLinksUpdate) {
          void sendLinksUpdate();
        }
        showInboxSortResult(result);
      } catch (err: any) {
        void webviewPanel.webview.postMessage({
          type: 'aiInboxSorting',
          isSorting: false,
        });
        if (sendLinksUpdate) {
          void sendLinksUpdate();
        }
        const msg = err?.message || String(err);
        void vscode.window
          .showErrorMessage(
            `${sortSource === 'daily' ? 'KI-Sortierung der Tagesnotiz' : 'KI-Inbox-Sortierung'} fehlgeschlagen: ${msg}`,
            'KI-Modell konfigurieren'
          )
          .then((choice) => {
            if (choice === 'KI-Modell konfigurieren') {
              void vscode.commands.executeCommand('janus.openSettings');
            }
          });
      }
      return;
    }

    if (message.type === 'openSource') {
      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      });
      return;
    }

    if (message.type === 'exportPdf') {
      await vscode.commands.executeCommand('janus.exportNoteToPdf', document.uri);
      return;
    }

    if (message.type === 'openLink' && typeof message.targetUri === 'string') {
      const rawTarget = message.targetUri.trim();
      if (!rawTarget) {
        return;
      }

      // External URLs & mailto
      if (/^https?:\/\//i.test(rawTarget) || /^mailto:/i.test(rawTarget)) {
        await vscode.env.openExternal(vscode.Uri.parse(rawTarget));
        return;
      }

      const parsed = parseLinkTargetAndLine(rawTarget);
      const cleanTarget = parsed.cleanTarget;
      const targetLine = typeof message.lineNumber === 'number' ? message.lineNumber : parsed.lineNumber;

      if (!cleanTarget) {
        return;
      }

      if (/^https?:\/\//i.test(cleanTarget) || /^mailto:/i.test(cleanTarget)) {
        await vscode.env.openExternal(vscode.Uri.parse(cleanTarget));
        return;
      }

      const notesRootUri = this.companionManager.getNotesRootUri(document.uri);
      let targetUri: vscode.Uri;
      let exists = false;

      if (cleanTarget.startsWith('file://')) {
        targetUri = vscode.Uri.parse(cleanTarget);
        try {
          await vscode.workspace.fs.stat(targetUri);
          exists = true;
        } catch {
          exists = false;
        }
      } else if (path.isAbsolute(cleanTarget)) {
        targetUri = vscode.Uri.file(cleanTarget);
        try {
          await vscode.workspace.fs.stat(targetUri);
          exists = true;
        } catch {
          exists = false;
        }
      } else {
        const workspaceNotes = notesRootUri ? await findMarkdownNotesInRoot(notesRootUri) : [];
        const aliasIndex = await loadAliasIndex(
          await findMarkdownNotesInRoots(this.companionManager.getAllNotesRoots(document.uri))
        );
        const resolved = await resolveOutgoingLink(
          {
            raw: cleanTarget,
            target: cleanTarget,
            label: cleanTarget,
            type: message.linkType === 'markdown' ? 'markdown' : 'wiki',
          },
          document.uri,
          notesRootUri,
          workspaceNotes,
          aliasIndex
        );
        targetUri = vscode.Uri.parse(resolved.uri);
        exists = resolved.exists;
      }

      // If target note does not exist, prompt user to confirm creation
      if (!exists) {
        if (isMarkdownNote(targetUri.fsPath)) {
          const baseTitle = path.basename(targetUri.fsPath).replace(/\.(md|markdown)$/i, '');
          const choice = await vscode.window.showInformationMessage(
            `Notiz '${baseTitle}' existiert nicht. Jetzt erstellen?`,
            'Erstellen',
            'Abbrechen'
          );
          if (choice !== 'Erstellen') {
            return;
          }
          try {
            await vscode.workspace.fs.createDirectory(
              vscode.Uri.file(path.dirname(targetUri.fsPath))
            );
          } catch {
            // parent directory might already exist
          }
          await vscode.workspace.fs.writeFile(
            targetUri,
            Buffer.from(`# ${baseTitle}\n\n`, 'utf-8')
          );
        } else {
          void vscode.window.showErrorMessage(
            `Datei '${path.basename(targetUri.fsPath)}' existiert nicht.`
          );
          return;
        }
      }

      let viewType = message.viewType as string | undefined;
      if (!viewType) {
        if (targetUri.fsPath.endsWith('tasks.json')) {
          viewType = TasksEditorProvider.viewType;
        } else if (targetUri.fsPath.endsWith('.chart.json')) {
          viewType = ChartEditorProvider.viewType;
        } else if (isMarkdownNote(targetUri.fsPath)) {
          viewType = MarkdownEditorProvider.viewType;
        }
      }

      if (viewType === MarkdownEditorProvider.viewType || isMarkdownNote(targetUri.fsPath)) {
        if (targetLine !== undefined) {
          this.setPendingLineReveal(targetUri, targetLine);
          const existingPanel = this.getOpenWebviewPanel(targetUri);
          if (existingPanel) {
            void existingPanel.webview.postMessage({
              type: 'revealLine',
              line: targetLine,
            });
          }
        }
        await vscode.commands.executeCommand('vscode.openWith', targetUri, MarkdownEditorProvider.viewType);
      } else if (viewType) {
        await vscode.commands.executeCommand('vscode.openWith', targetUri, viewType);
      } else {
        // Non-markdown file: open with showTextDocument if line number is specified
        if (targetLine !== undefined) {
          try {
            const doc = await vscode.workspace.openTextDocument(targetUri);
            const lineIndex = Math.max(0, Math.min(targetLine - 1, doc.lineCount - 1));
            const line = doc.lineAt(lineIndex);
            const editor = await vscode.window.showTextDocument(doc, {
              selection: line.range,
              preview: false,
            });
            editor.revealRange(line.range, vscode.TextEditorRevealType.InCenter);
            this.highlightLineInTextEditor(editor, line.range);
            return;
          } catch {
            // fallback
          }
        }
        await vscode.commands.executeCommand('vscode.open', targetUri);
      }
      return;
    }

    if (message.type === 'createCompanion' && typeof message.companionType === 'string') {
      if (message.companionType === 'tasks') {
        const folderUri = vscode.Uri.file(path.dirname(document.uri.fsPath));
        const notesRootUri = this.companionManager.getNotesRootUri(document.uri);
        if (notesRootUri && path.resolve(folderUri.fsPath) === path.resolve(notesRootUri.fsPath)) {
          await vscode.commands.executeCommand('janus.openAllTasks');
        } else {
          await vscode.commands.executeCommand('janus.openFolderTasks', folderUri);
        }
      } else if (message.companionType === 'chart') {
        await vscode.commands.executeCommand('janus.createChartCompanion', document.uri);
      }
      if (sendLinksUpdate) {
        void sendLinksUpdate();
      }
      return;
    }

    if (message.type === 'addLink') {
      const notesRootUri = this.companionManager.getNotesRootUri(document.uri);
      if (!notesRootUri) {
        return;
      }

      const allNotes = await findMarkdownNotesInRoot(notesRootUri);
      const candidates = allNotes.filter((u) => u.fsPath !== document.uri.fsPath);

      const items: (vscode.QuickPickItem & { noteName: string })[] = candidates.map((u) => {
        const baseName = path.basename(u.fsPath).replace(/\.(md|markdown)$/i, '');
        const relPath = path.relative(notesRootUri.fsPath, u.fsPath).replace(/\\/g, '/');
        return {
          label: baseName,
          description: relPath,
          noteName: baseName,
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Notiz zum Verknüpfen auswählen...',
      });

      if (!selected) {
        return;
      }

      const currentText = document.getText();
      const prefix = currentText.length === 0 || currentText.endsWith('\n') ? '' : '\n';
      const updatedText = `${currentText}${prefix}[[${selected.noteName}]]\n`;

      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(currentText.length)
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, fullRange, updatedText);
      await vscode.workspace.applyEdit(edit);

      if (sendLinksUpdate) {
        await sendLinksUpdate();
      }
      return;
    }

    if (message.type === 'updateContent') {
      try {
        const newText = message.content;
        if (typeof newText !== 'string') {
          return;
        }
        const tracker = this.getSyncTracker(webviewPanel);
        if (newText === document.getText()) {
          // Nothing to apply, but acknowledge the seq so later updates are not treated as stale.
          tracker.acknowledgeSeq(message.seq);
          return;
        }
        tracker.recordWebviewEdit(newText, message.seq);
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );

        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange, newText);
        await vscode.workspace.applyEdit(edit);

        if (sendLinksUpdate) {
          await sendLinksUpdate();
        }
      } catch (error: any) {
        vscode.window.showErrorMessage('Failed to update markdown file: ' + error.message);
      }
    }
  }

  private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'markdown.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );
    const nonce = getNonce();

    const initialContent = document.getText() || '';
    const mermaidScriptUri = webview
      .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'mermaid.min.js'))
      .toString();
    const initialJson = JSON.stringify({ content: initialContent, mermaidScriptUri }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Janus Markdown Editor</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body class="bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] antialiased m-0 p-0 overflow-hidden">
  <script id="initial-data" type="application/json">${initialJson}</script>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
