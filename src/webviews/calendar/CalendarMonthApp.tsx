import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MdiIcon } from '../components/ui/MdiIcon';
import {
  mdiCalendarMonth,
  mdiChevronLeft,
  mdiChevronRight,
  mdiClockOutline,
  mdiFileDocumentOutline,
  mdiCheckboxMarkedCircleOutline,
  mdiCheckboxBlankCircleOutline,
  mdiCalendarAlert,
  mdiCalendarClock,
} from '@mdi/js';

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
export function getVsCodeApi() {
  if (!vscodeApi && typeof acquireVsCodeApi === 'function') {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export interface CalendarEntryData {
  id: string;
  kind: 'note' | 'task';
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  title: string;
  noteUri?: string;
  notePath?: string;
  line?: number;
  snippet?: string;
  dateKind?: 'due' | 'scheduled';
  taskId?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  folder?: string;
  folderUri?: string;
}

export interface CalendarInitialData {
  mode?: 'month' | 'day-details';
  year?: number;
  month?: number;
  selectedDate?: string;
  events?: CalendarEntryData[];
}

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function formatIso(year: number, month: number, day: number): string {
  const m = month < 10 ? `0${month}` : `${month}`;
  const d = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${m}-${d}`;
}

export const CalendarMonthApp: React.FC<{ initialData?: CalendarInitialData }> = ({
  initialData = {},
}) => {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(
    () => formatIso(today.getFullYear(), today.getMonth() + 1, today.getDate()),
    [today]
  );

  const [year, setYear] = useState<number>(() => initialData.year || today.getFullYear());
  const [month, setMonth] = useState<number>(() => initialData.month || today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(
    () => initialData.selectedDate || todayIso
  );
  const [events, setEvents] = useState<CalendarEntryData[]>(() => initialData.events || []);

  useEffect(() => {
    const api = getVsCodeApi();
    api?.postMessage({ type: 'ready' });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'init' || msg?.type === 'updateEvents') {
        if (Array.isArray(msg.events)) {
          setEvents(msg.events);
        }
        if (typeof msg.year === 'number') setYear(msg.year);
        if (typeof msg.month === 'number') setMonth(msg.month);
        if (typeof msg.selectedDate === 'string') setSelectedDate(msg.selectedDate);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDate(todayIso);
    getVsCodeApi()?.postMessage({
      type: 'selectDay',
      date: todayIso,
    });
  };

  const handleSelectDay = (dateStr: string) => {
    setSelectedDate(dateStr);
    getVsCodeApi()?.postMessage({
      type: 'selectDay',
      date: dateStr,
    });
  };

  const handleOpenNote = (e: React.MouseEvent, notePath?: string, line?: number) => {
    e.stopPropagation();
    if (!notePath) return;
    getVsCodeApi()?.postMessage({
      type: 'openNote',
      note: notePath,
      line,
    });
  };

  // Map events by date (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEntryData[]>();
    for (const ev of events) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  // Calendar Grid calculation (Monday-first)
  const gridDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();

    // JS getDay(): Sunday=0, Monday=1, ... Saturday=6
    // We want Monday=0, ... Sunday=6
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: Array<{
      date: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Previous month filler
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const iso = formatIso(prevY, prevM, d);
      days.push({
        date: iso,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        isSelected: iso === selectedDate,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const iso = formatIso(year, month, d);
      days.push({
        date: iso,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: iso === todayIso,
        isSelected: iso === selectedDate,
      });
    }

    // Next month filler to complete 35 or 42 cells (multiple of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      const iso = formatIso(nextY, nextM, d);
      days.push({
        date: iso,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        isSelected: iso === selectedDate,
      });
    }

    return days;
  }, [year, month, selectedDate, todayIso]);

  const monthEventsCount = useMemo(() => {
    const prefix = `${year}-${month < 10 ? '0' + month : month}`;
    return events.filter((e) => e.date.startsWith(prefix)).length;
  }, [events, year, month]);

  return (
    <div className="flex flex-col min-h-screen p-4 select-none bg-[var(--vscode-editor-background,inherit)] text-[var(--vscode-editor-foreground,inherit)]">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))]">
        <div className="flex items-center gap-2.5">
          <MdiIcon path={mdiCalendarMonth} size={24} className="text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          <Badge variant="default" className="rounded-full font-normal">
            {monthEventsCount} Termine / Deadlines
          </Badge>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} title="Vorheriger Monat">
            <MdiIcon path={mdiChevronLeft} size={20} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} className="h-7 px-3 text-xs">
            Heute
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} title="Nächster Monat">
            <MdiIcon path={mdiChevronRight} size={20} />
          </Button>
        </div>
      </header>

      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs font-semibold uppercase tracking-wider opacity-60">
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className="py-1">
            {name}
          </div>
        ))}
      </div>

      {/* 7-Column Month Grid */}
      <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
        {gridDays.map((day) => {
          const dayEvents = eventsByDate.get(day.date) || [];
          return (
            <Card
              key={day.date}
              onClick={() => handleSelectDay(day.date)}
              className={`flex flex-col p-1.5 min-h-[95px] cursor-pointer transition-all border ${
                day.isSelected
                  ? 'ring-2 ring-[var(--vscode-focusBorder,#007acc)] border-[var(--vscode-focusBorder,#007acc)] bg-[var(--vscode-list-activeSelectionBackground,rgba(0,122,204,0.1))]'
                  : 'hover:border-[var(--vscode-focusBorder,#007acc)] hover:bg-[var(--vscode-list-hoverBackground,rgba(128,128,128,0.05))]'
              } ${!day.isCurrentMonth ? 'opacity-40 bg-[rgba(128,128,128,0.02)]' : ''}`}
            >
              {/* Day Header with Number */}
              <div className="flex items-center justify-between pb-1">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    day.isToday
                      ? 'bg-[var(--vscode-button-background,#007acc)] text-[var(--vscode-button-foreground,#fff)] font-bold'
                      : ''
                  }`}
                >
                  {day.dayNumber}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] opacity-60 font-mono">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Event Chips (up to 3 items) */}
              <div className="flex flex-col gap-1 overflow-hidden flex-1">
                {dayEvents.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    onClick={(e) => handleOpenNote(e, item.notePath, item.line)}
                    title={`${
                      item.kind === 'task' ? (item.dateKind === 'scheduled' ? 'Geplant: ' : 'Fällig: ') : ''
                    }${item.time ? item.time + ' ' : ''}${item.title}${
                      item.notePath ? ' (' + item.notePath + ')' : ''
                    }`}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate leading-tight transition-colors ${
                      item.kind === 'task'
                        ? item.completed
                          ? 'line-through opacity-50 bg-[rgba(128,128,128,0.15)] text-[var(--vscode-editor-foreground,inherit)]'
                          : `bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-medium ${
                              item.dateKind === 'scheduled' ? 'border-dashed' : ''
                            }`
                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 font-medium'
                    }`}
                  >
                    {item.kind === 'task' ? (
                      <>
                        <MdiIcon
                          path={
                            item.completed
                              ? mdiCheckboxMarkedCircleOutline
                              : mdiCheckboxBlankCircleOutline
                          }
                          size={12}
                          className="shrink-0"
                        />
                        <MdiIcon
                          path={item.dateKind === 'scheduled' ? mdiCalendarClock : mdiCalendarAlert}
                          size={11}
                          className="shrink-0 opacity-80"
                          aria-label={item.dateKind === 'scheduled' ? 'geplant' : 'fällig'}
                        />
                      </>
                    ) : item.time ? (
                      <span className="text-[10px] font-mono shrink-0 opacity-80">{item.time}</span>
                    ) : (
                      <MdiIcon path={mdiFileDocumentOutline} size={12} className="shrink-0 opacity-70" />
                    )}
                    <span className="truncate">{item.title}</span>
                  </div>
                ))}

                {dayEvents.length > 3 && (
                  <div className="text-[10px] opacity-60 text-center font-medium">
                    +{dayEvents.length - 3} weitere
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

