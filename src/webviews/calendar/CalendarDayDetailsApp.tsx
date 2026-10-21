import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { MdiIcon } from '../components/ui/MdiIcon';
import {
  mdiCalendarToday,
  mdiClockOutline,
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiCheckAll,
  mdiAlertCircleOutline,
} from '@mdi/js';
import { CalendarEntryData, CalendarInitialData, getVsCodeApi } from './CalendarMonthApp';

const WEEKDAYS_LONG = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];

const MONTHS_LONG = [
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

function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekday = WEEKDAYS_LONG[dateObj.getDay()];
  const monthName = MONTHS_LONG[m - 1];
  return `${weekday}, ${d}. ${monthName} ${y}`;
}

export const CalendarDayDetailsApp: React.FC<{ initialData?: CalendarInitialData }> = ({
  initialData = {},
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => initialData.selectedDate || '');
  const [events, setEvents] = useState<CalendarEntryData[]>(() => initialData.events || []);

  useEffect(() => {
    const api = getVsCodeApi();
    api?.postMessage({ type: 'ready' });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'init' || msg?.type === 'updateEvents' || msg?.type === 'updateDayDetails') {
        if (typeof msg.date === 'string') {
          setSelectedDate(msg.date);
        } else if (typeof msg.selectedDate === 'string') {
          setSelectedDate(msg.selectedDate);
        }
        if (Array.isArray(msg.events)) {
          setEvents(msg.events);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleOpenNote = (notePath?: string, line?: number) => {
    if (!notePath) return;
    getVsCodeApi()?.postMessage({
      type: 'openNote',
      note: notePath,
      line,
    });
  };

  const handleToggleTask = (task: CalendarEntryData) => {
    if (task.kind !== 'task' || !task.taskId) return;
    const nextCompleted = !task.completed;
    // Optimistic local update
    setEvents((prev) =>
      prev.map((e) => (e.id === task.id ? { ...e, completed: nextCompleted } : e))
    );
    getVsCodeApi()?.postMessage({
      type: 'toggleTask',
      folderUri: task.folderUri,
      taskId: task.taskId,
      completed: nextCompleted,
    });
  };

  const dayEvents = useMemo(() => {
    return events.filter((e) => e.date === selectedDate);
  }, [events, selectedDate]);

  const noteEvents = useMemo(() => {
    return dayEvents.filter((e) => e.kind === 'note');
  }, [dayEvents]);

  const taskEvents = useMemo(() => {
    return dayEvents.filter((e) => e.kind === 'task');
  }, [dayEvents]);

  return (
    <div className="flex flex-col min-h-full h-auto overflow-y-auto overflow-x-hidden p-3 w-full select-none bg-[var(--vscode-sideBar-background,inherit)] text-[var(--vscode-sideBar-foreground,inherit)]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))]">
        <div className="flex items-center gap-2 min-w-0">
          <MdiIcon path={mdiCalendarToday} size={20} className="text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight truncate">
              {selectedDate ? formatDisplayDate(selectedDate) : 'Tagesdetails'}
            </h1>
            <span className="text-[11px] opacity-60 font-mono block">{selectedDate}</span>
          </div>
        </div>

        <Badge variant="default" className="rounded-full font-normal text-[11px] px-2 py-0.5 shrink-0">
          {dayEvents.length} Einträge
        </Badge>
      </header>

      {dayEvents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-xs opacity-60">
            Keine Termine oder fälligen Aufgaben an diesem Tag vorhanden.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Section: Termine aus Notizen */}
          {noteEvents.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                <MdiIcon path={mdiFileDocumentOutline} size={14} className="text-sky-400 shrink-0" />
                <span>Termine aus Notizen ({noteEvents.length})</span>
              </h2>

              <div className="flex flex-col gap-2">
                {noteEvents.map((item) => (
                  <Card key={item.id} className="overflow-hidden border-l-4 border-l-sky-500">
                    <CardContent className="p-2.5 flex flex-col gap-1.5">
                      {/* Top Row: Date/Time Badge & File Link */}
                      <div className="flex items-center justify-between gap-1.5">
                        {item.time ? (
                          <Badge variant="outline" className="font-mono text-[10px] gap-1 py-0.5 shrink-0">
                            <MdiIcon path={mdiClockOutline} size={11} />
                            <span>{item.time}</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0.5 opacity-70 shrink-0">
                            Ganztägig
                          </Badge>
                        )}

                        {item.notePath && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenNote(item.notePath, item.line)}
                            className="h-5 px-1.5 text-[10px] shrink-0 gap-1 hover:border-[var(--vscode-focusBorder,#007acc)]"
                            title={`Notiz öffnen: ${item.notePath}`}
                          >
                            <MdiIcon path={mdiFileDocumentOutline} size={11} />
                            <span className="truncate max-w-[150px]">{item.notePath}</span>
                          </Button>
                        )}
                      </div>

                      {/* Full-width Title */}
                      <div className="text-xs font-medium leading-snug break-words">
                        {item.title}
                      </div>

                      {item.snippet && (
                        <div className="text-[11px] opacity-60 font-mono bg-[rgba(128,128,128,0.08)] px-2 py-1 rounded break-words">
                          {item.snippet}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Section: Fällige Aufgaben */}
          {taskEvents.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                <MdiIcon path={mdiCheckAll} size={14} className="text-emerald-400 shrink-0" />
                <span>Fällige Aufgaben ({taskEvents.length})</span>
              </h2>

              <div className="flex flex-col gap-2">
                {taskEvents.map((task) => {
                  const checkboxId = `task-cal-${task.id}`;
                  return (
                    <Card
                      key={task.id}
                      className={`overflow-hidden border-l-4 transition-colors ${
                        task.completed ? 'border-l-gray-500 opacity-60' : 'border-l-emerald-500'
                      }`}
                    >
                      <CardContent className="p-2.5 flex flex-col gap-1.5">
                        {/* Top Row: Status, Badges & File Link */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <label
                              htmlFor={checkboxId}
                              className="inline-flex items-center justify-center min-h-[18px] min-w-[18px] cursor-pointer"
                            >
                              <Checkbox
                                id={checkboxId}
                                checked={Boolean(task.completed)}
                                onCheckedChange={() => handleToggleTask(task)}
                              />
                            </label>

                            <Badge
                              variant={task.priority || 'medium'}
                              className="rounded-full text-[10px] py-0 shrink-0"
                            >
                              {task.priority === 'high'
                                ? 'Hoch'
                                : task.priority === 'low'
                                ? 'Niedrig'
                                : 'Mittel'}
                            </Badge>

                            {task.folder && (
                              <Badge variant="outline" className="text-[10px] font-normal gap-1 py-0 shrink-0">
                                <MdiIcon path={mdiFolderOutline} size={11} />
                                <span className="truncate max-w-[90px]">{task.folder}</span>
                              </Badge>
                            )}
                          </div>

                          {task.notePath && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenNote(task.notePath)}
                              className="h-5 px-1.5 text-[10px] shrink-0 gap-1 hover:border-[var(--vscode-focusBorder,#007acc)]"
                              title={`Notiz öffnen: ${task.notePath}`}
                            >
                              <MdiIcon path={mdiFileDocumentOutline} size={11} />
                              <span className="truncate max-w-[150px]">{task.notePath}</span>
                            </Button>
                          )}
                        </div>

                        {/* Full-width Title */}
                        <div
                          className={`text-xs leading-snug break-words pl-6 ${
                            task.completed ? 'line-through opacity-60' : 'font-medium'
                          }`}
                        >
                          {task.title}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

