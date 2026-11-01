import { getTaskDateState, isIsoDate, todayIso } from './taskDates';

export type TaskSortMode = 'date' | 'priority' | 'file';

export interface SortableTask {
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  scheduledDate?: string;
  createdAt?: string;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function priorityRank(task: SortableTask): number {
  return PRIORITY_RANK[task.priority ?? 'medium'] ?? 1;
}

/** Earlier of the task's valid due and scheduled dates, or undefined. */
function dateKey(task: SortableTask): string | undefined {
  const dates = [task.dueDate, task.scheduledDate].filter(isIsoDate);
  return dates.length > 0 ? dates.sort()[0] : undefined;
}

interface Entry<T> {
  task: T;
  index: number;
  overdue: boolean;
  date?: string;
}

function compareDate<T extends SortableTask>(a: Entry<T>, b: Entry<T>): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.date !== b.date) {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return 0;
}

function comparePriority<T extends SortableTask>(a: Entry<T>, b: Entry<T>): number {
  return priorityRank(a.task) - priorityRank(b.task);
}

function compareCreated<T extends SortableTask>(a: Entry<T>, b: Entry<T>): number {
  const ca = a.task.createdAt;
  const cb = b.task.createdAt;
  if (ca === cb) return 0;
  if (!ca) return 1;
  if (!cb) return -1;
  return ca < cb ? -1 : 1;
}

/**
 * Returns the tasks in display order for the given mode. Never mutates the input;
 * ties fall back to the original (file) order.
 */
export function sortTasks<T extends SortableTask>(
  tasks: T[],
  mode: TaskSortMode,
  today: string = todayIso()
): T[] {
  if (mode === 'file') return [...tasks];

  const entries: Entry<T>[] = tasks.map((task, index) => {
    const state = getTaskDateState(task, today);
    return {
      task,
      index,
      overdue: state.dueOverdue || state.scheduledOverdue,
      date: dateKey(task),
    };
  });

  const comparators =
    mode === 'priority'
      ? [comparePriority, compareDate, compareCreated]
      : [compareDate, comparePriority, compareCreated];

  entries.sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return a.index - b.index;
  });

  return entries.map((e) => e.task);
}

/** Splits tasks into open and completed, keeping their order. */
export function splitByCompletion<T extends SortableTask>(tasks: T[]): { open: T[]; done: T[] } {
  return {
    open: tasks.filter((t) => !t.completed),
    done: tasks.filter((t) => t.completed),
  };
}
