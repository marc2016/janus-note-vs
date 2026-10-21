export function padZero(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1);
  const day = padZero(date.getDate());
  return `${year}-${month}-${day}`;
}

export function isValidTime(timeStr?: string): boolean {
  if (!timeStr || !timeStr.trim()) return false;
  const match = timeStr.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

export function normalizeTime(timeStr?: string): string | undefined {
  if (!timeStr || !timeStr.trim()) return undefined;
  const match = timeStr.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return undefined;
  const hours = padZero(Number(match[1]));
  const minutes = match[2];
  return `${hours}:${minutes}`;
}

export function formatIsoDateTime(dateStr: string, timeStr?: string): string {
  const normTime = normalizeTime(timeStr);
  return normTime ? `${dateStr} ${normTime}` : dateStr;
}

export function getQuickDate(type: 'today' | 'tomorrow' | 'nextWeek', baseDate: Date = new Date()): string {
  const target = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  if (type === 'tomorrow') {
    target.setDate(target.getDate() + 1);
  } else if (type === 'nextWeek') {
    target.setDate(target.getDate() + 7);
  }
  return formatIsoDate(target);
}

export interface CalendarGridDay {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  dateStr: string;
}

export function getMonthCalendarGrid(year: number, month: number): CalendarGridDay[] {
  // month is 1-based (1 for January, 12 for December)
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Day of week: Sunday=0, Monday=1, ... Saturday=6
  // We want Monday as start of week: Monday=0 ... Sunday=6
  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) {
    firstDayIndex = 6;
  }

  const grid: CalendarGridDay[] = [];

  // Trailing days from previous month
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    grid.push({
      day,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
      dateStr: `${prevYear}-${padZero(prevMonth)}-${padZero(day)}`,
    });
  }

  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push({
      day: d,
      month,
      year,
      isCurrentMonth: true,
      dateStr: `${year}-${padZero(month)}-${padZero(d)}`,
    });
  }

  // Remaining days to fill 5 or 6 rows (multiples of 7)
  const remaining = (7 - (grid.length % 7)) % 7;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  for (let d = 1; d <= remaining; d++) {
    grid.push({
      day: d,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
      dateStr: `${nextYear}-${padZero(nextMonth)}-${padZero(d)}`,
    });
  }

  return grid;
}

export const MONTH_NAMES_DE = [
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

export const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

