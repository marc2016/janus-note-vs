import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import { isMarkdownNote } from '../companion/companionPaths';
import { JanusSearchService } from '../services/janusSearchService';
import { FolderTasksService } from '../services/folderTasksService';
import { AiModelService } from '../services/aiModelService';
import { ReadNoteTool } from './tools/readNoteTool';
import { MutateTasksTool } from './tools/mutateTasksTool';
import { MutateChartTool } from './tools/mutateChartTool';
import { SearchNotesTool } from './tools/searchNotesTool';

const MAX_TOOL_ITERATIONS = 4;

export class JanusChatParticipant {
  public static readonly participantId = 'janus';
  private readonly localTools: Map<string, vscode.LanguageModelTool<any>>;

  constructor(
    private readonly companionManager: CompanionManager,
    private readonly searchService: JanusSearchService = new JanusSearchService(companionManager),
    private readonly folderTasksService: FolderTasksService = new FolderTasksService(),
    private readonly aiModelService?: AiModelService
  ) {
    this.localTools = new Map<string, vscode.LanguageModelTool<any>>([
      ['janus_search_notes', new SearchNotesTool(this.searchService)],
      ['janus_read_note_and_companions', new ReadNoteTool(this.companionManager)],
      ['janus_mutate_tasks', new MutateTasksTool(this.companionManager)],
      ['janus_mutate_chart', new MutateChartTool(this.companionManager)],
    ]);
  }

  public register(context: vscode.ExtensionContext): vscode.Disposable {
    const handler: vscode.ChatRequestHandler = (
      request: vscode.ChatRequest,
      chatContext: vscode.ChatContext,
      response: vscode.ChatResponseStream,
      token: vscode.CancellationToken
    ) => this.handleRequest(request, chatContext, response, token);

    const participant = vscode.chat.createChatParticipant(
      JanusChatParticipant.participantId,
      handler
    );
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'public', 'icon.png');

