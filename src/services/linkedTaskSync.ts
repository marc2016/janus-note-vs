import * as path from 'path';
import * as vscode from 'vscode';
import { parseTasksCompanion, TaskItem, TaskItemSchema, TasksCompanion } from '../models/tasks';
import { FolderTasksService } from './folderTasksService';
import { parseLinkedTaskLines, removeLinkedTaskId, rewriteLinkedTaskLine } from './linkedTaskLines';

/** Task IDs created for linked task lines; other tasks are never linked to a note line. */
const LINKED_ID_RE = /^t-[a-z0-9]{6}$/;

/** File access used by the sync, so the logic can be tested without VS Code. Paths are file system paths. */
export interface LinkedTaskSyncIO {
  /** Current text of a file: the open document's text if it is open, otherwise the file on disk. */
  readText(filePath: string): Promise<string | undefined>;
  writeTasks(tasksPath: string, companion: TasksCompanion): Promise<void>;
  /** Replaces whole lines (zero-based) of a note. */
  editNoteLines(notePath: string, changes: Array<{ line: number; text: string }>): Promise<void>;
  listTaskFiles(): Promise<string[]>;
}

interface LinkedTaskState {
  title: string;
  completed: boolean;
  note?: string;
}

type NoteLineChange = { id: string; title?: string; done?: boolean; remove?: boolean; was?: LinkedTaskState };

function linkedState(companion: TasksCompanion): Map<string, LinkedTaskState> {
  const state = new Map<string, LinkedTaskState>();
  for (const task of companion.tasks) {
    if (LINKED_ID_RE.test(task.id)) {
      state.set(task.id, { title: task.title, completed: Boolean(task.completed), note: task.note });
    }
  }
  return state;
}

function tryParse(text: string | undefined): TasksCompanion | null {
  try {
    return parseTasksCompanion(text ?? '');
  } catch {
    return null;
  }
}

/**
 * Keeps linked task lines in notes and their tasks in `tasks.json` in sync: notes are synced into the
 * task files on save, changes of linked tasks in task files are written back to the note lines.
 */
export class LinkedTaskSyncCore {
  /** Last known linked tasks per task file, used to detect list-side changes and to avoid loops. */
  private readonly snapshots = new Map<string, Map<string, LinkedTaskState>>();

  constructor(private readonly io: LinkedTaskSyncIO) {}

  /** Records the current state of all task files, so later changes can be detected. */
  async initialize(): Promise<void> {
    for (const tasksPath of await this.io.listTaskFiles()) {
      const companion = tryParse(await this.io.readText(tasksPath));
      if (companion) this.snapshots.set(tasksPath, linkedState(companion));
    }
  }

  /** Note to task list: creates, updates and moves the tasks of the note's linked task lines. */
  async syncNote(notePath: string, text: string): Promise<void> {
    const lines = parseLinkedTaskLines(text).filter((l) => l.title.length > 0);
    if (lines.length === 0) return;

    const folder = path.dirname(notePath);
    const tasksPath = path.join(folder, 'tasks.json');
    const noteName = path.basename(notePath);
    const companions = new Map<string, TasksCompanion | null>();
    const changed = new Set<string>();

    const load = async (filePath: string): Promise<TasksCompanion | null> => {
      if (!companions.has(filePath)) {
        const raw = await this.io.readText(filePath);
        companions.set(
          filePath,
          raw === undefined ? { version: 1, title: `Aufgaben: ${path.basename(folder)}`, tasks: [] } : tryParse(raw)
        );
      }
      return companions.get(filePath)!;
    };

    const target = await load(tasksPath);
    // An unreadable task file is never overwritten
    if (!target) return;

    let otherFiles: string[] | null = null;
    for (const line of lines) {
      let task: TaskItem | undefined = target.tasks.find((t) => t.id === line.id);

      if (!task) {
        otherFiles ??= (await this.io.listTaskFiles()).filter((p) => p !== tasksPath);
        for (const other of otherFiles) {
          const companion = await load(other);
          const index = companion ? companion.tasks.findIndex((t) => t.id === line.id) : -1;
          if (companion && index >= 0) {
            task = companion.tasks.splice(index, 1)[0];
            target.tasks.push(task);
            changed.add(other).add(tasksPath);
            break;
          }
        }
      }

      if (!task) {
        target.tasks.push(
          TaskItemSchema.parse({
            id: line.id,
            title: line.title,
            completed: line.done,
            status: line.done ? 'done' : 'todo',
            priority: 'medium',
            note: noteName,
            createdAt: new Date().toISOString(),
          })
        );
        changed.add(tasksPath);
        continue;
      }

      const status = line.done ? 'done' : task.status === 'done' ? 'todo' : task.status;
      if (task.title !== line.title || Boolean(task.completed) !== line.done || task.note !== noteName || task.status !== status) {
        Object.assign(task, { title: line.title, completed: line.done, status, note: noteName });
        changed.add(tasksPath);
      }
    }

    for (const filePath of changed) {
      const companion = companions.get(filePath)!;
      // Snapshot first: the resulting file events must not be mistaken for list-side changes
      this.snapshots.set(filePath, linkedState(companion));
      await this.io.writeTasks(filePath, companion);
    }
  }

