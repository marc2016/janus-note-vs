import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { MdiIcon } from '../components/ui/MdiIcon';
import { mdiClose, mdiPlus } from '@mdi/js';
import { isIsoDate } from './taskDates';
import { DateField, FIELD_META, FIELD_ORDER, TaskDateChips } from './TaskDateChips';

export interface TaskDateControlsProps {
  task: { dueDate?: string; scheduledDate?: string; completed?: boolean };
  onUpdate: (changes: { dueDate?: string; scheduledDate?: string }) => void;
  /** Dims set chips until the row is hovered. */
  muted?: boolean;
}

/**
 * Due / scheduled date chips for a task row, each in a fixed-width slot so dates line up
 * across rows. An empty slot offers "+ Geplant" / "+ Fällig" on hover; a native date picker edits.
 */
export const TaskDateControls: React.FC<TaskDateControlsProps> = ({
  task,
  onUpdate,
  muted = false,
}) => {
  const [editing, setEditing] = useState<DateField | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close the popover on outside click or Escape
  useEffect(() => {
    if (!editing) return;
    const close = () => setEditing(null);
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
  }, [editing]);

  const commit = (field: DateField, value: string | undefined) => {
    onUpdate({ [field]: value && isIsoDate(value) ? value : undefined });
    setEditing(null);
  };

  return (
    <div ref={containerRef} className="flex items-center gap-1 shrink-0">
      {FIELD_ORDER.map((field) => {
        const isSet = isIsoDate(task[field]);
        return (
          <div key={field} className="relative flex items-center w-[88px]">
            {isSet ? (
              // Only the chip is dimmed: opacity on the slot would trap the popover in its stacking context
              <span
                className={`inline-flex transition-opacity ${
                  muted ? 'opacity-70 group-hover:opacity-100' : ''
                }`}
              >
                <TaskDateChips task={task} fields={[field]} onChipClick={setEditing} />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(field)}
                title={FIELD_META[field].menuLabel}
                aria-label={FIELD_META[field].menuLabel}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap transition-opacity hover:bg-[var(--vscode-list-hoverBackground,rgba(128,128,128,0.1))] ${
                  editing === field
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-60 focus-visible:opacity-100 hover:!opacity-100'
                }`}
              >
                <MdiIcon path={mdiPlus} size={12} />
                {FIELD_META[field].label}
              </button>
            )}

            {editing === field && (
              <DateEditPopover
                label={FIELD_META[field].label}
                value={task[field]}
                onCommit={(value) => commit(field, value)}
                onRemove={isSet ? () => commit(field, undefined) : undefined}
              />
            )}
          </div>
        );
      })}
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