    return participant;
  }

  public async handleRequest(
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    const activeDoc = vscode.window.activeTextEditor?.document;

    try {
      switch (request.command) {
        case 'help':
          this.handleHelpCommand(response);
          return;
        case 'search':
          await this.handleSearchCommand(request, activeDoc, response, token);
          return;
        case 'tasks':
          await this.handleTasksCommand(request, activeDoc, response, token);
          return;
        case 'summarize':
          await this.handleSummarizeCommand(request, activeDoc, response, token);
          return;
        case 'inbox':
          await this.handleInboxCommand(request, activeDoc, response, token);
          return;
        default:
          await this.handleFreeFormChat(request, activeDoc, response, token);
          return;
      }
    } catch (err: any) {
      response.markdown(`\n\nFehler bei der Verarbeitung: ${err?.message || String(err)}`);
    }
  }

  private handleHelpCommand(response: vscode.ChatResponseStream): void {
    const helpMarkdown = [
      '### Verfügbare `@janus` Commands & KI-Funktionen',
      '',
      '| Command | Beschreibung | Beispiel |',
      '| :--- | :--- | :--- |',
      '| **`/search`** | Durchsucht alle Notizen (`meetings/`, `projects/`, `knowledge/`, `inbox.md`) und Aufgaben im Workspace und beantwortet Fragen mit Quellen-Buttons | `@janus /search Wo steht etwas zum Q3 Budget?` |',
      '| **`/tasks`** | Zeigt offene und erledigte Aufgaben über alle Ordner hinweg oder extrahiert neue Aufgaben aus der aktiven Notiz | `@janus /tasks Welche Aufgaben haben hohe Priorität?` |',
      '| **`/summarize`** | Fasst die aktuell geöffnete Notiz oder einen ganzen Projekt-Ordner strukturiert zusammen | `@janus /summarize projects/App-Launch` |',
      '| **`/inbox`** | Analysiert deine aktuellen Einträge in `inbox.md` und bietet die KI-Einsortierung an | `@janus /inbox` |',
      '| **`/help`** | Zeigt diese Übersicht aller verfügbaren Commands und Werkzeuge | `@janus /help` |',
      '',
      '**Freier Chat (ohne Slash-Command):**',
      'Du kannst `@janus` auch direkt Fragen stellen oder Aktionen auftragen (z. B. `@janus Erstelle ein Mermaid-Diagramm für diese Notiz` oder `@janus Füge eine Aufgabe hinzu`). Janus nutzt dann automatisch seine Tools (`janus_search_notes`, `janus_read_note_and_companions`, `janus_mutate_tasks`, `janus_mutate_chart`).',
    ].join('\n');

    response.markdown(helpMarkdown);

    if (typeof response.button === 'function') {
      response.button({
        command: 'janus.openAllTasks',
        title: 'Alle Aufgaben öffnen',
      });
      response.button({
        command: 'janus.sortInbox',
        title: 'Inbox mit KI einsortieren',
      });
      response.button({
        command: 'janus.openSettings',
        title: 'Janus KI-Einstellungen öffnen',
      });
    }
  }

  private async completeOrStreamWithModel(
    request: vscode.ChatRequest,
    systemPrompt: string,
    userPrompt: string,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<boolean> {
    if (request.model) {
      const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        vscode.LanguageModelChatMessage.User(userPrompt),
      ];
      const chatResponse = await request.model.sendRequest(messages, {}, token);
      for await (const fragment of chatResponse.text) {
        response.markdown(fragment);
      }
      return true;
    }

    if (this.aiModelService) {
      const output = await this.aiModelService.completePrompt(systemPrompt, userPrompt, token);
      response.markdown(output);
      return true;
    }

    response.markdown(
      '**Kein Sprachmodell verfügbar**\n\n' +
        'VS Code hat kein Sprachmodell bereitgestellt. Bitte aktiviere GitHub Copilot oder konfiguriere ein KI-Modell in den Janus-Einstellungen.'
    );
    return false;
  }

  private async handleSearchCommand(
    request: vscode.ChatRequest,
    activeDoc: vscode.TextDocument | undefined,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    response.progress('Janus durchsucht deine Notizen und Aufgaben...');

    const query = (request.prompt || '').trim();
    const searchResult = await this.searchService.searchWorkspace(query, {
      contextUri: activeDoc?.uri,
      maxNotes: 8,
      maxTasks: 10,
    });

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
      'Beantworte die Suchanfrage oder Frage des Nutzers präzise auf Basis der gefundenen Notizen und Aufgaben aus dem Workspace.',
      'Nenne bei jeder Information klar die Quell-Notiz (z.B. `projects/App-Launch/kickoff.md`), damit der Nutzer weiß, woher die Information stammt.',
      'Wenn nichts Passendes in den Notizen steht, sage das ehrlich und verweise kurz auf die vorhandenen Notizen.',
    ].join('\n');

    const userPrompt = [
      `Suchanfrage des Nutzers: ${query || '(Allgemeine Workspace-Übersicht)'}`,
      '',
      'Gefundene Notizen:',
      notesSection,
      '',
      'Gefundene Aufgaben:',
      tasksSection,
    ].join('\n');

    const ok = await this.completeOrStreamWithModel(
      request,
      systemPrompt,
      userPrompt,
      response,
      token
    );
    if (!ok) {
      return;
    }

    const notesToButton =
      searchResult.noteMatches.length > 0
        ? searchResult.noteMatches.slice(0, 5)
        : (searchResult.fallbackOverview?.notes || []).slice(0, 3);

    for (const note of notesToButton) {
      if (typeof response.button === 'function') {
        response.button({
          command: 'janus.openMarkdownEditor',
          title: `Notiz öffnen: ${note.title} (${note.relativePath})`,
          arguments: [note.uri],
        });
      }
    }

    if (searchResult.taskMatches.length > 0 && typeof response.button === 'function') {
      response.button({
        command: 'janus.openAllTasks',
        title: 'Alle Aufgaben öffnen',
      });
    }
  }

  private async handleTasksCommand(
    request: vscode.ChatRequest,
    activeDoc: vscode.TextDocument | undefined,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    response.progress('Janus lädt alle Aufgaben im Workspace...');

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

    const activeNotePath =
      activeDoc && isMarkdownNote(activeDoc.uri.fsPath) ? activeDoc.uri.fsPath : undefined;

    const systemPrompt = [
      'Du bist Janus (@janus), ein KI-Assistent für Aufgaben- und Projektmanagement in Janus Note.',
      'Beantworte die Frage des Nutzers zu seinen Aufgaben oder gib eine übersichtliche Zusammenfassung der offenen Aufgaben (gruppiert nach Ordner oder Priorität).',
    ].join('\n');

    const userPrompt = [
      `Anfrage des Nutzers: ${(request.prompt || '').trim() || 'Welche Aufgaben sind aktuell offen?'}`,
      activeNotePath ? `Aktuell geöffnete Notiz: ${activeNotePath}` : '',
      '',
      `Offene Aufgaben (${openLines.length}):`,
      openLines.length > 0 ? openLines.join('\n') : '(Keine offenen Aufgaben)',
      '',
      `Erledigte Aufgaben (${doneLines.length}):`,
      doneLines.length > 0 ? doneLines.slice(0, 15).join('\n') : '(Keine erledigten Aufgaben)',
    ]
      .filter(Boolean)
      .join('\n');

    const ok = await this.completeOrStreamWithModel(
      request,
      systemPrompt,
      userPrompt,
      response,
      token
    );
    if (!ok) {
      return;
    }

    if (typeof response.button === 'function') {
      response.button({
        command: 'janus.openAllTasks',
        title: 'Alle Aufgaben öffnen',
      });

      if (activeDoc && isMarkdownNote(activeDoc.uri.fsPath)) {
        const folderUri = vscode.Uri.file(path.dirname(activeDoc.uri.fsPath));
        response.button({
          command: 'janus.openFolderTasks',
          title: 'Ordner-Aufgaben öffnen',
          arguments: [folderUri],
        });
        response.button({
          command: 'janus.generateTasksFromNote',
          title: 'Aufgaben mit KI aus Notiz generieren',
          arguments: [activeDoc.uri],
        });
      }
    }
  }

  private async handleSummarizeCommand(
    request: vscode.ChatRequest,
    activeDoc: vscode.TextDocument | undefined,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    response.progress('Janus erstellt eine Zusammenfassung...');

    const ctx = await this.searchService.getSummarizeContext(request.prompt, activeDoc?.uri);
    if (!ctx || ctx.notes.length === 0) {
      response.markdown(
        'Keine Notiz und kein Ordner zum Zusammenfassen gefunden. Bitte öffne eine Markdown-Notiz oder gib einen Pfad an (z.B. `@janus /summarize projects/App-Launch`).'
      );
      return;
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
      'Gliedere die Antwort sinnvoll (z.B. Kernaussagen, Beschlüsse/Ergebnisse, Offene Punkte & Nächste Schritte).',
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

    const ok = await this.completeOrStreamWithModel(
      request,
      systemPrompt,
      userPrompt,
      response,
      token
    );
    if (!ok) {
      return;
    }

    if (typeof response.button === 'function') {
      for (const note of ctx.notes.slice(0, 4)) {
        response.button({
          command: 'janus.openMarkdownEditor',
          title: `Notiz öffnen: ${note.title}`,
          arguments: [note.uri],
        });
      }
      if (ctx.tasksUri) {
        const folderUri = vscode.Uri.file(path.dirname(ctx.tasksUri.fsPath));
        response.button({
          command: 'janus.openFolderTasks',
          title: 'Ordner-Aufgaben öffnen',
          arguments: [folderUri],
        });
      }
    }
  }

  private async handleInboxCommand(
    request: vscode.ChatRequest,
    activeDoc: vscode.TextDocument | undefined,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    response.progress('Janus prüft deine Inbox...');

    const inboxCtx = await this.searchService.getInboxContext(activeDoc?.uri);
    if (!inboxCtx) {
      response.markdown('Kein Notizen-Ordner im Workspace gefunden.');
      return;
    }

    if (inboxCtx.isEmpty) {
      response.markdown(
        'Deine Inbox (`inbox.md`) ist aktuell leer – es gibt keine unsortierten Einträge.'
      );
      if (inboxCtx.exists && typeof response.button === 'function') {
        response.button({
          command: 'janus.openMarkdownEditor',
          title: 'inbox.md öffnen',
          arguments: [inboxCtx.inboxUri],
        });
      }
      return;
    }

    const systemPrompt = [
      'Du bist Janus (@janus), ein KI-Assistent für die Inbox in Janus Note.',
      'Analysiere die aktuellen unsortierten Gedanken und Einträge in `inbox.md`, fasse sie thematisch übersichtlich zusammen und schlage vor, wie sie in `meetings/`, `projects/` oder `knowledge/` eingeordnet werden könnten.',
    ].join('\n');

    const userPrompt = [
      request.prompt?.trim() ? `Nutzer-Hinweis: ${request.prompt.trim()}\n` : '',
      'Aktueller Inhalt von inbox.md:',
      inboxCtx.meaningfulContent,
    ]
      .filter(Boolean)
      .join('\n');

    const ok = await this.completeOrStreamWithModel(
      request,
      systemPrompt,
      userPrompt,
      response,
      token
    );
    if (!ok) {
      return;
    }

    if (typeof response.button === 'function') {
      response.button({
        command: 'janus.sortInbox',
        title: 'Inbox mit KI einsortieren',
        arguments: [inboxCtx.inboxUri],
      });
      response.button({
        command: 'janus.openMarkdownEditor',
        title: 'inbox.md öffnen',
        arguments: [inboxCtx.inboxUri],
      });
    }
  }

  private async handleFreeFormChat(
    request: vscode.ChatRequest,
    activeDoc: vscode.TextDocument | undefined,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    let activeNoteInfo = 'No active markdown note currently open.';

    if (activeDoc && isMarkdownNote(activeDoc.uri.fsPath)) {
      const status = await this.companionManager.getCompanionStatus(activeDoc.uri);
      activeNoteInfo =
        `Active note: "${activeDoc.uri.fsPath}". ` +
        `Tasks companion exists: ${status.tasksExist}. ` +
        `Chart companion exists: ${status.chartExist}.`;
    }

    const systemPrompt = `You are Janus (@janus), an AI assistant for note-taking and project planning.
Janus Note combines:
1. Human Perspective: Clean Markdown notes for thinking and writing.
2. Agent Perspective: Schema-validated companion files (*.tasks.json, *.chart.json) for machine-operable tasks and diagrams.

Current environment:
${activeNoteInfo}

Available Janus slash commands:
- /search: Search across all notes and tasks in the workspace
- /tasks: List or manage open and completed tasks across folders
- /summarize: Summarize the active note or a folder path
- /inbox: Inspect and sort inbox.md entries
- /help: Show overview of all available commands

Available Janus tools:
- janus_search_notes: Search across all Markdown notes and folder tasks.json files in the workspace
- janus_read_note_and_companions: Read note text & attached task/chart companions
- janus_mutate_tasks: Add, update, check off, or set tasks in *.tasks.json
- janus_mutate_chart: Update or create diagram in *.chart.json

Help the user by searching their notes, reasoning about their thoughts, structuring tasks, generating diagrams, and proposing updates.`;

    const model = request.model;
    if (!model) {
      if (this.aiModelService) {
        response.progress('Janus is thinking...');
        const searchCtx = await this.searchService.searchWorkspace(request.prompt, {
          contextUri: activeDoc?.uri,
          maxNotes: 5,
          maxTasks: 6,
        });
        const contextAugmentation =
          searchCtx.noteMatches.length > 0
            ? '\n\nRelevant workspace notes:\n' +
              searchCtx.noteMatches
                .map((n) => `- ${n.title} (${n.relativePath}): ${n.snippet}`)
                .join('\n')
            : '';
        const output = await this.aiModelService.completePrompt(
          systemPrompt,
          `${request.prompt}${contextAugmentation}`,
          token
        );
        response.markdown(output);
        return;
      }

      response.markdown(
        '**No Language Model Available**\n\n' +
          'VS Code has not provided a language model. Please make sure GitHub Copilot or another Language Model provider is enabled in VS Code.'
      );
      return;
    }

    response.progress('Janus is thinking...');

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      vscode.LanguageModelChatMessage.User(request.prompt),
    ];

    const tools = (vscode.lm?.tools || []).filter((t) => t.name.startsWith('janus_'));

    for (let turn = 0; turn < MAX_TOOL_ITERATIONS; turn++) {
      const chatResponse = await model.sendRequest(
        messages,
        {
          tools: tools as any,
        },
        token
      );

      const toolCalls: Array<{
        callId: string;
        name: string;
        input: Record<string, any>;
      }> = [];

      if ((chatResponse as any).stream) {
        for await (const part of (chatResponse as any).stream) {
          if (typeof part === 'string') {
            response.markdown(part);
          } else if (
            part instanceof vscode.LanguageModelTextPart ||
            (part && typeof part.value === 'string' && !part.name)
          ) {
            response.markdown(part.value);
          } else if (
            (vscode.LanguageModelToolCallPart &&
              part instanceof vscode.LanguageModelToolCallPart) ||
            (part && typeof part.name === 'string' && part.callId)
          ) {
            toolCalls.push({
              callId: part.callId,
              name: part.name,
              input: part.input || {},
            });
          }
        }
      } else if (chatResponse.text) {
        for await (const fragment of chatResponse.text) {
          response.markdown(fragment);
        }
      }

      if (toolCalls.length === 0) {
        break;
      }

      // Execute tool calls and append results for the next model turn
      const assistantParts = toolCalls.map((tc) =>
        vscode.LanguageModelToolCallPart
          ? new vscode.LanguageModelToolCallPart(tc.callId, tc.name, tc.input)
          : tc
      );
      if (typeof vscode.LanguageModelChatMessage.Assistant === 'function') {
        messages.push(vscode.LanguageModelChatMessage.Assistant(assistantParts as any));
      }

      const resultParts: any[] = [];
      for (const tc of toolCalls) {
        const toolResult = await this.invokeJanusTool(
          tc.name,
          tc.input,
          request.toolInvocationToken,
          token
        );
        if (vscode.LanguageModelToolResultPart) {
          resultParts.push(new vscode.LanguageModelToolResultPart(tc.callId, toolResult.content));
        } else {
          const textValue = toolResult.content
            .map((c: any) => c?.value || '')
            .filter(Boolean)
            .join('\n');
          resultParts.push(textValue);
        }
      }

      if (
        resultParts.length > 0 &&
        vscode.LanguageModelToolResultPart &&
        resultParts[0] instanceof vscode.LanguageModelToolResultPart
      ) {
        messages.push(vscode.LanguageModelChatMessage.User(resultParts as any));
      } else {
        messages.push(
          vscode.LanguageModelChatMessage.User(`Tool results:\n${resultParts.join('\n\n')}`)
        );
      }
    }
  }

  private async invokeJanusTool(
    name: string,
    input: Record<string, any>,
    toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const localTool = this.localTools.get(name);
    if (localTool) {
      const res = await localTool.invoke(
        {
          input,
          toolInvocationToken,
        },
        token
      );
      if (res) {
        return res;
      }
    }

    if (vscode.lm && typeof (vscode.lm as any).invokeTool === 'function') {
      return (vscode.lm as any).invokeTool(
        name,
        {
          input,
          toolInvocationToken,
        },
        token
      );
    }

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`Unknown tool: ${name}`),
    ]);
  }
}
