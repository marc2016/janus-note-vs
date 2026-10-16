import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { MutateTasksTool } from '../src/agent/tools/mutateTasksTool';
import { MutateChartTool } from '../src/agent/tools/mutateChartTool';
import { ReadNoteTool } from '../src/agent/tools/readNoteTool';
import { CompanionManager } from '../src/companion/companionManager';
import { DiffContentProvider, NoteDiffViewer } from '../src/agent/diffViewer';

describe('MutateTasksTool', () => {
  it('rejects invalid schema missing action or noteUri', async () => {
    const companionManager = new CompanionManager();
    const tool = new MutateTasksTool(companionManager);

    const result = await tool.invoke(
      {
        input: {
          noteUri: '',
          action: 'invalid_action' as any,
        },
        toolInvocationToken: undefined,
      },
      {} as any
    );

    const textPart = result.content[0] as vscode.LanguageModelTextPart;
    expect(textPart.value).toContain('Schema validation error');
  });

  it('validates task payload items', async () => {
    const companionManager = new CompanionManager();
    const tool = new MutateTasksTool(companionManager);

    const result = await tool.invoke(
      {
        input: {
          noteUri: 'file:///path/to/note.md',
          action: 'add',
          tasks: [
            { id: '', title: '' } as any,
          ],
        },
        toolInvocationToken: undefined,
      },
      {} as any
    );

    const textPart = result.content[0] as vscode.LanguageModelTextPart;
    expect(textPart.value).toContain('Schema validation error');
  });

  it('successfully executes valid task additions', async () => {
    const companionManager = new CompanionManager();
    vi.spyOn(companionManager, 'readTasksCompanion').mockResolvedValue({
      version: 1,
      tasks: [],
    });
    const writeSpy = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue(undefined);

    const tool = new MutateTasksTool(companionManager);
    const result = await tool.invoke(
      {
        input: {
          noteUri: 'file:///path/to/note.md',
          action: 'add',
          tasks: [
            { id: 't1', title: 'Test Task', completed: false, status: 'todo' },
          ],
        },
        toolInvocationToken: undefined,
      },
      {} as any
    );

    const textPart = result.content[0] as vscode.LanguageModelTextPart;
    expect(textPart.value).toContain('Successfully applied');
    expect(writeSpy).toHaveBeenCalled();
  });
});

describe('MutateChartTool', () => {
  it('rejects empty code payload', async () => {
    const companionManager = new CompanionManager();
    const tool = new MutateChartTool(companionManager);

    const result = await tool.invoke(
      {
        input: {
          noteUri: 'file:///path/to/note.md',
          code: '',
        },
        toolInvocationToken: undefined,
      },
      {} as any
    );

    const textPart = result.content[0] as vscode.LanguageModelTextPart;
    expect(textPart.value).toContain('Schema validation error');
  });

  it('successfully updates diagram code', async () => {
    const companionManager = new CompanionManager();
    vi.spyOn(companionManager, 'readChartCompanion').mockResolvedValue({
      version: 1,
      chartType: 'mermaid',
      code: 'graph TD; A-->B',
    });
    const writeSpy = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue(undefined);

    const tool = new MutateChartTool(companionManager);
    const result = await tool.invoke(
      {
        input: {
          noteUri: 'file:///path/to/note.md',
          chartType: 'mermaid',
          code: 'graph LR; C-->D',
        },
        toolInvocationToken: undefined,
      },
      {} as any
    );

    const textPart = result.content[0] as vscode.LanguageModelTextPart;
    expect(textPart.value).toContain('Successfully updated chart companion');
    expect(writeSpy).toHaveBeenCalled();
  });
});

describe('ReadNoteTool', () => {
  it('reads note content and companion status', async () => {
    const companionManager = new CompanionManager();
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(Buffer.from('# My Note Content', 'utf-8'));
    vi.spyOn(companionManager, 'getCompanionStatus').mockResolvedValue({
      noteUri: vscode.Uri.file('/path/to/note.md'),
      tasksUri: vscode.Uri.file('/path/to/note.tasks.json'),
      chartUri: vscode.Uri.file('/path/to/note.chart.json'),
      tasksExist: true,
      chartExist: false,
      tasks: { version: 1, tasks: [{ id: '1', title: 'Task 1', completed: false, status: 'todo', createdAt: '' }] },
    });

    const tool = new ReadNoteTool(companionManager);
    const result = await tool.invoke(
      {
        input: {
          noteUri: 'file:///path/to/note.md',
        },
        toolInvocationToken: undefined,
      },
      {} as any
    );

    const textPart = result.content[0] as vscode.LanguageModelTextPart;
    const json = JSON.parse(textPart.value);
    expect(json.noteContent).toBe('# My Note Content');
    expect(json.hasTasksCompanion).toBe(true);
    expect(json.tasks.tasks[0].title).toBe('Task 1');
  });
});

describe('NoteDiffViewer', () => {
  it('registers and resolves virtual diff document content', () => {
    const provider = new DiffContentProvider();
    const uri = vscode.Uri.parse('janus-proposed:///test.md');
    provider.setContent(uri, 'New proposed content');

    expect(provider.provideTextDocumentContent(uri)).toBe('New proposed content');

    provider.clearContent(uri);
    expect(provider.provideTextDocumentContent(uri)).toBe('');
  });
});
