import * as vscode from 'vscode';
import { JanusSearchService } from '../../services/janusSearchService';

export interface SearchNotesToolInput {
  query: string;
  maxResults?: number;
}

export class SearchNotesTool implements vscode.LanguageModelTool<SearchNotesToolInput> {
  constructor(private readonly searchService: JanusSearchService) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SearchNotesToolInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const query = (options.input?.query || '').trim();
    const maxNotes = options.input?.maxResults ?? 8;

    try {
      const result = await this.searchService.searchWorkspace(query, {
        maxNotes,
        maxTasks: 10,
      });

      const payload = {
        query: result.query,
        tokens: result.tokens,
        noteMatches: result.noteMatches.map((n) => ({
          title: n.title,
          relativePath: n.relativePath,
          uri: n.uri.toString(),
          score: n.score,
          snippet: n.snippet,
          headings: n.headings,
        })),
        taskMatches: result.taskMatches.map((t) => ({
          id: t.id,
          title: t.title,
          completed: t.completed,
          status: t.status,
          priority: t.priority,
          folder: t.folder,
          note: t.note,
          tasksUri: t.tasksUri.toString(),
          score: t.score,
        })),
        ...(result.fallbackOverview
          ? {
              fallbackOverview: {
                totalNotes: result.fallbackOverview.totalNotes,
                totalOpenTasks: result.fallbackOverview.totalOpenTasks,
                notes: result.fallbackOverview.notes.map((n) => ({
                  title: n.title,
                  relativePath: n.relativePath,
                  uri: n.uri.toString(),
                  preview: n.preview,
                })),
                openTasks: result.fallbackOverview.openTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                  priority: t.priority,
                  folder: t.folder,
                  tasksUri: t.tasksUri.toString(),
                })),
              },
            }
          : {}),
      };

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(payload, null, 2)),
      ]);
    } catch (err: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error searching Janus notes and tasks: ${err?.message || String(err)}`
        ),
      ]);
    }
  }
}

