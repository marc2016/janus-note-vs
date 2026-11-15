import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { LinkedTaskSync, LinkedTaskSyncCore, LinkedTaskSyncIO } from '../src/services/linkedTaskSync';
import { TasksCompanion } from '../src/models/tasks';

/** In-memory notes collection: file system paths to file contents. */
function setup(initial: Record<string, string | object>) {
  const files = new Map<string, string>();
  for (const [p, content] of Object.entries(initial)) {
    files.set(p, typeof content === 'string' ? content : JSON.stringify(content));
  }
  const writes: string[] = [];
  const noteEdits: string[] = [];
  const io: LinkedTaskSyncIO = {
    readText: async (p) => files.get(p),
    writeTasks: async (p, companion: TasksCompanion) => {
      writes.push(p);
      files.set(p, JSON.stringify(companion));
    },
    editNoteLines: async (p, changes) => {
      noteEdits.push(p);
      const lines = files.get(p)!.split('\n');
      for (const c of changes) lines[c.line] = c.text;
      files.set(p, lines.join('\n'));
    },
    listTaskFiles: async () => [...files.keys()].filter((p) => p.endsWith('/tasks.json')),
  };
  const core = new LinkedTaskSyncCore(io);
  const tasks = (p: string) => JSON.parse(files.get(p)!).tasks as any[];
  const task = (p: string, id: string) => tasks(p).find((t) => t.id === id);
  /** Saves a note: updates its content and runs the note-to-list sync. */
  const saveNote = async (p: string, text: string) => {
    files.set(p, text);
    await core.syncNote(p, text);
  };
  /** Simulates a task list change: rewrites the task file and reports it. */
  const changeTasks = async (p: string, update: (tasks: any[]) => any[]) => {
    const companion = JSON.parse(files.get(p)!);
    companion.tasks = update(companion.tasks);
    files.set(p, JSON.stringify(companion));
    await core.tasksFileChanged(p, files.get(p)!);
  };
  return { files, writes, noteEdits, core, tasks, task, saveNote, changeTasks };
}

const existing = (extra: object = {}) => ({
  version: 1,
  title: 'Aufgaben: projects',
  tasks: [
    {
      id: 't-7f3a9k',
      title: 'Angebot schicken',
      completed: false,
      status: 'todo',
      priority: 'high',
      dueDate: '2026-11-20',
      note: 'plan.md',
      ...extra,
    },
  ],
});

describe('note to task list', () => {
  it('creates a task for a new linked line', async () => {
    const env = setup({});
    await env.core.initialize();
    await env.saveNote('/n/projects/plan.md', '# Plan\n- [ ] Angebot schicken ^t-7f3a9k');
    expect(env.task('/n/projects/tasks.json', 't-7f3a9k')).toMatchObject({
      title: 'Angebot schicken',
      completed: false,
      priority: 'medium',
      note: 'plan.md',
    });
  });

  it('copies the done state and title from the line and keeps dates and priority', async () => {
    const env = setup({ '/n/projects/tasks.json': existing() });
    await env.core.initialize();
    await env.saveNote('/n/projects/plan.md', '- [x] Angebot an Kunde schicken ^t-7f3a9k');
    expect(env.task('/n/projects/tasks.json', 't-7f3a9k')).toMatchObject({
      title: 'Angebot an Kunde schicken',
      completed: true,
      status: 'done',
      priority: 'high',
      dueDate: '2026-11-20',
    });
  });

  it('keeps an in-progress status while the line is not done', async () => {
    const env = setup({ '/n/projects/tasks.json': existing({ status: 'in_progress' }) });
    await env.core.initialize();
    await env.saveNote('/n/projects/plan.md', '- [ ] Angebot schicken ^t-7f3a9k');
    expect(env.writes).toEqual([]);
  });

  it('moves a task with all fields when its line is in a note of another folder', async () => {
    const env = setup({ '/n/projects/tasks.json': existing() });
    await env.core.initialize();
    await env.saveNote('/n/meetings/weekly.md', '- [ ] Angebot schicken ^t-7f3a9k');
    expect(env.tasks('/n/projects/tasks.json')).toEqual([]);
    expect(env.task('/n/meetings/tasks.json', 't-7f3a9k')).toMatchObject({
      note: 'weekly.md',
      priority: 'high',
      dueDate: '2026-11-20',
    });
  });

  it('leaves tasks unchanged when their line is removed, and ignores empty titles', async () => {
    const env = setup({ '/n/projects/tasks.json': existing() });
    await env.core.initialize();
    await env.saveNote('/n/projects/plan.md', '# Plan\n- [ ]  ^t-aaaaaa');
    expect(env.writes).toEqual([]);
    expect(env.tasks('/n/projects/tasks.json')).toHaveLength(1);
  });

  it('writes nothing when nothing changed', async () => {
    const env = setup({ '/n/projects/tasks.json': existing() });
    await env.core.initialize();
    await env.saveNote('/n/projects/plan.md', '- [ ] Angebot schicken ^t-7f3a9k');
    expect(env.writes).toEqual([]);
  });

  it('never overwrites an unreadable task file', async () => {
    const env = setup({ '/n/projects/tasks.json': '{ broken' });
    await env.core.initialize();
    await env.saveNote('/n/projects/plan.md', '- [ ] Neu ^t-aaaaaa');
    expect(env.writes).toEqual([]);
    expect(env.files.get('/n/projects/tasks.json')).toBe('{ broken');
  });
});

