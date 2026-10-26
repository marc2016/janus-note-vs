import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { MdiIcon } from '../components/ui/MdiIcon';
import { mdiCalendarAlert, mdiCalendarClock, mdiCalendarPlus, mdiClose } from '@mdi/js';
import { formatTaskDate, getTaskDateState, isIsoDate, todayIso } from './taskDates';

type DateField = 'dueDate' | 'scheduledDate';

const FIELD_META: Record<DateField, { label: string; menuLabel: string; icon: string }> = {
  scheduledDate: { label: 'Geplant', menuLabel: 'Geplant am…', icon: mdiCalendarClock },
  dueDate: { label: 'Fällig', menuLabel: 'Fällig am…', icon: mdiCalendarAlert },
};

const FIELD_ORDER: DateField[] = ['scheduledDate', 'dueDate'];

export interface TaskDateControlsProps {
  task: { dueDate?: string; scheduledDate?: string; completed?: boolean };
  onUpdate: (changes: { dueDate?: string; scheduledDate?: string }) => void;
}

/**
 * Due / scheduled date chips for a task row, with a "+ Datum" menu and a native date picker.
 */
export const TaskDateControls: React.FC<TaskDateControlsProps> = ({ task, onUpdate }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<DateField | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const today = todayIso();
  const state = getTaskDateState(task, today);
  const missing = FIELD_ORDER.filter((f) => !isIsoDate(task[f]));

  // Close popovers on outside click or Escape
  useEffect(() => {
    if (!menuOpen && !editing) return;
    const close = () => {
      setMenuOpen(false);
      setEditing(null);
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [menuOpen, editing]);

  const startEditing = (field: DateField) => {
    setMenuOpen(false);
    setEditing(field);
  };

  const commit = (field: DateField, value: string | undefined) => {
    onUpdate({ [field]: value && isIsoDate(value) ? value : undefined });
    setEditing(null);
  };

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
    return `${title} – klicken zum Ändern`;
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-1 shrink-0">
      {FIELD_ORDER.map((field) => {
        const value = task[field];
        if (!isIsoDate(value)) return null;
        return (
          <Badge
            key={field}
            variant="outline"
            role="button"
            tabIndex={0}
            aria-label={chipTitle(field, value)}
            title={chipTitle(field, value)}
            onClick={() => startEditing(field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startEditing(field);
              }
            }}
            className={`rounded-full font-normal cursor-pointer hover:border-[var(--vscode-focusBorder,#007acc)] ${chipClass(field)}`}
          >
            <MdiIcon path={FIELD_META[field].icon} size={12} />
            <span>{formatTaskDate(value, today)}</span>
          </Badge>
        );
      })}

      {missing.length > 0 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (missing.length === 1 ? startEditing(missing[0]) : setMenuOpen((o) => !o))}
          title={missing.length === 1 ? FIELD_META[missing[0]].menuLabel : 'Datum hinzufügen'}
          aria-label="Datum hinzufügen"
          className={`h-6 w-6 transition-opacity ${
            menuOpen || editing
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-75 focus-visible:opacity-100 hover:!opacity-100'
          }`}
        >
          <MdiIcon path={mdiCalendarPlus} size={15} />
        </Button>
      )}

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-20 flex flex-col min-w-[140px] py-1 rounded-md border shadow-lg text-xs border-[var(--vscode-menu-border,rgba(128,128,128,0.35))] bg-[var(--vscode-menu-background,#252526)] text-[var(--vscode-menu-foreground,inherit)]"
        >
          {missing.map((field) => (
            <button
              key={field}
              type="button"
              role="menuitem"
              onClick={() => startEditing(field)}
              className="flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--vscode-menu-selectionBackground,#04395e)] hover:text-[var(--vscode-menu-selectionForeground,#fff)]"
            >
              <MdiIcon path={FIELD_META[field].icon} size={13} />
              {FIELD_META[field].menuLabel}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <DateEditPopover
          label={FIELD_META[editing].label}
          value={task[editing]}
          onCommit={(value) => commit(editing, value)}
          onRemove={isIsoDate(task[editing]) ? () => commit(editing, undefined) : undefined}
        />
      )}
    </div>
  );
};

interface DateEditPopoverProps {
  label: string;
  value?: string;
  onCommit: (value: string) => void;
  onRemove?: () => void;
}

const DateEditPopover: React.FC<DateEditPopoverProps> = ({ label, value, onCommit, onRemove }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Open the native picker right away; the triggering click still counts as user activation.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      input.showPicker?.();
    } catch {
      // Picker not available (e.g. no user activation) - the focused input remains usable.
    }
  }, []);

  return (
    <div className="absolute right-0 top-7 z-20 flex items-center gap-1.5 p-2 rounded-md border shadow-lg text-xs border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.35))] bg-[var(--vscode-editorWidget-background,#252526)]">
      <span className="opacity-70 whitespace-nowrap">{label}:</span>
      <input
        ref={inputRef}
        type="date"
        aria-label={`${label} am`}
        defaultValue={value}
        onChange={(e) => {
          // Typing the year emits intermediate values like 0002-11-03; only commit plausible years.
          const next = e.target.value;
          if (next && Number(next.slice(0, 4)) >= 1900) onCommit(next);
        }}
        className="h-7 px-1.5 rounded border text-xs border-[var(--vscode-input-border,rgba(128,128,128,0.3))] bg-[var(--vscode-input-background,transparent)] text-[var(--vscode-input-foreground,inherit)] [color-scheme:light_dark]"
      />
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          title="Datum entfernen"
          aria-label="Datum entfernen"
          className="h-6 w-6 hover:text-red-400"
        >
          <MdiIcon path={mdiClose} size={14} />
        </Button>
      )}
    </div>
  );
};
