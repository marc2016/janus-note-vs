import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { MdiIcon } from '../components/ui/MdiIcon';
import {
  mdiFormatListCheckbox,
  mdiPlus,
  mdiDeleteOutline,
  mdiAlertCircleOutline,
} from '@mdi/js';

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

// Safe acquire vscode API (singleton)
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
function getVsCodeApi() {
  if (!vscodeApi && typeof acquireVsCodeApi === 'function') {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  status: 'todo' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  createdAt?: string;
}

export interface TasksData {
  title?: string;
  tasks: TaskItem[];
}

function getInitialData(): TasksData {
  try {
    const el = document.getElementById('initial-data');
    if (el && el.textContent) {
      return JSON.parse(el.textContent);
    }
  } catch {}
  return { title: 'Janus Task Board', tasks: [] };
}

export const TaskBoardApp: React.FC = () => {
  const [initialData] = useState<TasksData>(getInitialData);
  const [tasks, setTasks] = useState<TaskItem[]>(() => initialData.tasks || []);
  const [boardTitle, setBoardTitle] = useState<string>(() => initialData.title || 'Janus Task Board');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
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
        const data: TasksData = message.data;
        if (data.title) {
          setBoardTitle(data.title);
        }
        setTasks(Array.isArray(data.tasks) ? [...data.tasks] : []);
      } else if (message.type === 'error') {
        setError(message.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const notifyUpdate = (updatedTasks: TaskItem[]) => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({
        type: 'updateTasks',
        tasks: updatedTasks,
      });
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;

    const newTask: TaskItem = {
      id: 't-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: trimmed,
      completed: false,
      status: 'todo',
      priority: newTaskPriority,
      createdAt: new Date().toISOString(),
    };

    const updated = [...tasks, newTask];
    setTasks(updated);
    setNewTaskTitle('');
    notifyUpdate(updated);
  };

  const handleToggleTask = (task: TaskItem) => {
    const updated = tasks.map((t) => {
      if (t.id === task.id) {
        const nextCompleted = !t.completed;
        const nextStatus = nextCompleted ? ('done' as const) : t.status === 'done' ? ('todo' as const) : t.status;
        return { ...t, completed: nextCompleted, status: nextStatus };
      }
      return t;
    });
    setTasks(updated);
    notifyUpdate(updated);
  };

  const handleChangeStatus = (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus,
          completed: newStatus === 'done',
        };
      }
      return t;
    });
    setTasks(updated);
    notifyUpdate(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    notifyUpdate(updated);
  };

  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className="flex flex-col min-h-screen p-4 select-none bg-[var(--vscode-editor-background,inherit)] text-[var(--vscode-editor-foreground,inherit)]">
      {/* Header */}
      <header className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))]">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <MdiIcon path={mdiFormatListCheckbox} size={22} className="text-primary" />
          <span>{boardTitle}</span>
        </h1>
      </header>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 text-sm text-red-500 border border-red-500/40 rounded-md bg-red-500/10">
          <MdiIcon path={mdiAlertCircleOutline} size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Add Task Form */}
      <form onSubmit={handleAddTask} className="flex gap-2 mb-5">
        <Input
          type="text"
          placeholder="New task description..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          className="flex-1"
        />
        <select
          value={newTaskPriority}
          onChange={(e) => setNewTaskPriority(e.target.value as any)}
          className="h-8 px-2 text-sm rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.3))] bg-[var(--vscode-input-background,transparent)] text-[var(--vscode-input-foreground,inherit)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder,#007acc)]"
        >
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
          <option value="low">Low Priority</option>
        </select>
        <Button type="submit">
          <MdiIcon path={mdiPlus} size={16} />
          <span>Add Task</span>
        </Button>
      </form>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto flex-1">
        {/* Column: To Do */}
        <div className="flex flex-col gap-3 p-3 rounded-lg border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.05))] min-h-[350px]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] font-medium text-sm">
            <span>To Do</span>
            <Badge variant="todo">{todoTasks.length}</Badge>
          </div>
          <div className="flex flex-col gap-2.5">
            {todoTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => handleToggleTask(task)}
                onChangeStatus={(s) => handleChangeStatus(task.id, s)}
                onDelete={() => handleDeleteTask(task.id)}
              />
            ))}
          </div>
        </div>

        {/* Column: In Progress */}
        <div className="flex flex-col gap-3 p-3 rounded-lg border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.05))] min-h-[350px]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] font-medium text-sm">
            <span>In Progress</span>
            <Badge variant="in_progress">{inProgressTasks.length}</Badge>
          </div>
          <div className="flex flex-col gap-2.5">
            {inProgressTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => handleToggleTask(task)}
                onChangeStatus={(s) => handleChangeStatus(task.id, s)}
                onDelete={() => handleDeleteTask(task.id)}
              />
            ))}
          </div>
        </div>

        {/* Column: Done */}
        <div className="flex flex-col gap-3 p-3 rounded-lg border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(128,128,128,0.05))] min-h-[350px]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] font-medium text-sm">
            <span>Done</span>
            <Badge variant="done">{doneTasks.length}</Badge>
          </div>
          <div className="flex flex-col gap-2.5">
            {doneTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => handleToggleTask(task)}
                onChangeStatus={(s) => handleChangeStatus(task.id, s)}
                onDelete={() => handleDeleteTask(task.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TaskCardProps {
  task: TaskItem;
  onToggle: () => void;
  onChangeStatus: (status: 'todo' | 'in_progress' | 'done') => void;
  onDelete: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggle,
  onChangeStatus,
  onDelete,
}) => {
  return (
    <Card className="hover:border-[var(--vscode-button-background,#007acc)] transition-colors">
      <CardContent className="p-3 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={onToggle}
            className="mt-1 cursor-pointer accent-[var(--vscode-button-background,#007acc)]"
          />
          <span
            className={`flex-1 text-sm leading-snug break-words ${
              task.completed ? 'line-through opacity-60' : ''
            }`}
          >
            {task.title}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title="Delete task"
            className="h-6 w-6 opacity-60 hover:opacity-100 hover:text-red-400"
          >
            <MdiIcon path={mdiDeleteOutline} size={15} />
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.15))]">
          <span className="opacity-70 capitalize text-[11px] font-medium">
            {task.priority || 'medium'}
          </span>
          <select
            value={task.status}
            onChange={(e) => onChangeStatus(e.target.value as any)}
            className="text-[11px] h-6 px-1.5 rounded border border-[var(--vscode-input-border,rgba(128,128,128,0.25))] bg-[var(--vscode-input-background,transparent)] text-[var(--vscode-input-foreground,inherit)] focus:outline-none"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
};