  /** Task list to note: writes title and done changes and deletions of linked tasks back to their lines. */
  async tasksFileChanged(tasksPath: string, text: string): Promise<void> {
    const companion = tryParse(text);
    if (!companion) return;
    const after = linkedState(companion);
    const before = this.snapshots.get(tasksPath);
    this.snapshots.set(tasksPath, after);
    // First sight of a file: nothing to compare with
    if (!before) return;

    const folder = path.dirname(tasksPath);
    const byNote = new Map<string, NoteLineChange[]>();
    const add = (note: string | undefined, change: NoteLineChange) => {
      if (!note) return;
      const notePath = path.join(folder, note);
      byNote.set(notePath, [...(byNote.get(notePath) ?? []), change]);
    };

    for (const [id, now] of after) {
      const was = before.get(id);
      if (!was) continue;
      if (now.title !== was.title || now.completed !== was.completed) {
        add(now.note, { id, title: now.title, done: now.completed, was });
      }
    }
    for (const [id, was] of before) {
      if (after.has(id) || this.isKnownElsewhere(id, tasksPath)) continue;
      add(was.note, { id, remove: true });
    }

    for (const [notePath, changes] of byNote) {
      await this.applyToNote(notePath, changes);
    }
  }

  /** A task file that no longer exists (deleted or renamed folder): its tasks are not treated as deleted. */
  forgetTasksFile(tasksPath: string): void {
    this.snapshots.delete(tasksPath);
  }

  private isKnownElsewhere(id: string, tasksPath: string): boolean {
    for (const [filePath, state] of this.snapshots) {
      if (filePath !== tasksPath && state.has(id)) return true;
    }
    return false;
  }

  private async applyToNote(notePath: string, changes: NoteLineChange[]): Promise<void> {
    const text = await this.io.readText(notePath);
    if (text === undefined) return;
    const textLines = text.split(/\r?\n/);
    const parsed = new Map(parseLinkedTaskLines(text).map((l) => [l.id, l]));

    const edits: Array<{ line: number; text: string }> = [];
    for (const change of changes) {
      const linked = parsed.get(change.id);
      if (!linked) continue;
      const current = textLines[linked.line];
      // A field the user already changed in the note (not saved yet) is newer than the list's old state
      const title = change.was && linked.title !== change.was.title ? undefined : change.title;
      const done = change.was && linked.done !== change.was.completed ? undefined : change.done;
      const next = change.remove ? removeLinkedTaskId(current) : rewriteLinkedTaskLine(current, { title, done });
      if (next !== current) edits.push({ line: linked.line, text: next });
    }
    if (edits.length > 0) await this.io.editNoteLines(notePath, edits);
  }
}

