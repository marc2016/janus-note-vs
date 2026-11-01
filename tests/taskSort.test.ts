import { describe, it, expect } from 'vitest';
import { sortTasks, splitByCompletion, SortableTask } from '../src/webviews/tasks/taskSort';

type T = SortableTask & { id: string };

const TODAY = '2026-11-01';
const ids = (tasks: T[]) => tasks.map((t) => t.id);

describe('Task Sorting', () => {
  it('sorts by date: overdue first, then earliest date, then undated', () => {
    const tasks: T[] = [
      { id: 'X', priority: 'high' },
      { id: 'Y', dueDate: '2026-11-05' },
      { id: 'Z', scheduledDate: '2026-11-03', dueDate: '2026-11-10' },
      { id: 'W', dueDate: '2026-10-30' },
    ];
    expect(ids(sortTasks(tasks, 'date', TODAY))).toEqual(['W', 'Z', 'Y', 'X']);
  });

  it('sorts by priority with date as tie-breaker; missing priority counts as medium', () => {
    const tasks: T[] = [
      { id: 'P', priority: 'low' },
      { id: 'Q', priority: 'high', dueDate: '2026-11-08' },
      { id: 'R', priority: 'high', dueDate: '2026-11-04' },
      { id: 'S' },
    ];
    expect(ids(sortTasks(tasks, 'priority', TODAY))).toEqual(['R', 'Q', 'S', 'P']);
  });

  it('keeps file order in file mode', () => {
    const tasks: T[] = [
      { id: 'a', dueDate: '2026-12-01' },
      { id: 'b', dueDate: '2026-10-01' },
    ];
    expect(ids(sortTasks(tasks, 'file', TODAY))).toEqual(['a', 'b']);
  });

  it('breaks date ties by priority, then createdAt, then file order', () => {
    const tasks: T[] = [
      { id: 'a', dueDate: '2026-11-05', priority: 'low' },
      { id: 'b', dueDate: '2026-11-05', createdAt: '2026-10-02' },
      { id: 'c', dueDate: '2026-11-05', createdAt: '2026-10-01' },
      { id: 'd', dueDate: '2026-11-05' },
      { id: 'e', dueDate: '2026-11-05' },
    ];
    expect(ids(sortTasks(tasks, 'date', TODAY))).toEqual(['c', 'b', 'd', 'e', 'a']);
  });

  it('ignores invalid dates and does not treat completed tasks as overdue', () => {
    const tasks: T[] = [
      { id: 'invalid', dueDate: 'next week' },
      { id: 'doneOld', dueDate: '2026-10-01', completed: true },
      { id: 'future', dueDate: '2026-11-20' },
      { id: 'overdue', scheduledDate: '2026-10-31' },
    ];
    expect(ids(sortTasks(tasks, 'date', TODAY))).toEqual([
      'overdue',
      'doneOld',
      'future',
      'invalid',
    ]);
  });

  it('does not mutate the input', () => {
    const tasks: T[] = [{ id: 'a' }, { id: 'b', dueDate: '2026-11-02' }];
    const copy = [...tasks];
    sortTasks(tasks, 'date', TODAY);
    expect(tasks).toEqual(copy);
  });

  it('splits into open and done keeping order', () => {
    const tasks: T[] = [{ id: 'a', completed: true }, { id: 'b' }, { id: 'c', completed: true }];
    const { open, done } = splitByCompletion(tasks);
    expect(ids(open)).toEqual(['b']);
    expect(ids(done)).toEqual(['a', 'c']);
  });
});
