// Pure daily note path helpers without editor dependencies, shared by services that must not import editors.

export const DAILY_NOTES_FOLDER = 'journal';
export const DAILY_NOTE_TEMPLATE = 'tagesnotiz';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as `YYYY-MM-DD`. */
export function formatDailyNoteDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` into a local date, or returns undefined for anything else. */
export function parseDailyNoteDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : undefined;
}

/** Returns the date of a daily note path relative to the notes root (`journal/2026-10-29.md` -> `2026-10-29`). */
export function isDailyNotePath(relPath: string): string | undefined {
  const match = /^journal\/(\d{4}-\d{2}-\d{2})\.md$/i.exec(relPath.replace(/\\/g, '/'));
  return match && parseDailyNoteDate(match[1]) ? match[1] : undefined;
}
