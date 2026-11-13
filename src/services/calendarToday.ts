// Pure helpers for the calendar's notion of "today", shared by the extension host and the calendar webviews.

import { formatDailyNoteDate } from './dailyNotePaths';

export interface ShownMonth {
  year: number;
  /** 1-12 */
  month: number;
}

/** Local date of `now` as `YYYY-MM-DD`. */
export function todayIso(now: Date): string {
  return formatDailyNoteDate(now);
}

/** Milliseconds from `now` until the next local midnight. */
export function msUntilNextDay(now: Date): number {
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextDay.getTime() - now.getTime();
}

/** The selection follows to `today` when it was the previous today (or nothing was selected), otherwise it stays. */
export function followDayChange(
  selected: string | undefined,
  previousToday: string,
  today: string
): string {
  return !selected || selected === previousToday ? today : selected;
}

function monthOf(iso: string): ShownMonth | undefined {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : undefined;
}

/** The shown month follows to the month of `today` when it was the month of the previous today, otherwise it stays. */
export function followMonth(shown: ShownMonth, previousToday: string, today: string): ShownMonth {
  const previous = monthOf(previousToday);
  const next = monthOf(today);
  if (!previous || !next) return shown;
  return shown.year === previous.year && shown.month === previous.month ? next : shown;
}
