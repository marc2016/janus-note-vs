import { describe, it, expect } from 'vitest';
import { parseTasksCompanion, createInitialTasksCompanion } from '../src/models/tasks';
import { parseChartCompanion, createInitialChartCompanion } from '../src/models/chart';

describe('TasksCompanion Model', () => {
  it('parses valid tasks companion JSON string', () => {
    const raw = JSON.stringify({
      version: 1,
      title: 'Sprint 1',
      tasks: [
        { id: 't1', title: 'Setup VS Code Extension', completed: false, status: 'in_progress' },
        { id: 't2', title: 'Write Tests', completed: true, status: 'done' }
      ]
    });

    const parsed = parseTasksCompanion(raw);
    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.tasks[0].title).toBe('Setup VS Code Extension');
    expect(parsed.tasks[0].status).toBe('in_progress');
    expect(parsed.tasks[1].completed).toBe(true);
  });

  it('supports legacy janus-note schema with in-progress, number IDs, and missing completed', () => {
    const legacyRaw = JSON.stringify({
      title: 'Sprint A',
      tasks: [
        { id: 1, title: 'Legacy Task 1', status: 'in-progress', priority: 'high' },
        { id: '2', title: 'Legacy Task 2', status: 'done' }
      ]
    });

    const parsed = parseTasksCompanion(legacyRaw);
    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.tasks[0].id).toBe('1');
    expect(parsed.tasks[0].status).toBe('in_progress');
    expect(parsed.tasks[0].completed).toBe(false);
    expect(parsed.tasks[1].status).toBe('done');
    expect(parsed.tasks[1].completed).toBe(true);
  });

  it('handles top-level task arrays and empty inputs gracefully', () => {
    const arrayInput = JSON.stringify([
      { id: 'a1', title: 'Array Task' }
    ]);
    const parsedArray = parseTasksCompanion(arrayInput);
    expect(parsedArray.tasks).toHaveLength(1);
    expect(parsedArray.tasks[0].title).toBe('Array Task');

    const emptyParsed = parseTasksCompanion('');
    expect(emptyParsed.tasks).toEqual([]);
  });

  it('creates default initial tasks companion', () => {
    const initial = createInitialTasksCompanion('My Notes');
    expect(initial.version).toBe(1);
    expect(initial.title).toBe('My Notes');
    expect(initial.tasks).toEqual([]);
  });

  it('supports directory-scoped task items with optional note reference and folder metadata', () => {
    const raw = JSON.stringify({
      version: 1,
      tasks: [
        {
          id: 't-folder-1',
          title: 'Review architecture document',
          completed: false,
          priority: 'high',
          note: 'architektur.md',
          folder: 'projekt-alpha',
          folderUri: 'file:///workspace/notes/projekt-alpha/tasks.json'
        },
        {
          id: 't-folder-2',
          title: 'Complete sprint retro',
          completed: true,
          priority: 'low'
        }
      ]
    });

    const parsed = parseTasksCompanion(raw);
    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.tasks[0].note).toBe('architektur.md');
    expect(parsed.tasks[0].folder).toBe('projekt-alpha');
    expect(parsed.tasks[0].priority).toBe('high');
    expect(parsed.tasks[0].status).toBe('todo');
    expect(parsed.tasks[1].completed).toBe(true);
    expect(parsed.tasks[1].status).toBe('done');
    expect(parsed.tasks[1].note).toBeUndefined();
  });

  it('preserves dueDate and scheduledDate on tasks', () => {
    const parsed = parseTasksCompanion({
      tasks: [{ id: 't1', title: 'Bericht', dueDate: '2026-11-03', scheduledDate: '2026-10-30' }],
    });
    expect(parsed.tasks[0].dueDate).toBe('2026-11-03');
    expect(parsed.tasks[0].scheduledDate).toBe('2026-10-30');
  });

  it('keeps dates when recovering partially malformed tasks', () => {
    const parsed = parseTasksCompanion({
      tasks: [{ id: 't1', title: '', dueDate: '2026-11-03', scheduledDate: '2026-10-30' }],
    });
    expect(parsed.tasks[0].title).toBe('Untitled task');
    expect(parsed.tasks[0].dueDate).toBe('2026-11-03');
    expect(parsed.tasks[0].scheduledDate).toBe('2026-10-30');
  });

  it('loads tasks without date fields unchanged', () => {
    const parsed = parseTasksCompanion({ tasks: [{ id: 't1', title: 'Ohne Datum' }] });
    expect(parsed.tasks[0].dueDate).toBeUndefined();
    expect(parsed.tasks[0].scheduledDate).toBeUndefined();
  });
});

describe('ChartCompanion Model', () => {
  it('parses valid chart companion JSON string', () => {
    const raw = JSON.stringify({
      version: 1,
      chartType: 'mermaid',
      code: 'sequenceDiagram\nAlice->>Bob: Hello'
    });

    const parsed = parseChartCompanion(raw);
    expect(parsed.chartType).toBe('mermaid');
    expect(parsed.code).toContain('sequenceDiagram');
  });

  it('supports code defined as array of string lines without escaped newlines', () => {
    const raw = JSON.stringify({
      version: 1,
      chartType: 'mermaid',
      code: [
        'sequenceDiagram',
        '    autonumber',
        '    Alice->>Bob: Hello',
        '    Bob-->>Alice: Hi!'
      ]
    });

    const parsed = parseChartCompanion(raw);
    expect(parsed.chartType).toBe('mermaid');
    expect(parsed.code).toBe('sequenceDiagram\n    autonumber\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi!');
  });

  it('creates default initial chart companion', () => {
    const initial = createInitialChartCompanion('System Flow');
    expect(initial.version).toBe(1);
    expect(initial.chartType).toBe('mermaid');
    expect(initial.code).toContain('graph TD');
  });
});