/** VS Code wiring: save events of notes, changes of task files, and writing to open documents or files. */
export class LinkedTaskSync implements vscode.Disposable {
  private readonly core: LinkedTaskSyncCore;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private initialized: Promise<void> | undefined;

  constructor(
    private readonly getNotesRoot: () => vscode.Uri | undefined,
    private readonly folderTasksService: FolderTasksService = new FolderTasksService()
  ) {
    this.core = new LinkedTaskSyncCore({
      readText: (filePath) => this.readText(filePath),
      writeTasks: (tasksPath, companion) =>
        this.folderTasksService.writeFolderCompanion(vscode.Uri.file(tasksPath), companion),
      editNoteLines: (notePath, changes) => this.editNoteLines(notePath, changes),
      listTaskFiles: async () => {
        const root = this.getNotesRoot();
        return root ? (await this.folderTasksService.findFolderTasksFiles(root)).map((u) => u.fsPath) : [];
      },
    });

    const watcher = vscode.workspace.createFileSystemWatcher('**/tasks.json');
    const onTasksFile = (uri: vscode.Uri) => this.scheduleTasksFile(uri.fsPath);
    this.disposables.push(
      watcher,
      watcher.onDidChange(onTasksFile),
      watcher.onDidCreate(onTasksFile),
      watcher.onDidDelete(onTasksFile),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (path.basename(e.document.uri.fsPath) === 'tasks.json' && this.isInNotesRoot(e.document.uri)) {
          this.scheduleTasksFile(e.document.uri.fsPath);
        }
      }),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.uri.fsPath.toLowerCase().endsWith('.md') && this.isInNotesRoot(doc.uri)) {
          void this.run(() => this.core.syncNote(doc.uri.fsPath, doc.getText()));
        }
      })
    );
    void this.ensureInitialized();
  }

  private isInNotesRoot(uri: vscode.Uri): boolean {
    const root = this.getNotesRoot();
    return !!root && (uri.fsPath + path.sep).startsWith(root.fsPath + path.sep);
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initialized && this.getNotesRoot()) {
      this.initialized = this.core.initialize().catch(() => undefined);
    }
    return this.initialized ?? Promise.resolve();
  }

  private async run(task: () => Promise<void>): Promise<void> {
    await this.ensureInitialized();
    try {
      await task();
    } catch (error) {
      console.warn('Linked task sync failed:', error);
    }
  }

  private scheduleTasksFile(tasksPath: string): void {
    clearTimeout(this.timers.get(tasksPath));
    this.timers.set(
      tasksPath,
      setTimeout(() => {
        this.timers.delete(tasksPath);
        void this.run(async () => {
          const text = await this.readText(tasksPath);
          if (text === undefined) this.core.forgetTasksFile(tasksPath);
          else await this.core.tasksFileChanged(tasksPath, text);
        });
      }, 150)
    );
  }

  private openDocument(filePath: string): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find((d) => d.uri.fsPath === filePath);
  }

  private async readText(filePath: string): Promise<string | undefined> {
    const doc = this.openDocument(filePath);
    // An open, unmodified tasks.json may still show the state before our own write; the disk is current
    if (doc && (doc.isDirty || path.basename(filePath) !== 'tasks.json')) return doc.getText();
    try {
      return Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))).toString('utf8');
    } catch {
      return undefined;
    }
  }

  private async editNoteLines(notePath: string, changes: Array<{ line: number; text: string }>): Promise<void> {
    const doc = this.openDocument(notePath);
    if (doc) {
      const wasDirty = doc.isDirty;
      const edit = new vscode.WorkspaceEdit();
      for (const change of changes) {
        edit.replace(doc.uri, doc.lineAt(change.line).range, change.text);
      }
      await vscode.workspace.applyEdit(edit);
      if (!wasDirty) await doc.save();
      return;
    }

    const uri = vscode.Uri.file(notePath);
    const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    for (const change of changes) lines[change.line] = change.text;
    await vscode.workspace.fs.writeFile(uri, Buffer.from(lines.join(eol), 'utf8'));
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.disposables.forEach((d) => d.dispose());
  }
}
