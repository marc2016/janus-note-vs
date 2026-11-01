import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Select } from '../components/ui/select';
import { MdiIcon } from '../components/ui/MdiIcon';
import { TaskDateControls } from './TaskDateControls';
import { getTaskDateState } from './taskDates';
import { sortTasks, splitByCompletion, TaskSortMode } from './taskSort';
import {
  mdiFormatListCheckbox,
  mdiPlus,
  mdiDeleteOutline,
  mdiAlertCircleOutline,
  mdiMagnify,
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiChevronDown,
  mdiChevronRight,
  mdiTune,
} from '@mdi/js';

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
function getVsCodeApi() {
  if (!vscodeApi && typeof acquireVsCodeApi === 'function') {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  status: 'todo' | 'in_progress' | 'done';
  priority?: TaskPriority;
  note?: string;
  dueDate?: string;
  scheduledDate?: string;
  createdAt?: string;
  folder?: string;
  folderUri?: string;
}

export interface FolderGroupData {
  folder: string;
  uri: string;
  tasks: TaskItem[];
}

export interface TasksData {
  mode?: 'folder' | 'global';
  title?: string;
  tasks?: TaskItem[];
  groups?: FolderGroupData[];
}

/** View preferences kept in the webview state; `collapsed` keys are `done:<uri|folder>` / `group:<uri>`. */
interface TaskViewState {
  sortMode: TaskSortMode;
  collapsed: Record<string, boolean>;
}

const SORT_MODES: TaskSortMode[] = ['date', 'priority', 'file'];

const SORT_LABELS: Record<TaskSortMode, string> = {
  date: 'Datum',
  priority: 'Priorität',
  file: 'Dateireihenfolge',
};

function getInitialViewState(): TaskViewState {
  const saved = getVsCodeApi()?.getState() as Partial<TaskViewState> | undefined;
  return {
    sortMode: saved?.sortMode && SORT_MODES.includes(saved.sortMode) ? saved.sortMode : 'date',
    collapsed: saved?.collapsed && typeof saved.collapsed === 'object' ? saved.collapsed : {},
  };
}

/** Done sections start collapsed, folder groups start expanded. */
function isCollapsed(collapsed: Record<string, boolean>, key: string): boolean {
  return collapsed[key] ?? key.startsWith('done:');
}

function getInitialData(): TasksData {
  try {
    const el = document.getElementById('initial-data');
    if (el && el.textContent) {
      return JSON.parse(el.textContent);
    }
  } catch {}
  return { mode: 'folder', title: 'Aufgaben', tasks: [] };
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

const NEXT_PRIORITY: Record<TaskPriority, TaskPriority> = {
  low: 'medium',
  medium: 'high',
  high: 'low',
};

export const TaskListApp: React.FC = () => {
  const [initialData] = useState<TasksData>(getInitialData);
  const [mode, setMode] = useState<'folder' | 'global'>(() => initialData.mode || 'folder');
  const [boardTitle, setBoardTitle] = useState<string>(() => initialData.title || 'Aufgaben');
  const [tasks, setTasks] = useState<TaskItem[]>(() => initialData.tasks || []);
  const [groups, setGroups] = useState<FolderGroupData[]>(() => initialData.groups || []);
  const [viewState, setViewState] = useState<TaskViewState>(getInitialViewState);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskNote, setNewTaskNote] = useState('');
  const [selectedFolderUri, setSelectedFolderUri] = useState<string>(() =>
    initialData.groups && initialData.groups.length > 0 ? initialData.groups[0].uri : ''
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVsCodeApi()?.setState(viewState);
  }, [viewState]);

  useEffect(() => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'ready' });
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'init') {
        setError(null);
        setMode('folder');
        const data: TasksData = message.data || {};
        if (data.title) {
          setBoardTitle(data.title);
        }
        setTasks(Array.isArray(data.tasks) ? [...data.tasks] : []);
      } else if (message.type === 'initGlobalTasks') {
        setError(null);
        setMode('global');
        setBoardTitle(message.title || 'Alle Aufgaben (Workspace)');
        const incomingGroups: FolderGroupData[] = Array.isArray(message.groups)
          ? message.groups
          : [];
        setGroups(incomingGroups);
        setSelectedFolderUri((prev) => {
          if (prev && incomingGroups.some((g) => g.uri === prev)) {
            return prev;
          }
          return incomingGroups[0]?.uri || '';
        });
      } else if (message.type === 'error') {
        setError(message.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const notifyFolderUpdate = (updatedTasks: TaskItem[]) => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({
        type: 'updateTasks',
        tasks: updatedTasks,
      });
    }
  };

  const handleOpenNote = (noteName: string, folderUri?: string) => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({
        type: 'openNote',
        note: noteName,
        folderUri,
      });
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;

    const noteVal = newTaskNote.trim() || undefined;
    const newTask: TaskItem = {
      id: 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      title: trimmed,
      completed: false,
      status: 'todo',
      priority: newTaskPriority,
      ...(noteVal ? { note: noteVal } : {}),
      createdAt: new Date().toISOString(),
    };

    if (mode === 'global') {
      const targetUri = selectedFolderUri || groups[0]?.uri;
      if (!targetUri) return;
      const targetGroup = groups.find((g) => g.uri === targetUri);
      const taskWithFolder: TaskItem = {
        ...newTask,
        folder: targetGroup?.folder,
        folderUri: targetUri,
      };
      setGroups((prev) =>
        prev.map((g) => (g.uri === targetUri ? { ...g, tasks: [...g.tasks, taskWithFolder] } : g))
      );
      const api = getVsCodeApi();
      api?.postMessage({
        type: 'createTask',
        folderUri: targetUri,
        task: newTask,
      });
    } else {
      const updated = [...tasks, newTask];
      setTasks(updated);
      notifyFolderUpdate(updated);
    }

    setNewTaskTitle('');
    setNewTaskNote('');
  };

  const handleToggleTask = (task: TaskItem, folderUri?: string) => {
    const nextCompleted = !task.completed;
    const nextStatus = nextCompleted ? ('done' as const) : ('todo' as const);

    if (mode === 'global' && folderUri) {
      setGroups((prev) =>
        prev.map((g) =>
          g.uri === folderUri
            ? {
                ...g,
                tasks: g.tasks.map((t) =>
                  t.id === task.id ? { ...t, completed: nextCompleted, status: nextStatus } : t
                ),
              }
            : g
        )
      );
      const api = getVsCodeApi();
      api?.postMessage({
        type: 'toggleTask',
        folderUri,
        taskId: task.id,
        completed: nextCompleted,
      });
    } else {
      const updated = tasks.map((t) =>
        t.id === task.id ? { ...t, completed: nextCompleted, status: nextStatus } : t
      );
      setTasks(updated);
      notifyFolderUpdate(updated);
    }
  };

  const handleUpdateTaskField = (
    task: TaskItem,
    changes: Partial<TaskItem>,
    folderUri?: string
  ) => {
    const updatedTask: TaskItem = { ...task, ...changes };

    if (mode === 'global' && folderUri) {
      setGroups((prev) =>
        prev.map((g) =>
          g.uri === folderUri
            ? {
                ...g,
                tasks: g.tasks.map((t) => (t.id === task.id ? updatedTask : t)),
              }
            : g
        )
      );
      const api = getVsCodeApi();
      api?.postMessage({
        type: 'updateTask',
        folderUri,
        task: updatedTask,
      });
    } else {
      const updated = tasks.map((t) => (t.id === task.id ? updatedTask : t));
      setTasks(updated);
      notifyFolderUpdate(updated);
    }
  };

  const handleDeleteTask = (taskId: string, folderUri?: string) => {
    if (mode === 'global' && folderUri) {
      setGroups((prev) =>
        prev.map((g) =>
          g.uri === folderUri ? { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) } : g
        )
      );
      const api = getVsCodeApi();
      api?.postMessage({
        type: 'deleteTask',
        folderUri,
        taskId,
      });
    } else {
      const updated = tasks.filter((t) => t.id !== taskId);
      setTasks(updated);
      notifyFolderUpdate(updated);
    }
  };

  const filterTask = (task: TaskItem): boolean => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchNote = task.note ? task.note.toLowerCase().includes(q) : false;
      const matchFolder = task.folder ? task.folder.toLowerCase().includes(q) : false;
      return matchTitle || matchNote || matchFolder;
    }
    return true;
  };

  const isSearching = searchQuery.trim().length > 0;

  const allCurrentTasks = useMemo(() => {
    if (mode === 'global') {
      return groups.flatMap((g) => g.tasks);
    }
    return tasks;
  }, [mode, groups, tasks]);

  const openCount = useMemo(
    () => allCurrentTasks.filter((t) => !t.completed).length,
    [allCurrentTasks]
  );

  const toggleCollapsed = (key: string) => {
    setViewState((prev) => ({
      ...prev,
      collapsed: {
        ...prev.collapsed,
        [key]: !isCollapsed(prev.collapsed, key),
      },
    }));
  };

  const renderSections = (
    list: TaskItem[],
    doneKey: string,
    folderUri?: string,
    emptyText?: string
  ) => {
    const { open, done } = splitByCompletion(
      sortTasks(list.filter(filterTask), viewState.sortMode)
    );
    // A search reveals matching completed tasks without touching the remembered state
    const doneCollapsed = isSearching ? false : isCollapsed(viewState.collapsed, doneKey);
    const renderRow = (task: TaskItem) => (
      <TaskChecklistRow
        key={task.id}
        task={task}
        onToggle={() => handleToggleTask(task, folderUri)}
        onUpdate={(changes) => handleUpdateTaskField(task, changes, folderUri)}
        onDelete={() => handleDeleteTask(task.id, folderUri)}
        onOpenNote={(note) => handleOpenNote(note, folderUri ?? task.folderUri)}
      />
    );

    return (
      <>
        {open.length > 0 ? (
          <div className="divide-y divide-[var(--vscode-editorWidget-border,rgba(128,128,128,0.12))]">
            {open.map(renderRow)}
          </div>
        ) : (
          emptyText && <div className="px-3 py-3 text-xs opacity-50">{emptyText}</div>
        )}

        {done.length > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => !isSearching && toggleCollapsed(doneKey)}
              aria-expanded={!doneCollapsed}
              className="flex items-center gap-1 w-full px-2 py-1.5 text-xs font-medium opacity-60 hover:opacity-100 rounded hover:bg-[var(--vscode-list-hoverBackground,rgba(128,128,128,0.06))]"
            >
              <MdiIcon path={doneCollapsed ? mdiChevronRight : mdiChevronDown} size={14} />
              <span>Erledigt ({done.length})</span>
            </button>
            {!doneCollapsed && (
              <div className="divide-y divide-[var(--vscode-editorWidget-border,rgba(128,128,128,0.12))]">
                {done.map(renderRow)}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  const renderGlobalList = () => {
    if (groups.length === 0) {
      return (
        <div className="p-8 text-center text-sm opacity-60">
          Keine Ordner-Aufgabenlisten (tasks.json) im Workspace gefunden.
        </div>
      );
    }
    const visibleGroups = groups.filter((g) => !isSearching || g.tasks.some(filterTask));
    if (visibleGroups.length === 0) {
      return <div className="p-8 text-center text-sm opacity-60">Keine Aufgaben gefunden.</div>;
    }
    return visibleGroups.map((group) => {
      const groupKey = `group:${group.uri}`;
      const collapsed = isCollapsed(viewState.collapsed, groupKey);
      const groupOpenCount = group.tasks.filter((t) => !t.completed).length;
      return (
        <section key={group.uri} className="mb-3">
          <button
            type="button"
            onClick={() => toggleCollapsed(groupKey)}
            aria-expanded={!collapsed}
            className="sticky top-0 z-10 flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-left border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.2))] bg-[var(--vscode-editor-background,#1e1e1e)] hover:text-[var(--vscode-textLink-foreground,inherit)]"
          >
            <MdiIcon
              path={collapsed ? mdiChevronRight : mdiChevronDown}
              size={16}
              className="opacity-60"
            />
            <MdiIcon path={mdiFolderOutline} size={16} className="opacity-70" />
            <span className="truncate">{group.folder}</span>
            <span className="ml-auto text-xs font-normal opacity-50">{groupOpenCount} offen</span>
          </button>
          {!collapsed &&
            renderSections(group.tasks, `done:${group.uri}`, group.uri, 'Keine offenen Aufgaben.')}
        </section>
      );
    });
  };

  const renderFolderList = () => {
    if (tasks.length === 0) {
      return (
        <div className="p-8 text-center text-sm opacity-60">
          Noch keine Aufgaben vorhanden. Tippe oben eine Aufgabe ein und drücke Enter.
        </div>
      );
    }
    if (isSearching && !tasks.some(filterTask)) {
      return <div className="p-8 text-center text-sm opacity-60">Keine Aufgaben gefunden.</div>;
    }
    return renderSections(tasks, 'done:folder', undefined, 'Alle Aufgaben erledigt.');
  };

  const targetFolder = groups.find((g) => g.uri === selectedFolderUri) ?? groups[0];

  return (
    <div className="flex flex-col h-screen select-none bg-[var(--vscode-editor-background,inherit)] text-[var(--vscode-editor-foreground,inherit)]">
      {/* Fixed toolbar: header, quick-add and search stay visible */}
      <div className="shrink-0 w-full max-w-4xl mx-auto px-4 pt-4 pb-2 flex flex-col gap-2.5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <MdiIcon path={mdiFormatListCheckbox} size={22} className="text-primary shrink-0" />
            <h1 className="text-xl font-semibold tracking-tight truncate">{boardTitle}</h1>
            <span className="text-xs opacity-60 whitespace-nowrap">{openCount} offen</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs opacity-80">
            <span>Sortieren:</span>
            <Select
              aria-label="Sortierung"
              value={viewState.sortMode}
              onChange={(e) =>
                setViewState((prev) => ({
                  ...prev,
                  sortMode: e.target.value as TaskSortMode,
                }))
              }
              className="h-7"
            >
              {SORT_MODES.map((m) => (
                <option key={m} value={m}>
                  {SORT_LABELS[m]}
                </option>
              ))}
            </Select>
          </label>
        </header>

        {error && (
          <Card className="border-red-500/40 bg-red-500/10">
            <CardContent className="flex items-center gap-2 p-3 text-sm text-red-500">
              <MdiIcon path={mdiAlertCircleOutline} size={18} />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        <QuickAddBar
          title={newTaskTitle}
          onTitleChange={setNewTaskTitle}
          priority={newTaskPriority}
          onPriorityChange={setNewTaskPriority}
          note={newTaskNote}
          onNoteChange={setNewTaskNote}
          folders={mode === 'global' ? groups : undefined}
          targetFolder={mode === 'global' ? targetFolder : undefined}
          onFolderChange={setSelectedFolderUri}
          onSubmit={handleAddTask}
        />

        <div className="relative">
          <MdiIcon
            path={mdiMagnify}
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Aufgaben oder verknüpfte Notizen durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* Scrollable task list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto px-4 pb-6">
          {mode === 'global' ? renderGlobalList() : renderFolderList()}
        </div>
      </div>
    </div>
  );
};

/** Closes a popover on outside click or Escape while it is open. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, ref, onClose]);
}

interface QuickAddBarProps {
  title: string;
  onTitleChange: (value: string) => void;
  priority: TaskPriority;
  onPriorityChange: (value: TaskPriority) => void;
  note: string;
  onNoteChange: (value: string) => void;
  /** Only set in global mode. */
  folders?: FolderGroupData[];
  targetFolder?: FolderGroupData;
  onFolderChange: (uri: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const QuickAddBar: React.FC<QuickAddBarProps> = ({
  title,
  onTitleChange,
  priority,
  onPriorityChange,
  note,
  onNoteChange,
  folders,
  targetFolder,
  onFolderChange,
  onSubmit,
}) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const containerRef = useRef<HTMLFormElement | null>(null);
  useDismiss(optionsOpen, containerRef, () => setOptionsOpen(false));

  const chipClass =
    'rounded-full font-normal cursor-pointer shrink-0 hover:border-[var(--vscode-focusBorder,#007acc)]';
  const openOptions = () => setOptionsOpen(true);

  return (
    <form ref={containerRef} onSubmit={onSubmit} className="relative flex items-center gap-1.5">
      <div className="relative flex-1 min-w-0">
        <MdiIcon
          path={mdiPlus}
          size={16}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
        />
        <Input
          type="text"
          placeholder="Neue Aufgabe eingeben und Enter drücken..."
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {targetFolder && (
        <Badge
          variant="outline"
          role="button"
          onClick={openOptions}
          title="Ziel-Ordner"
          className={chipClass}
        >
          <MdiIcon path={mdiFolderOutline} size={12} />
          <span className="truncate max-w-[120px]">{targetFolder.folder}</span>
        </Badge>
      )}
      {priority !== 'medium' && (
        <Badge
          variant={priority}
          role="button"
          onClick={openOptions}
          title="Priorität"
          className={chipClass}
        >
          {PRIORITY_LABELS[priority]}
        </Badge>
      )}
      {note.trim() && (
        <Badge
          variant="outline"
          role="button"
          onClick={openOptions}
          title="Verknüpfte Notiz"
          className={chipClass}
        >
          <MdiIcon path={mdiFileDocumentOutline} size={12} />
          <span className="truncate max-w-[120px]">{note.trim()}</span>
        </Badge>
      )}

      <Button
        type="button"
        variant={optionsOpen ? 'default' : 'ghost'}
        size="icon"
        onClick={() => setOptionsOpen((o) => !o)}
        title="Optionen für neue Aufgabe"
        aria-label="Optionen für neue Aufgabe"
        aria-expanded={optionsOpen}
        className="h-8 w-8 shrink-0"
      >
        <MdiIcon path={mdiTune} size={16} />
      </Button>

      {optionsOpen && (
        <div className="absolute right-0 top-10 z-30 flex flex-col gap-2 w-64 p-3 rounded-md border shadow-lg text-xs border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.35))] bg-[var(--vscode-editorWidget-background,#252526)]">
          {folders && folders.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="opacity-70">Ziel-Ordner</span>
              <Select
                aria-label="Ziel-Ordner"
                value={targetFolder?.uri ?? ''}
                onChange={(e) => onFolderChange(e.target.value)}
              >
                {folders.map((g) => (
                  <option key={g.uri} value={g.uri}>
                    {g.folder}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="opacity-70">Priorität</span>
            <Select
              aria-label="Priorität"
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value as TaskPriority)}
            >
              <option value="high">Hoch</option>
              <option value="medium">Mittel</option>
              <option value="low">Niedrig</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="opacity-70">Notiz (optional)</span>
            <Input
              type="text"
              placeholder="z.B. meeting.md"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className="h-8 text-xs"
            />
          </label>
        </div>
      )}
    </form>
  );
};

const PRIORITY_BAR_COLORS: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500/80',
  low: 'bg-slate-500/50',
};

interface TaskChecklistRowProps {
  task: TaskItem;
  onToggle: () => void;
  onUpdate: (changes: Partial<TaskItem>) => void;
  onDelete: () => void;
  onOpenNote: (note: string) => void;
}

const TaskChecklistRow: React.FC<TaskChecklistRowProps> = ({
  task,
  onToggle,
  onUpdate,
  onDelete,
  onOpenNote,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);

  useEffect(() => {
    setDraftTitle(task.title);
  }, [task.title]);

  const commitTitle = () => {
    setIsEditingTitle(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed });
    } else {
      setDraftTitle(task.title);
    }
  };

  const priority: TaskPriority = task.priority || 'medium';
  const checkboxId = `task-check-${task.id}`;
  const priorityTitle = `Priorität: ${PRIORITY_LABELS[priority]}`;
  const dateState = getTaskDateState(task);
  const hasOverdue = dateState.dueOverdue || dateState.scheduledOverdue;
  const cyclePriority = () => onUpdate({ priority: NEXT_PRIORITY[priority] });

  return (
    <div className="group relative flex items-center gap-2 pl-3 pr-1.5 py-1 hover:bg-[var(--vscode-list-hoverBackground,rgba(128,128,128,0.06))] transition-colors">
      {/* Priority bar: wide hit area, narrow visible stripe */}
      <button
        type="button"
        onClick={cyclePriority}
        title={priorityTitle}
        aria-label={priorityTitle}
        className="absolute left-0 inset-y-0 w-2.5 flex items-stretch py-1.5 focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder,#007acc)]"
      >
        <span
          className={`w-1 rounded-r ${PRIORITY_BAR_COLORS[priority]} ${
            task.completed ? 'opacity-40' : ''
          } group-hover:w-1.5 transition-all`}
        />
      </button>

      <label
        htmlFor={checkboxId}
        className="inline-flex items-center justify-center min-h-[28px] min-w-[28px] cursor-pointer"
      >
        <Checkbox
          id={checkboxId}
          checked={task.completed}
          onCheckedChange={onToggle}
          aria-label={task.title}
        />
      </label>

      <div className="flex-1 min-w-0">
        {isEditingTitle ? (
          <Input
            type="text"
            value={draftTitle}
            autoFocus
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') {
                setDraftTitle(task.title);
                setIsEditingTitle(false);
              }
            }}
            className="h-7 px-2 py-0.5 text-sm"
          />
        ) : (
          <span
            onClick={() => setIsEditingTitle(true)}
            title="Klicken zum Bearbeiten"
            className={`block text-sm leading-snug break-words cursor-text ${
              task.completed ? 'line-through opacity-55' : ''
            }`}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Fixed-width columns keep note and dates aligned across rows */}
      <div className="flex w-32 shrink-0">
        {task.note && (
          <Badge
            variant="outline"
            role="button"
            tabIndex={0}
            onClick={() => onOpenNote(task.note!)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenNote(task.note!);
              }
            }}
            title={`Notiz öffnen: ${task.note}`}
            className="max-w-full rounded-full font-normal border-transparent opacity-60 group-hover:opacity-100 group-hover:border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.35))] hover:!border-[var(--vscode-focusBorder,#007acc)] cursor-pointer transition-opacity"
          >
            <MdiIcon path={mdiFileDocumentOutline} size={12} className="shrink-0" />
            <span className="truncate">{task.note}</span>
          </Badge>
        )}
      </div>

      {/* Date chips are muted until hover unless a date is overdue */}
      <TaskDateControls task={task} onUpdate={onUpdate} muted={!hasOverdue} />

      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        title="Aufgabe löschen"
        className="h-6 w-6 opacity-0 group-hover:opacity-75 focus-visible:opacity-100 hover:!opacity-100 hover:text-red-400 transition-opacity shrink-0"
      >
        <MdiIcon path={mdiDeleteOutline} size={15} />
      </Button>
    </div>
  );
};
