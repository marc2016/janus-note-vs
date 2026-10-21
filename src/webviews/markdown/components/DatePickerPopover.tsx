import React, { useState, useEffect, useRef } from 'react';
import {
  formatIsoDate,
  formatIsoDateTime,
  getMonthCalendarGrid,
  getQuickDate,
  MONTH_NAMES_DE,
  WEEKDAYS_DE,
} from '../lib/datePickerUtils';

export interface DatePickerPopoverProps {
  isOpen: boolean;
  position: { top: number; left: number };
  initialDate?: Date;
  onSelect: (dateStr: string) => void;
  onClose: () => void;
}

export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({
  isOpen,
  position,
  initialDate,
  onSelect,
  onClose,
}) => {
  const baseDate = initialDate || new Date();
  const [viewYear, setViewYear] = useState<number>(baseDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(baseDate.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(formatIsoDate(baseDate));
  const [time, setTime] = useState<string>('');

  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Sync state whenever opened with fresh date
  useEffect(() => {
    if (isOpen) {
      const d = initialDate || new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth() + 1);
      setSelectedDate(formatIsoDate(d));
      setTime('');
    }
  }, [isOpen, initialDate]);

  // Click outside to close & Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter') {
        // Prevent default submit and confirm
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handlePointerDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handlePointerDown, true);
    };
  }, [isOpen, selectedDate, time]);

  if (!isOpen) {
    return null;
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleQuickSelect = (type: 'today' | 'tomorrow' | 'nextWeek') => {
    const dateStr = getQuickDate(type);
    setSelectedDate(dateStr);
    const parts = dateStr.split('-').map(Number);
    setViewYear(parts[0]);
    setViewMonth(parts[1]);
  };

  const handleConfirm = () => {
    const result = formatIsoDateTime(selectedDate, time);
    onSelect(result);
  };

  const grid = getMonthCalendarGrid(viewYear, viewMonth);
  const todayIso = formatIsoDate(new Date());

  // Clamp popover position so it stays within viewport
  const popoverWidth = 280;
  const popoverHeight = 360;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 600;

  const left = Math.max(12, Math.min(position.left, viewportWidth - popoverWidth - 16));
  const top =
    position.top + popoverHeight > viewportHeight - 16
      ? Math.max(12, position.top - popoverHeight - 8)
      : Math.max(12, position.top + 8);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Datumsauswahl"
      className="fixed z-50 rounded-lg shadow-2xl border text-xs select-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
        color: 'var(--vscode-editorWidget-foreground, #cccccc)',
        borderColor: 'var(--vscode-editorWidget-border, rgba(128,128,128,0.3))',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        padding: '12px',
        fontFamily: 'inherit',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Month / Year Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrevMonth}
          title="Vorheriger Monat"
          className="p-1 rounded hover:bg-white/10 active:scale-95 transition cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-semibold text-sm">
          {MONTH_NAMES_DE[viewMonth - 1]} {viewYear}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          title="Nächster Monat"
          className="p-1 rounded hover:bg-white/10 active:scale-95 transition cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 text-center font-medium opacity-60 mb-1 text-[10px]">
        {WEEKDAYS_DE.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-center mb-3">
        {grid.map((cell) => {
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayIso;

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => setSelectedDate(cell.dateStr)}
              onDoubleClick={() => {
                setSelectedDate(cell.dateStr);
                const result = formatIsoDateTime(cell.dateStr, time);
                onSelect(result);
              }}
              className={`h-7 w-7 mx-auto flex items-center justify-center rounded cursor-pointer transition text-xs ${
                isSelected
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : cell.isCurrentMonth
                  ? 'hover:bg-white/10'
                  : 'opacity-30 hover:bg-white/5'
              } ${isToday && !isSelected ? 'ring-1 ring-blue-400 font-semibold text-blue-400' : ''}`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Quick Select Buttons */}
      <div className="flex gap-1 mb-3 pt-2 border-t border-white/10 justify-between">
        <button
          type="button"
          onClick={() => handleQuickSelect('today')}
          className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 transition cursor-pointer text-[11px]"
        >
          Heute
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect('tomorrow')}
          className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 transition cursor-pointer text-[11px]"
        >
          Morgen
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect('nextWeek')}
          className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 transition cursor-pointer text-[11px]"
        >
          In 1 Woche
        </button>
      </div>

      {/* Optional Time Input */}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-[11px] opacity-75 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Uhrzeit (opt.):
        </label>
        <input
          type="text"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="z.B. 14:00"
          maxLength={5}
          className="flex-1 px-2 py-1 rounded border text-xs bg-black/20 focus:outline-none focus:ring-1 focus:ring-blue-500"
          style={{
            borderColor: 'var(--vscode-input-border, rgba(128,128,128,0.3))',
            color: 'var(--vscode-input-foreground, inherit)',
          }}
        />
      </div>

      {/* Action Footer Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 rounded hover:bg-white/10 transition cursor-pointer text-xs"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition cursor-pointer text-xs"
        >
          Einfügen
        </button>
      </div>
    </div>
  );
};
