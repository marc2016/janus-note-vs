import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Select } from '../components/ui/select';
import { MdiIcon } from '../components/ui/MdiIcon';
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

export type FilterMode = 'all' | 'open' | 'done';

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
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskNote, setNewTaskNote] = useState('');
  const [selectedFolderUri, setSelectedFolderUri] = useState<string>(() =>
    initialData.groups && initialData.groups.length > 0 ? initialData.groups[0].uri : ''
  );

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    if (filterMode === 'open' && task.completed) return false;
    if (filterMode === 'done' && !task.completed) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchNote = task.note ? task.note.toLowerCase().includes(q) : false;
      const matchFolder = task.folder ? task.folder.toLowerCase().includes(q) : false;
      return matchTitle || matchNote || matchFolder;
    }
    return true;
  };

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
  const doneCount = useMemo(
    () => allCurrentTasks.filter((t) => t.completed).length,
    [allCurrentTasks]
  );

  const filteredFolderTasks = useMemo(
    () => tasks.filter(filterTask),
    [tasks, filterMode, searchQuery]
  );

  const toggleFolderCollapse = (uri: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [uri]: !prev[uri] }));
  };

  return (
    <div className="flex flex-col min-h-screen p-4 max-w-4xl mx-auto select-none bg-[var(--vscode-editor-background,inherit)] text-[var(--vscode-editor-foreground,inherit)]">
      {/* Header with title, Badge counter, and shadcn Button filter pills */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))]">
        <div className="flex items-center gap-2.5">
          <MdiIcon path={mdiFormatListCheckbox} size={22} className="text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">{boardTitle}</h1>
          <Badge variant="default" className="rounded-full font-normal">
            {openCount} offen · {doneCount} erledigt
          </Badge>
        </div>

        {/* Filter Pills built with shadcn Button */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.05))]">
          {(
            [
              { id: 'all', label: `Alle (${allCurrentTasks.length})` },
              { id: 'open', label: `Nur Offene (${openCount})` },
              { id: 'done', label: `Erledigt (${doneCount})` },
            ] as const
          ).map((pill) => (
            <Button
              key={pill.id}
              type="button"
              size="sm"
              variant={filterMode === pill.id ? 'default' : 'ghost'}
              onClick={() => setFilterMode(pill.id)}
              className="h-6 px-2.5 text-xs"
            >
              {pill.label}
            </Button>
          ))}
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <Card className="mb-4 border-red-500/40 bg-red-500/10">
          <CardContent className="flex items-center gap-2 p-3 text-sm text-red-500">
            <MdiIcon path={mdiAlertCircleOutline} size={18} />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Quick-Add Input Bar wrapped in shadcn Card */}
      <Card className="mb-3">
        <CardContent className="p-2.5">
          <form onSubmit={handleAddTask} className="flex flex-wrap items-center gap-2">
            {mode === 'global' && groups.length > 0 && (
              <Select
                aria-label="Ziel-Ordner"
                value={selectedFolderUri}
                onChange={(e) => setSelectedFolderUri(e.target.value)}
              >
                {groups.map((g) => (
                  <option key={g.uri} value={g.uri}>
                    📁 {g.folder}
                  </option>
                ))}
              </Select>
            )}

            <Input
              type="text"
              placeholder="Neue Aufgabe eingeben und Enter drücken..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 min-w-[200px]"
            />

            <Input
              type="text"
              placeholder="Notiz (optional, z.B. meeting.md)"
              value={newTaskNote}
              onChange={(e) => setNewTaskNote(e.target.value)}
              className="w-48 text-xs"
            />

            <Select
              aria-label="Priorität"
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
            >
              <option value="high">Prio: Hoch</option>
              <option value="medium">Prio: Mittel</option>
              <option value="low">Prio: Niedrig</option>
            </Select>

            <Button type="submit" size="sm">
              <MdiIcon path={mdiPlus} size={16} />
              <span>Hinzufügen</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Search / Quick Filter Bar */}
      <div className="relative mb-4">
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

      {/* Checklist Content */}
      {mode === 'global' ? (
        <div className="flex flex-col gap-4 flex-1">
          {groups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm opacity-60">
                Keine Ordner-Aufgabenlisten (tasks.json) im Workspace gefunden.
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => {
              const filteredTasks = group.tasks.filter(filterTask);
              const groupOpenCount = group.tasks.filter((t) => !t.completed).length;
              const isCollapsed = Boolean(collapsedFolders[group.uri]);

              if (filteredTasks.length === 0 && (filterMode !== 'all' || searchQuery.trim())) {
                return null;
              }

              return (
                <Card key={group.uri} className="overflow-hidden">
                  <CardHeader
                    onClick={() => toggleFolderCollapse(group.uri)}
                    className="flex flex-row items-center justify-between space-y-0 px-3 py-2.5 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.15))] hover:bg-[var(--vscode-list-hoverBackground,rgba(128,128,128,0.08))] cursor-pointer"
                  >
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <MdiIcon
                        path={isCollapsed ? mdiChevronRight : mdiChevronDown}
                        size={16}
                        className="opacity-70"
                      />
                      <MdiIcon path={mdiFolderOutline} size={16} className="text-primary" />
                      <span>{group.folder}</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {groupOpenCount} offen / {group.tasks.length} gesamt
                    </CardDescription>
                  </CardHeader>

                  {!isCollapsed && (
                    <CardContent className="p-0 divide-y divide-[var(--vscode-editorWidget-border,rgba(128,128,128,0.12))]">
                      {filteredTasks.length === 0 ? (
                        <div className="px-4 py-3 text-xs opacity-50">
                          Keine Aufgaben in diesem Ordner.
                        </div>
                      ) : (
                        filteredTasks.map((task) => (
                          <TaskChecklistRow
                            key={task.id}
                            task={task}
                            onToggle={() => handleToggleTask(task, group.uri)}
                            onUpdate={(changes) => handleUpdateTaskField(task, changes, group.uri)}
                            onDelete={() => handleDeleteTask(task.id, group.uri)}
                            onOpenNote={(note) => handleOpenNote(note, group.uri)}
                          />
                        ))
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0 divide-y divide-[var(--vscode-editorWidget-border,rgba(128,128,128,0.12))]">
            {filteredFolderTasks.length === 0 ? (
              <div className="p-8 text-center text-sm opacity-60">
                {tasks.length === 0
                  ? 'Noch keine Aufgaben vorhanden. Tippe oben eine Aufgabe ein und drücke Enter.'
                  : 'Keine Aufgaben für den aktuellen Filter gefunden.'}
              </div>
            ) : (
              filteredFolderTasks.map((task) => (
                <TaskChecklistRow
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggleTask(task)}
                  onUpdate={(changes) => handleUpdateTaskField(task, changes)}
                  onDelete={() => handleDeleteTask(task.id)}
                  onOpenNote={(note) => handleOpenNote(note, task.folderUri)}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
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

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--vscode-list-hoverBackground,rgba(128,128,128,0.06))] transition-colors">
      {/* Accessible label + shadcn Checkbox */}
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

      {/* Editable Title with immediate visual strikethrough when completed */}
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

      {/* Optional Note Reference Chip built with shadcn Badge */}
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
          className="rounded-full font-normal hover:border-[var(--vscode-focusBorder,#007acc)] cursor-pointer shrink-0"
        >
          <MdiIcon path={mdiFileDocumentOutline} size={12} />
          <span className="truncate max-w-[140px]">{task.note}</span>
        </Badge>
      )}

      {/* Priority Pill built with shadcn Badge (click to cycle priority) */}
      <Badge
        variant={priority}
        role="button"
        tabIndex={0}
        onClick={() => onUpdate({ priority: NEXT_PRIORITY[priority] })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onUpdate({ priority: NEXT_PRIORITY[priority] });
          }
        }}
        title="Priorität ändern (Klicken)"
        className="rounded-full cursor-pointer shrink-0"
      >
        {PRIORITY_LABELS[priority]}
      </Badge>

      {/* Delete Button (visible on hover / focus) */}
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
