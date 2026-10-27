import React from 'react';
import { Badge } from '../components/ui/badge';
import { MdiIcon } from '../components/ui/MdiIcon';
import { mdiCalendarAlert, mdiCalendarClock } from '@mdi/js';
import { formatTaskDate, getTaskDateState, isIsoDate, todayIso } from './taskDates';

export type DateField = 'dueDate' | 'scheduledDate';

export const FIELD_META: Record<DateField, { label: string; menuLabel: string; icon: string }> = {
  scheduledDate: { label: 'Geplant', menuLabel: 'Geplant am…', icon: mdiCalendarClock },
  dueDate: { label: 'Fällig', menuLabel: 'Fällig am…', icon: mdiCalendarAlert },
};

export const FIELD_ORDER: DateField[] = ['scheduledDate', 'dueDate'];

export interface TaskDateChipsProps {
  task: { dueDate?: string; scheduledDate?: string; completed?: boolean };
  /** Makes chips interactive; without it they are plain read-only badges. */
  onChipClick?: (field: DateField) => void;
}

/**
 * Due / scheduled date chips for a task, with overdue and "after due" hints.
 */
export const TaskDateChips: React.FC<TaskDateChipsProps> = ({ task, onChipClick }) => {
  const today = todayIso();
  const state = getTaskDateState(task, today);

  const chipClass = (field: DateField) => {
    const overdue = field === 'dueDate' ? state.dueOverdue : state.scheduledOverdue;
    if (overdue) {
      return 'border-[var(--vscode-errorForeground,#f14c4c)] text-[var(--vscode-errorForeground,#f14c4c)] bg-red-500/10';
    }
    if (field === 'scheduledDate' && state.scheduledAfterDue) {
      return 'border-amber-500/50 text-amber-500 bg-amber-500/10';
    }
    return field === 'scheduledDate' ? 'border-dashed' : '';
  };

  const chipTitle = (field: DateField, value: string) => {
    const [y, m, d] = value.split('-');
    let title = `${FIELD_META[field].label} am ${d}.${m}.${y}`;
    if (field === 'dueDate' ? state.dueOverdue : state.scheduledOverdue) title += ' (überfällig)';
    if (field === 'scheduledDate' && state.scheduledAfterDue) title += ' (liegt nach der Frist)';
    return onChipClick ? `${title} – klicken zum Ändern` : title;
  };

  return (
    <>
      {FIELD_ORDER.map((field) => {
        const value = task[field];
        if (!isIsoDate(value)) return null;
        const title = chipTitle(field, value);
        const interactiveProps = onChipClick
          ? {
              role: 'button',
              tabIndex: 0,
              onClick: () => onChipClick(field),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChipClick(field);
                }
              },
            }
          : {};
        return (
          <Badge
            key={field}
            variant="outline"
            aria-label={title}
            title={title}
            {...interactiveProps}
            className={`rounded-full font-normal shrink-0 ${
              onChipClick ? 'cursor-pointer hover:border-[var(--vscode-focusBorder,#007acc)]' : ''
            } ${chipClass(field)}`}
          >
            <MdiIcon path={FIELD_META[field].icon} size={12} />
            <span>{formatTaskDate(value, today)}</span>
          </Badge>
        );
      })}
    </>
  );
};
