import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';
import { JanusSearchService } from '../services/janusSearchService';
import { FolderTasksService } from '../services/folderTasksService';
import { AiModelService, AiModelInfo } from '../services/aiModelService';
import { MarkdownEditorProvider, MermaidReplaceResult } from './markdownEditorProvider';
import { extractMermaidCode, locateMermaidBlock } from '../services/markdownScan';

export interface ChatSourceNote {
  title: string;
  relativePath: string;
  uri: string;
  snippet: string;
}

export interface ChatAction {
  label: string;
  actionType:
    | 'openNote'
    | 'openAllTasks'
    | 'openFolderTasks'
    | 'generateTasksFromNote'
    | 'sortInbox'
    | 'openSettings'
    | 'applyDiagram'
    | 'copyDiagramCode';
  uri?: string;
  /** Diagram proposal the action refers to (`applyDiagram`, `copyDiagramCode`). */
  proposalId?: string;
}

/** The Mermaid diagram the chat is currently changing. */
export interface DiagramContext {
  noteUri: string;
  code: string;
  /** 1-based line of the opening fence. */
  line: number;
}

/** Applies a diagram proposal to the note (implemented by the Janus Markdown Editor). */
export interface DiagramApplier {
  replaceMermaidCode(uri: vscode.Uri, baseCode: string, newCode: string, line?: number): Promise<MermaidReplaceResult>;
}

interface DiagramProposal {
  noteUri: string;
  baseCode: string;
  newCode: string;
  line: number;
}

const MAX_DIAGRAM_PROPOSALS = 20;