describe('task list to note', () => {
  let env: ReturnType<typeof setup>;
  beforeEach(async () => {
    env = setup({
      '/n/projects/tasks.json': existing(),
      '/n/projects/plan.md': '# Plan\n  - [ ] Angebot schicken ^t-7f3a9k\nText',
    });
    await env.core.initialize();
  });

  it('writes completion and renames back to the line', async () => {
    await env.changeTasks('/n/projects/tasks.json', (t) => [{ ...t[0], completed: true, status: 'done' }]);
    expect(env.files.get('/n/projects/plan.md')).toBe('# Plan\n  - [x] Angebot schicken ^t-7f3a9k\nText');
    await env.changeTasks('/n/projects/tasks.json', (t) => [{ ...t[0], title: 'Angebot final schicken' }]);
    expect(env.files.get('/n/projects/plan.md')).toBe('# Plan\n  - [x] Angebot final schicken ^t-7f3a9k\nText');
  });

  it('keeps a title the user already changed in the note over the list\'s old state', async () => {
    env.files.set('/n/projects/plan.md', '# Plan\n  - [ ] Angebot schicken an Kunde ^t-7f3a9k\nText');
    await env.changeTasks('/n/projects/tasks.json', (t) => [{ ...t[0], title: 'Angebot alt', completed: true }]);
    expect(env.files.get('/n/projects/plan.md')).toBe('# Plan\n  - [x] Angebot schicken an Kunde ^t-7f3a9k\nText');
  });

  it('does not touch the note for date or priority changes', async () => {
    await env.changeTasks('/n/projects/tasks.json', (t) => [{ ...t[0], priority: 'low', dueDate: '2026-12-01' }]);
    expect(env.noteEdits).toEqual([]);
  });

  it('removes only the ID when a linked task is deleted, and does not recreate it on save', async () => {
    await env.changeTasks('/n/projects/tasks.json', () => []);
    expect(env.files.get('/n/projects/plan.md')).toBe('# Plan\n  - [ ] Angebot schicken\nText');
    await env.saveNote('/n/projects/plan.md', env.files.get('/n/projects/plan.md')!);
    expect(env.tasks('/n/projects/tasks.json')).toEqual([]);
  });

  it('changes nothing when the note or the line does not exist', async () => {
    await env.changeTasks('/n/projects/tasks.json', (t) => [{ ...t[0], note: 'fehlt.md', completed: true }]);
    expect(env.noteEdits).toEqual([]);
  });

  it('does not loop back after a note save wrote the task file', async () => {
    await env.saveNote('/n/projects/plan.md', '# Plan\n  - [x] Angebot schicken ^t-7f3a9k\nText');
    await env.core.tasksFileChanged('/n/projects/tasks.json', env.files.get('/n/projects/tasks.json')!);
    expect(env.noteEdits).toEqual([]);
  });

  it('does not treat a task moved to another folder as deleted', async () => {
    await env.saveNote('/n/meetings/weekly.md', '- [ ] Angebot schicken ^t-7f3a9k');
    await env.core.tasksFileChanged('/n/projects/tasks.json', env.files.get('/n/projects/tasks.json')!);
    expect(env.noteEdits).toEqual([]);
    expect(env.files.get('/n/projects/plan.md')).toContain('^t-7f3a9k');
  });

  it('ignores task files that disappeared', async () => {
    env.core.forgetTasksFile('/n/projects/tasks.json');
    await env.core.tasksFileChanged('/n/projects/tasks.json', JSON.stringify({ tasks: [] }));
    expect(env.noteEdits).toEqual([]);
  });

  it('ignores tasks that are not linked task IDs', async () => {
    const other = setup({
      '/n/x/tasks.json': { tasks: [{ id: 't-mhz1k2-ab12', title: 'KI', note: 'a.md' }] },
      '/n/x/a.md': '- [ ] KI ^t-abcdef',
    });
    await other.core.initialize();
    await other.changeTasks('/n/x/tasks.json', (t) => [{ ...t[0], completed: true }]);
    expect(other.noteEdits).toEqual([]);
  });
});

