const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string | undefined): value is string {
  return typeof value === 'string' && ISO_DATE.test(value);
}

/** Today's local date as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Formats an ISO date as German `DD.MM.`, adding a two-digit year (`DD.MM.YY`)
 * when it is not in the current year. Returns the input unchanged if it is not an ISO date.
 */
export function formatTaskDate(iso: string, today: string = todayIso()): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return year === today.slice(0, 4) ? `${day}.${month}.` : `${day}.${month}.${year.slice(2)}`;
}

export interface TaskDateState {
  dueOverdue: boolean;
  scheduledOverdue: boolean;
  scheduledAfterDue: boolean;
}

/**
 * Derives overdue and ordering hints for a task's due and scheduled dates.
 * Only open tasks can be overdue; invalid dates are ignored.
 */
export function getTaskDateState(
  task: { dueDate?: string; scheduledDate?: string; completed?: boolean },
  today: string = todayIso()
): TaskDateState {
  const due = isIsoDate(task.dueDate) ? task.dueDate : undefined;
  const scheduled = isIsoDate(task.scheduledDate) ? task.scheduledDate : undefined;
  const open = !task.completed;
  return {
    dueOverdue: open && !!due && due < today,
    scheduledOverdue: open && !!scheduled && scheduled < today,
    scheduledAfterDue: !!due && !!scheduled && scheduled > due,
  };
}