const DIAGRAM_RESULT_TEXT: Record<MermaidReplaceResult, string> = {
  ok: 'Diagramm übernommen.',
  changed: 'Das Diagramm wurde inzwischen geändert – bitte neu anfragen.',
  invalid: 'Der Vorschlag ist kein gültiges Mermaid-Diagramm.',
  missing: 'Das Diagramm wurde nicht gefunden.',
};

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  sources?: ChatSourceNote[];
  actions?: ChatAction[];
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'janus.chatView';
  private view?: vscode.WebviewView;
  private history: ChatMessage[] = [];
  private diagramContext?: DiagramContext;
  private diagramApplier?: DiagramApplier;
  private readonly diagramProposals = new Map<string, DiagramProposal>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly companionManager: CompanionManager,
    private readonly searchService: JanusSearchService = new JanusSearchService(companionManager),
    private readonly folderTasksService: FolderTasksService = new FolderTasksService(),
    private readonly aiModelService: AiModelService = new AiModelService(context)
  ) {
    this.aiModelService.onDidChangeModel(() => {
      void this.notifyModelChange();
    });

    if (vscode.workspace && typeof vscode.workspace.onDidChangeConfiguration === 'function') {
      const configSub = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('janus.ai')) {
          void this.notifyModelChange();
        }
      });
      this.context.subscriptions.push(configSub);
    }
  }

  public setDiagramApplier(applier: DiagramApplier): void {
    this.diagramApplier = applier;
  }

  public getDiagramContext(): DiagramContext | undefined {
    return this.diagramContext;
  }

  /** Attaches a diagram to the chat; following messages are change requests for it. */
  public setDiagramContext(context: DiagramContext): void {
    this.diagramContext = context;
    this.sendDiagramContext();
  }

  public clearDiagramContext(): void {
    this.diagramContext = undefined;
    this.sendDiagramContext();
  }

  private sendDiagramContext(): void {
    if (!this.view) return;
    const context = this.diagramContext;
    void this.view.webview.postMessage({
      type: 'diagramContext',
      context: context
        ? { label: `Diagramm · ${path.basename(vscode.Uri.parse(context.noteUri).fsPath)}, Zeile ${context.line}`, line: context.line }
        : null,
    });
  }

  private addAssistantMessage(text: string, actions?: ChatAction[]): void {
    const message: ChatMessage = {
      id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'assistant',
      text,
      timestamp: Date.now(),
      actions,
    };
    this.history.push(message);
    if (this.view) {
      void this.view.webview.postMessage({ type: 'addMessage', message });
    }
  }

  public getHistory(): ChatMessage[] {
    return this.history;
  }

  public clearHistory(): void {
    this.history = [];
    if (this.view) {
      void this.view.webview.postMessage({ type: 'clearHistory' });
    }
  }

  public async notifyModelChange(): Promise<void> {
    if (!this.view) return;
    try {
      const model = await this.aiModelService.getActiveModelInfo();
      void this.view.webview.postMessage({
        type: 'updateModel',
        model,
      });
    } catch {
      // Ignore model resolution errors on change
    }
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });

    // Provide initial state once resolved
    await this.sendInitState();
  }

  public async sendInitState(): Promise<void> {
    if (!this.view) return;
    let model: AiModelInfo = {
      provider: 'vscode-lm',
      modelId: 'default',
      label: 'VS Code',
    };
    try {
      model = await this.aiModelService.getActiveModelInfo();
    } catch {
      // Fallback default
    }

    void this.view.webview.postMessage({
      type: 'init',
      model,
      history: this.history,
    });
    this.sendDiagramContext();
  }

  public async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.sendInitState();
        break;

      case 'ask':
        if (typeof message.text === 'string' && message.text.trim()) {
          await this.processUserMessage(message.text.trim());
        }
        break;

      case 'openSettings':
        await vscode.commands.executeCommand('janus.openSettings');
        break;

      case 'clearHistory':
        this.clearHistory();
        break;

      case 'clearDiagramContext':
        this.clearDiagramContext();
        break;

      case 'applyDiagram':
        await this.applyDiagramProposal(message.proposalId);
        break;

      case 'copyDiagramCode': {
        const proposal = this.diagramProposals.get(message.proposalId);
        if (proposal) {
          await vscode.env.clipboard.writeText(proposal.newCode);
          vscode.window.setStatusBarMessage('Mermaid-Code kopiert', 2500);
        }
        break;
      }

      case 'openNote':
        if (message.uri) {
          await this.openNoteUri(message.uri);
        }
        break;

      case 'openAllTasks':
        await vscode.commands.executeCommand('janus.openAllTasks');
        break;

      case 'openFolderTasks':
        if (message.uri) {
          await vscode.commands.executeCommand('janus.openFolderTasks', vscode.Uri.parse(message.uri));
        } else {
          await vscode.commands.executeCommand('janus.openAllTasks');
        }
        break;

      case 'generateTasksFromNote':
        if (message.uri) {
          await vscode.commands.executeCommand(
            'janus.generateTasksFromNote',
            vscode.Uri.parse(message.uri)
          );
        } else if (vscode.window.activeTextEditor?.document) {
          await vscode.commands.executeCommand(
            'janus.generateTasksFromNote',
            vscode.window.activeTextEditor.document.uri
          );
        }
        break;

      case 'sortInbox':
        if (message.uri) {
          await vscode.commands.executeCommand('janus.sortInbox', vscode.Uri.parse(message.uri));
        } else {
          await vscode.commands.executeCommand('janus.sortInbox');
        }
        break;
    }
  }

  private async openNoteUri(uriStr: string): Promise<void> {
    try {
      const uri = vscode.Uri.parse(uriStr);
      await vscode.commands.executeCommand('vscode.openWith', uri, MarkdownEditorProvider.viewType);
    } catch {
      try {
        const uri = vscode.Uri.parse(uriStr);
        await vscode.window.showTextDocument(uri);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Konnte Notiz nicht öffnen: ${err?.message || err}`);
      }
    }
  }

  public async processUserMessage(rawText: string): Promise<void> {
    const text = rawText.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };
    this.history.push(userMsg);
    if (this.view) {
      void this.view.webview.postMessage({ type: 'addMessage', message: userMsg });
      void this.view.webview.postMessage({ type: 'setLoading', loading: true });
    }

    try {
      const activeDoc = vscode.window.activeTextEditor?.document;
      let assistantResult: {
        text: string;
        sources?: ChatSourceNote[];
        actions?: ChatAction[];
      };

      if (this.diagramContext && !text.startsWith('/')) {
        assistantResult = await this.handleDiagramRequest(text, this.diagramContext);
      } else if (text === '/help' || text.startsWith('/help ')) {
        assistantResult = this.handleHelpCommand();
      } else if (text === '/search' || text.startsWith('/search ')) {
        const query = text.replace(/^\/search\s*/, '').trim();
        assistantResult = await this.handleSearchCommand(query, activeDoc);
      } else if (text === '/tasks' || text.startsWith('/tasks ')) {
        const filter = text.replace(/^\/tasks\s*/, '').trim();
        assistantResult = await this.handleTasksCommand(filter, activeDoc);
      } else if (text === '/summarize' || text.startsWith('/summarize ')) {
        const target = text.replace(/^\/summarize\s*/, '').trim();
        assistantResult = await this.handleSummarizeCommand(target, activeDoc);
      } else if (text === '/inbox' || text.startsWith('/inbox ')) {
        const prompt = text.replace(/^\/inbox\s*/, '').trim();
        assistantResult = await this.handleInboxCommand(prompt, activeDoc);
      } else {
        assistantResult = await this.handleFreeFormChat(text, activeDoc);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender: 'assistant',
        text: assistantResult.text,
        timestamp: Date.now(),
        sources: assistantResult.sources,
        actions: assistantResult.actions,
      };

      this.history.push(assistantMsg);
      if (this.view) {
        void this.view.webview.postMessage({ type: 'addMessage', message: assistantMsg });
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender: 'assistant',
        text: `⚠️ **Fehler bei der Anfrage:**\n\n${err?.message || String(err)}`,
        timestamp: Date.now(),
        actions: [
          {
            label: 'Janus KI-Einstellungen öffnen',
            actionType: 'openSettings',
          },
        ],
      };
      this.history.push(errorMsg);
      if (this.view) {
        void this.view.webview.postMessage({ type: 'addMessage', message: errorMsg });
      }
    } finally {
      if (this.view) {
        void this.view.webview.postMessage({ type: 'setLoading', loading: false });
      }
    }
  }

  /** Sends the diagram's current code and the request to the AI model and offers the new code. */
  private async handleDiagramRequest(
    request: string,
    context: DiagramContext
  ): Promise<{ text: string; actions?: ChatAction[] }> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(context.noteUri));
    const block = locateMermaidBlock(document.getText(), context);
    if (!block) {
      return { text: 'Das Diagramm wurde in der Notiz nicht mehr gefunden.' };
    }
    this.diagramContext = { ...context, code: block.code, line: block.line };
    this.sendDiagramContext();

    const systemPrompt = [
      'Du änderst ein bestehendes Mermaid-Diagramm in einer Notiz nach der Anweisung des Nutzers.',
      'Antworte auf Deutsch mit genau einem kurzen Satz, was du geändert hast, und danach mit genau einem Codeblock ```mermaid, der das vollständige neue Diagramm enthält.',
      'Behalte alles bei, was die Anweisung nicht betrifft. Wenn die Anweisung unklar ist, stelle eine kurze Rückfrage ohne Codeblock.',
    ].join('\n');
    const userPrompt = ['Aktuelles Diagramm:', '```mermaid', block.code, '```', '', `Anweisung: ${request}`].join('\n');
    const answer = await this.aiModelService.completePrompt(systemPrompt, userPrompt);

    const newCode = extractMermaidCode(answer);
    if (!newCode) {
      return { text: answer };
    }
    const proposalId = `diagram-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.diagramProposals.set(proposalId, {
      noteUri: context.noteUri,
      baseCode: block.code,
      newCode,
      line: block.line,
    });
    while (this.diagramProposals.size > MAX_DIAGRAM_PROPOSALS) {
      this.diagramProposals.delete(this.diagramProposals.keys().next().value!);
    }
    return {
      text: answer,
      actions: [
        { label: 'Übernehmen', actionType: 'applyDiagram', proposalId },
        { label: 'Code kopieren', actionType: 'copyDiagramCode', proposalId },
      ],
    };
  }

  private async applyDiagramProposal(proposalId: unknown): Promise<void> {
    const proposal = typeof proposalId === 'string' ? this.diagramProposals.get(proposalId) : undefined;
    if (!proposal || !this.diagramApplier) {
      this.addAssistantMessage(DIAGRAM_RESULT_TEXT.missing);
      return;
    }
    const result = await this.diagramApplier.replaceMermaidCode(
      vscode.Uri.parse(proposal.noteUri),
      proposal.baseCode,
      proposal.newCode,
      proposal.line
    );
    if (result === 'ok' && this.diagramContext?.noteUri === proposal.noteUri) {
      this.diagramContext = { ...this.diagramContext, code: proposal.newCode };
    }
    this.addAssistantMessage(DIAGRAM_RESULT_TEXT[result]);
  }

  private handleHelpCommand(): {
    text: string;
    actions: ChatAction[];
  } {
    const text = [
      '### Janus KI & Suche – Befehle & Hilfe',
      '',
      'Du kannst Fragen in natürlicher Sprache stellen oder folgende Schnellbefehle nutzen:',
      '',
      '- `/search <begriff>` – Sucht gezielt in Notizen und Aufgaben',
      '- `/tasks [filter]` – Zeigt offene und erledigte Aufgaben im Workspace',
      '- `/summarize [pfad]` – Fasst die aktive Notiz oder einen Ordner zusammen',
      '- `/inbox` – Prüft `inbox.md` und hilft beim thematischen Einsortieren',
      '- `/help` – Zeigt diese Befehlsübersicht',
      '',
      '*Tipp:* Klicke auf das Modell-Badge in der Kopfzeile, um das aktive KI-Modell oder den Provider (Ollama, Gemini, OpenAI, Anthropic) zu ändern.',
    ].join('\n');

    return {
      text,
      actions: [
        {
          label: 'Janus Einstellungen öffnen',
          actionType: 'openSettings',
        },
      ],
    };
  }

  private async handleSearchCommand(
    query: string,
    activeDoc: vscode.TextDocument | undefined
  ): Promise<{
    text: string;
    sources?: ChatSourceNote[];
    actions?: ChatAction[];
  }> {
    const searchResult = await this.searchService.searchWorkspace(query, {
      contextUri: activeDoc?.uri,
      maxNotes: 6,
      maxTasks: 10,
    });

    const sources: ChatSourceNote[] = searchResult.noteMatches.map((n) => ({
      title: n.title,
      relativePath: n.relativePath,
      uri: n.uri.toString(),
      snippet: n.snippet,
    }));

    const actions: ChatAction[] = [];
    if (searchResult.taskMatches.length > 0) {
      actions.push({
        label: 'Alle Aufgaben öffnen',
        actionType: 'openAllTasks',
      });
    }

    const notesSection =
      searchResult.noteMatches.length > 0
        ? searchResult.noteMatches
            .map(
              (n, i) =>
                `[${i + 1}] Notiz: "${n.title}" (${n.relativePath})\nAuszug:\n${n.snippet}`
            )
            .join('\n\n---\n\n')
        : searchResult.fallbackOverview && searchResult.fallbackOverview.notes.length > 0
          ? 'Keine direkten Keyword-Treffer. Übersicht vorhandener Notizen im Workspace:\n' +
            searchResult.fallbackOverview.notes
              .map((n) => `- ${n.title} (${n.relativePath}): ${n.preview}`)
              .join('\n')
          : '(Keine passenden Notizen im Workspace gefunden)';

    const tasksSection =
      searchResult.taskMatches.length > 0
        ? searchResult.taskMatches
            .map(
              (t) =>
                `- [${t.completed ? 'x' : ' '}] ${t.title} (Ordner: ${t.folder}, Priorität: ${t.priority})`
            )
            .join('\n')
        : searchResult.fallbackOverview && searchResult.fallbackOverview.openTasks.length > 0
          ? 'Offene Aufgaben im Workspace:\n' +
            searchResult.fallbackOverview.openTasks
              .map((t) => `- [ ] ${t.title} (Ordner: ${t.folder}, Priorität: ${t.priority})`)
              .join('\n')
          : '(Keine passenden Aufgaben gefunden)';

    const systemPrompt = [
      'Du bist Janus (@janus), ein KI-Assistent für Notizen und Aufgaben in Janus Note.',
      'Beantworte die Suchanfrage des Nutzers präzise auf Basis der gefundenen Notizen und Aufgaben.',
      'Nenne bei jeder Information klar die Quell-Notiz.',
      'Wenn nichts Passendes in den Notizen steht, sage das ehrlich.',
    ].join('\n');

    const userPrompt = [
      `Suchanfrage: ${query || '(Workspace-Übersicht)'}`,
      '',
      'Gefundene Notizen:',
      notesSection,
      '',
      'Gefundene Aufgaben:',
      tasksSection,
    ].join('\n');

    let answerText = '';
    try {
      answerText = await this.aiModelService.completePrompt(systemPrompt, userPrompt);
    } catch (err: any) {
      answerText =
        `**Suchergebnisse (${searchResult.noteMatches.length} Notizen, ${searchResult.taskMatches.length} Aufgaben gefunden):**\n\n` +
        `*(Hinweis: KI-Zusammenfassung nicht verfügbar: ${err?.message || err})*`;
    }

    return {
      text: answerText,
      sources: sources.length > 0 ? sources : undefined,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  private async handleTasksCommand(
    filter: string,
    activeDoc: vscode.TextDocument | undefined
  ): Promise<{
    text: string;
    sources?: ChatSourceNote[];
    actions?: ChatAction[];
  }> {
    const notesRootUri = this.companionManager.getNotesRootUri(activeDoc?.uri);
    const groups = notesRootUri ? await this.folderTasksService.loadAllTasks(notesRootUri) : [];

    const openLines: string[] = [];
    const doneLines: string[] = [];

    for (const group of groups) {
      for (const task of group.tasks) {
        const line = `- [${task.completed ? 'x' : ' '}] ${task.title} (Ordner: ${group.folder}, Status: ${task.status}, Priorität: ${task.priority || 'medium'}${task.note ? `, Notiz: ${task.note}` : ''})`;
        if (task.completed || task.status === 'done') {
          doneLines.push(line);
        } else {
          openLines.push(line);
        }
      }
    }

    const actions: ChatAction[] = [
      {
        label: 'Alle Aufgaben öffnen',
        actionType: 'openAllTasks',
      },
    ];

    if (activeDoc && isMarkdownNote(activeDoc.uri.fsPath)) {
      const folderUri = vscode.Uri.file(path.dirname(activeDoc.uri.fsPath));
      actions.push({
        label: 'Ordner-Aufgaben öffnen',
        actionType: 'openFolderTasks',
        uri: folderUri.toString(),
      });
      actions.push({
        label: 'Aufgaben aus Notiz generieren',
        actionType: 'generateTasksFromNote',
        uri: activeDoc.uri.toString(),
      });
    }

    const systemPrompt = [
      'Du bist Janus (@janus), ein KI-Assistent für Aufgaben- und Projektmanagement in Janus Note.',
      'Beantworte die Frage des Nutzers zu seinen Aufgaben oder gib eine übersichtliche Zusammenfassung der offenen Aufgaben (gruppiert nach Ordner oder Priorität).',
    ].join('\n');

    const userPrompt = [
      `Anfrage: ${filter || 'Welche Aufgaben sind aktuell offen?'}`,
      '',
      `Offene Aufgaben (${openLines.length}):`,
      openLines.length > 0 ? openLines.join('\n') : '(Keine offenen Aufgaben)',
      '',
      `Erledigte Aufgaben (${doneLines.length}):`,
      doneLines.length > 0 ? doneLines.slice(0, 15).join('\n') : '(Keine erledigten Aufgaben)',
    ].join('\n');

    let answerText = '';
    try {
      answerText = await this.aiModelService.completePrompt(systemPrompt, userPrompt);
    } catch (err: any) {
      answerText =
        `### Aufgaben-Übersicht\n\n` +
        `**Offen (${openLines.length}):**\n` +
        (openLines.length > 0 ? openLines.slice(0, 10).join('\n') : 'Keine offenen Aufgaben') +
        (openLines.length > 10 ? `\n... und ${openLines.length - 10} weitere` : '');
    }

    return {
      text: answerText,
      actions,
    };
  }

  private async handleSummarizeCommand(
    target: string,
    activeDoc: vscode.TextDocument | undefined
  ): Promise<{
    text: string;
    sources?: ChatSourceNote[];
    actions?: ChatAction[];
  }> {
    const ctx = await this.searchService.getSummarizeContext(target, activeDoc?.uri);
    if (!ctx || ctx.notes.length === 0) {
      return {
        text: 'Keine Notiz und kein Ordner zum Zusammenfassen gefunden. Bitte öffne eine Markdown-Notiz oder gib einen Pfad an (z. B. `/summarize projects/App-Launch`).',
      };
    }

    const sources: ChatSourceNote[] = ctx.notes.map((n) => ({
      title: n.title,
      relativePath: n.relativePath,
      uri: n.uri.toString(),
      snippet: n.content.slice(0, 160).replace(/\n/g, ' '),
    }));

    const actions: ChatAction[] = [];
    if (ctx.tasksUri) {
      const folderUri = vscode.Uri.file(path.dirname(ctx.tasksUri.fsPath));
      actions.push({
        label: 'Ordner-Aufgaben öffnen',
        actionType: 'openFolderTasks',
        uri: folderUri.toString(),
      });
    }

    const notesContent = ctx.notes
      .map((n) => `### Datei: ${n.relativePath}\n\n${n.content}`)
      .join('\n\n---\n\n');

    const tasksContent =
      ctx.tasks.length > 0
        ? ctx.tasks
            .map(
              (t) =>
                `- [${t.completed ? 'x' : ' '}] ${t.title} (Status: ${t.status}, Priorität: ${t.priority || 'medium'})`
            )
            .join('\n')
        : '(Keine Aufgaben im Ordner hinterlegt)';

    const systemPrompt = [
      'Du bist Janus (@janus), ein KI-Assistent für strukturierte Zusammenfassungen in Janus Note.',
      'Erstelle eine klare, gut gegliederte Zusammenfassung der angegebenen Notiz(en) und zugehörigen Aufgaben.',
      'Gliedere die Antwort sinnvoll (z.B. Kernaussagen, Ergebnisse, Offene Punkte & Nächste Schritte).',
    ].join('\n');

    const userPrompt = [
      `Ziel (${ctx.targetType === 'folder' ? 'Ordner' : 'Notiz'}): ${ctx.targetLabel}`,
      '',
      'Notiz-Inhalte:',
      notesContent,
      '',
      'Zugehörige Ordner-Aufgaben:',
      tasksContent,
    ].join('\n');

    let answerText = '';
    try {
      answerText = await this.aiModelService.completePrompt(systemPrompt, userPrompt);
    } catch (err: any) {
      answerText = `Zusammenfassung konnte nicht erstellt werden: ${err?.message || err}`;
    }

    return {
      text: answerText,
      sources,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  private async handleInboxCommand(
    prompt: string,
    activeDoc: vscode.TextDocument | undefined
  ): Promise<{
    text: string;
    sources?: ChatSourceNote[];
    actions?: ChatAction[];
  }> {
    const inboxCtx = await this.searchService.getInboxContext(activeDoc?.uri);
    if (!inboxCtx) {
      return {
        text: 'Kein Notizen-Ordner im Workspace gefunden.',
      };
    }

    if (inboxCtx.isEmpty) {
      return {
        text: 'Deine Inbox (`inbox.md`) ist aktuell leer – es gibt keine unsortierten Einträge.',
        actions: inboxCtx.exists
          ? [
              {
                label: 'inbox.md öffnen',
                actionType: 'openNote',
                uri: inboxCtx.inboxUri.toString(),
              },
            ]
          : undefined,
      };
    }

    const sources: ChatSourceNote[] = [
      {
        title: 'inbox.md',
        relativePath: 'inbox.md',
        uri: inboxCtx.inboxUri.toString(),
        snippet: inboxCtx.meaningfulContent.slice(0, 160).replace(/\n/g, ' '),
      },
    ];

    const actions: ChatAction[] = [
      {
        label: 'Inbox mit KI einsortieren',
        actionType: 'sortInbox',
        uri: inboxCtx.inboxUri.toString(),
      },
      {
        label: 'inbox.md öffnen',
        actionType: 'openNote',
        uri: inboxCtx.inboxUri.toString(),
      },
    ];

    const systemPrompt = [
      'Du bist Janus (@janus), ein KI-Assistent für die Inbox in Janus Note.',
      'Analysiere die aktuellen unsortierten Gedanken und Einträge in `inbox.md`, fasse sie thematisch übersichtlich zusammen und schlage vor, wie sie in Ordner (z.B. meetings, projects, knowledge) eingeordnet werden könnten.',
    ].join('\n');

    const userPrompt = [
      prompt ? `Nutzer-Hinweis: ${prompt}\n` : '',
      'Aktueller Inhalt von inbox.md:',
      inboxCtx.meaningfulContent,
    ]
      .filter(Boolean)
      .join('\n');

    let answerText = '';
    try {
      answerText = await this.aiModelService.completePrompt(systemPrompt, userPrompt);
    } catch (err: any) {
      answerText =
        `**Inhalt von inbox.md:**\n\n` +
        inboxCtx.meaningfulContent +
        `\n\n*(Hinweis: KI-Analyse nicht verfügbar: ${err?.message || err})*`;
    }

    return {
      text: answerText,
      sources,
      actions,
    };
  }

  private async handleFreeFormChat(
    question: string,
    activeDoc: vscode.TextDocument | undefined
  ): Promise<{
    text: string;
    sources?: ChatSourceNote[];
    actions?: ChatAction[];
  }> {
    const searchCtx = await this.searchService.searchWorkspace(question, {
      contextUri: activeDoc?.uri,
      maxNotes: 5,
      maxTasks: 6,
    });

    const sources: ChatSourceNote[] = searchCtx.noteMatches.map((n) => ({
      title: n.title,
      relativePath: n.relativePath,
      uri: n.uri.toString(),
      snippet: n.snippet,
    }));

    const actions: ChatAction[] = [];
    if (searchCtx.taskMatches.length > 0) {
      actions.push({
        label: 'Alle Aufgaben öffnen',
        actionType: 'openAllTasks',
      });
    }

    let activeNoteInfo = 'No active markdown note currently open.';
    if (activeDoc && isMarkdownNote(activeDoc.uri.fsPath)) {
      const status = await this.companionManager.getCompanionStatus(activeDoc.uri);
      activeNoteInfo =
        `Active note: "${activeDoc.uri.fsPath}". ` +
        `Tasks companion: ${status.tasksExist}, Chart companion: ${status.chartExist}.`;
    }

    const contextAugmentation =
      searchCtx.noteMatches.length > 0
        ? '\n\nRelevant workspace notes:\n' +
          searchCtx.noteMatches
            .map((n) => `- ${n.title} (${n.relativePath}): ${n.snippet}`)
            .join('\n')
        : '';

    const tasksAugmentation =
      searchCtx.taskMatches.length > 0
        ? '\n\nRelevant tasks:\n' +
          searchCtx.taskMatches
            .map((t) => `- [${t.completed ? 'x' : ' '}] ${t.title} (${t.folder})`)
            .join('\n')
        : '';

    const systemPrompt = [
      'You are Janus (@janus), an AI assistant for note-taking and project planning in Janus Note.',
      'Help the user by answering questions based on their notes and tasks.',
      `Current environment: ${activeNoteInfo}`,
      'Reference relevant notes when answering.',
    ].join('\n');

    const userPrompt = `${question}${contextAugmentation}${tasksAugmentation}`;

    const answerText = await this.aiModelService.completePrompt(systemPrompt, userPrompt);

    return {
      text: answerText,
      sources: sources.length > 0 ? sources : undefined,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'chat.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Janus KI & Suche</title>
  <link rel="stylesheet" href="${styleUri}">
  <style>
    html, body {
      height: 100% !important;
      overflow: hidden !important;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body class="bg-[var(--vscode-sideBar-background,#252526)] text-[var(--vscode-sideBar-foreground,#cccccc)] antialiased font-sans select-none overflow-hidden h-full">
  <div id="root" class="h-full flex flex-col"></div>
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