describe('reading task files', () => {
  it('reads an open but unmodified tasks.json from disk, where our own writes are current', async () => {
    (vscode.workspace as any).textDocuments = [
      { uri: vscode.Uri.file('/n/p/tasks.json'), isDirty: false, getText: () => 'stale' },
      { uri: vscode.Uri.file('/n/p/edit.json'), isDirty: false, getText: () => 'open' },
    ];
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(Buffer.from('disk'));
    const sync = new LinkedTaskSync(() => vscode.Uri.file('/n'));
    expect(await (sync as any).readText('/n/p/tasks.json')).toBe('disk');
    (vscode.workspace as any).textDocuments[0].isDirty = true;
    expect(await (sync as any).readText('/n/p/tasks.json')).toBe('stale');
    sync.dispose();
    (vscode.workspace as any).textDocuments = [];
    vi.restoreAllMocks();
  });
});

describe('writing to open notes', () => {
  function openDoc(text: string, isDirty: boolean) {
    const lines = text.split('\n');
    return {
      uri: vscode.Uri.file('/n/projects/plan.md'),
      isDirty,
      getText: () => text,
      lineAt: (n: number) => ({ range: new vscode.Range(new vscode.Position(n, 0), new vscode.Position(n, lines[n].length)) }),
      save: vi.fn(async () => true),
    };
  }

  it('edits only the changed line of an open note and keeps it unsaved when it was dirty', async () => {
    const doc = openDoc('# Plan\n- [ ] A ^t-7f3a9k\nungespeichert', true);
    (vscode.workspace as any).textDocuments = [doc];
    const applyEdit = vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
    const sync = new LinkedTaskSync(() => vscode.Uri.file('/n'));
    await (sync as any).editNoteLines('/n/projects/plan.md', [{ line: 1, text: '- [x] A ^t-7f3a9k' }]);
    const edit = applyEdit.mock.calls[0][0] as any;
    expect(edit.entries).toHaveLength(1);
    expect(edit.entries[0].newText).toBe('- [x] A ^t-7f3a9k');
    expect(edit.entries[0].range.start.line).toBe(1);
    expect(doc.save).not.toHaveBeenCalled();

    const clean = openDoc('# Plan\n- [ ] A ^t-7f3a9k', false);
    (vscode.workspace as any).textDocuments = [clean];
    await (sync as any).editNoteLines('/n/projects/plan.md', [{ line: 1, text: '- [x] A ^t-7f3a9k' }]);
    expect(clean.save).toHaveBeenCalled();
    sync.dispose();
    (vscode.workspace as any).textDocuments = [];
  });
});
