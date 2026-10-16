import { z } from 'zod';

// Accept both 'in-progress' (original janus-note) and 'in_progress'
export const RawTaskStatusSchema = z.enum(['todo', 'in_progress', 'in-progress', 'done']);
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  title: z.string().min(1),
  completed: z.boolean().optional(),
  status: RawTaskStatusSchema.optional().default('todo').transform((s): TaskStatus => {
    if (s === 'in-progress') return 'in_progress';
    return s as TaskStatus;
  }),
  priority: TaskPrioritySchema.optional().default('medium'),
  dueDate: z.string().optional(),
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  updatedAt: z.string().optional(),
}).transform((task) => {
  const isDone = task.status === 'done';
  const completed = task.completed !== undefined ? task.completed : isDone;
  return {
    ...task,
    completed,
    status: (completed ? 'done' : (task.status === 'done' ? 'todo' : task.status)) as TaskStatus,
  };
});

export type TaskItem = z.infer<typeof TaskItemSchema>;

export const TasksCompanionSchema = z.object({
  version: z.number().int().optional().default(1),
  title: z.string().optional().default('Task Board'),
  notePath: z.string().optional(),
  tasks: z.array(z.any()).default([]).transform((rawTasks) => {
    return rawTasks.map((raw, idx) => {
      try {
        return TaskItemSchema.parse(raw);
      } catch {
        // Fallback for partially malformed items
        const id = raw?.id ? String(raw.id) : `task-${idx + 1}`;
        const title = raw?.title ? String(raw.title) : 'Untitled task';
        const rawStatus = raw?.status === 'in-progress' ? 'in_progress' : raw?.status;
        const status = ['todo', 'in_progress', 'done'].includes(rawStatus) ? rawStatus : 'todo';
        const completed = Boolean(raw?.completed || status === 'done');
        return {
          id,
          title,
          completed,
          status: (completed ? 'done' : status) as TaskStatus,
          priority: (['low', 'medium', 'high'].includes(raw?.priority) ? raw.priority : 'medium') as TaskPriority,
          createdAt: raw?.createdAt || new Date().toISOString(),
        };
      }
    });
  }),
});

export type TasksCompanion = z.infer<typeof TasksCompanionSchema>;

export function parseTasksCompanion(input: unknown): TasksCompanion {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { version: 1, title: 'Task Board', tasks: [] };
    }
    const parsed = JSON.parse(trimmed);
    return parseTasksCompanion(parsed);
  }

  if (Array.isArray(input)) {
    return TasksCompanionSchema.parse({
      version: 1,
      title: 'Task Board',
      tasks: input,
    });
  }

  if (input && typeof input === 'object') {
    return TasksCompanionSchema.parse(input);
  }

  return { version: 1, title: 'Task Board', tasks: [] };
}

export function createInitialTasksCompanion(title?: string): TasksCompanion {
  return {
    version: 1,
    title: title || 'Task Board',
    tasks: [],
  };
}
