import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  padZero,
  formatIsoDate,
  isValidTime,
  normalizeTime,
  formatIsoDateTime,
  getQuickDate,
  getMonthCalendarGrid,
} from '../src/webviews/markdown/lib/datePickerUtils';
import {
  getSlashCommands,
  createSlashCommandSource,
  slashCommandSource,
} from '../src/webviews/markdown/extensions/slashCommands';

describe('DatePicker Utilities & Slash Commands', () => {
  describe('datePickerUtils', () => {
    it('padZero formats single and double digit numbers correctly', () => {
      expect(padZero(0)).toBe('00');
      expect(padZero(5)).toBe('05');
      expect(padZero(9)).toBe('09');
      expect(padZero(10)).toBe('10');
      expect(padZero(24)).toBe('24');
    });

    it('formatIsoDate formats Date objects as YYYY-MM-DD', () => {
      const d1 = new Date(2026, 9, 24); // Month is 0-indexed: 9 = October
      expect(formatIsoDate(d1)).toBe('2026-10-24');

      const d2 = new Date(2025, 0, 5); // January 5
      expect(formatIsoDate(d2)).toBe('2025-01-05');
    });

    it('isValidTime validates HH:MM formats correctly', () => {
      expect(isValidTime('14:00')).toBe(true);
      expect(isValidTime('09:30')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
      expect(isValidTime('00:00')).toBe(true);
      expect(isValidTime('9:15')).toBe(true); // single digit hour allowed by regex

      expect(isValidTime('')).toBe(false);
      expect(isValidTime('24:00')).toBe(false);
      expect(isValidTime('12:60')).toBe(false);
      expect(isValidTime('abc')).toBe(false);
      expect(isValidTime('14:0')).toBe(false);
    });

    it('normalizeTime normalizes valid time strings to HH:MM format', () => {
      expect(normalizeTime('9:05')).toBe('09:05');
      expect(normalizeTime('14:30')).toBe('14:30');
      expect(normalizeTime('  18:45  ')).toBe('18:45');
      expect(normalizeTime('')).toBeUndefined();
      expect(normalizeTime('invalid')).toBeUndefined();
    });

    it('formatIsoDateTime returns YYYY-MM-DD or YYYY-MM-DD HH:MM', () => {
      expect(formatIsoDateTime('2026-10-24')).toBe('2026-10-24');
      expect(formatIsoDateTime('2026-10-24', '')).toBe('2026-10-24');
      expect(formatIsoDateTime('2026-10-24', 'invalid')).toBe('2026-10-24');
      expect(formatIsoDateTime('2026-10-24', '14:30')).toBe('2026-10-24 14:30');
      expect(formatIsoDateTime('2026-10-24', '9:15')).toBe('2026-10-24 09:15');
    });

    it('getQuickDate calculates today, tomorrow, and in 1 week correctly', () => {
      const fixedBase = new Date(2026, 9, 21); // 2026-10-21
      expect(getQuickDate('today', fixedBase)).toBe('2026-10-21');
      expect(getQuickDate('tomorrow', fixedBase)).toBe('2026-10-22');
      expect(getQuickDate('nextWeek', fixedBase)).toBe('2026-10-28');
    });

    it('getMonthCalendarGrid generates calendar weeks starting on Monday', () => {
      // October 2026: 2026-10-01 is a Thursday
      // Monday of that week is 2026-09-28
      const grid = getMonthCalendarGrid(2026, 10);
      expect(grid.length % 7).toBe(0);

      // First day should be Monday, Sep 28
      const first = grid[0];
      expect(first.year).toBe(2026);
      expect(first.month).toBe(9);
      expect(first.day).toBe(28);
      expect(first.isCurrentMonth).toBe(false);

      // October 1st should be in current month
      const oct1 = grid.find((c) => c.dateStr === '2026-10-01');
      expect(oct1).toBeDefined();
      expect(oct1?.isCurrentMonth).toBe(true);

      // October 31st should be in current month
      const oct31 = grid.find((c) => c.dateStr === '2026-10-31');
      expect(oct31).toBeDefined();
      expect(oct31?.isCurrentMonth).toBe(true);
    });

    it('getMonthCalendarGrid handles leap years properly (February 2024 vs 2025)', () => {
      const grid2024 = getMonthCalendarGrid(2024, 2);
      const feb29 = grid2024.find((c) => c.dateStr === '2024-02-29');
      expect(feb29).toBeDefined();
      expect(feb29?.isCurrentMonth).toBe(true);

      const grid2025 = getMonthCalendarGrid(2025, 2);
      const feb29_2025 = grid2025.find((c) => c.dateStr === '2025-02-29');
      expect(feb29_2025).toBeUndefined();
      const feb28_2025 = grid2025.find((c) => c.dateStr === '2025-02-28');
      expect(feb28_2025?.isCurrentMonth).toBe(true);
    });
  });

  describe('Slash Commands for Date Picker', () => {
    it('registers /date, /datum, /today, and /heute in command list', () => {
      const commands = getSlashCommands();
      const labels = commands.map((c) => c.label);
      expect(labels).toContain('/date');
      expect(labels).toContain('/datum');
      expect(labels).toContain('/today');
      expect(labels).toContain('/heute');
    });

    it('triggers /today completion and inserts current ISO date string', () => {
      const state = EditorState.create({ doc: '/today' });
      let dispatchedChanges: any = null;
      let selectionAnchor: number | null = null;

      const mockView = {
        state,
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
          selectionAnchor = tr.selection?.anchor;
        },
      } as unknown as EditorView;

      const commands = getSlashCommands();
      const todayCmd = commands.find((c) => c.label === '/today');
      expect(todayCmd).toBeDefined();
      expect(typeof todayCmd?.apply).toBe('function');

      if (typeof todayCmd?.apply === 'function') {
        todayCmd.apply(mockView, todayCmd, 0, 6);
      }

      const todayStr = formatIsoDate(new Date());
      expect(dispatchedChanges).toEqual({ from: 0, to: 6, insert: todayStr });
      expect(selectionAnchor).toBe(todayStr.length);
    });

    it('triggers /heute completion and inserts current ISO date string', () => {
      const state = EditorState.create({ doc: '/heute' });
      let dispatchedChanges: any = null;

      const mockView = {
        state,
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
        },
      } as unknown as EditorView;

      const commands = getSlashCommands();
      const heuteCmd = commands.find((c) => c.label === '/heute');
      if (typeof heuteCmd?.apply === 'function') {
        heuteCmd.apply(mockView, heuteCmd, 0, 6);
      }

      const todayStr = formatIsoDate(new Date());
      expect(dispatchedChanges).toEqual({ from: 0, to: 6, insert: todayStr });
    });

    it('triggers /date completion, clears command text, and calls onOpenDatePicker callback', () => {
      const onOpenDatePicker = vi.fn();
      const commands = getSlashCommands({ onOpenDatePicker });
      const dateCmd = commands.find((c) => c.label === '/date');

      let dispatchedChanges: any = null;
      const mockView = {
        state: EditorState.create({ doc: '/date' }),
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
        },
        coordsAtPos: (pos: number) => ({ top: 100, bottom: 120, left: 50, right: 60 }),
      } as unknown as EditorView;

      if (typeof dateCmd?.apply === 'function') {
        dateCmd.apply(mockView, dateCmd, 0, 5);
      }

      expect(dispatchedChanges).toEqual({ from: 0, to: 5, insert: '' });
      expect(onOpenDatePicker).toHaveBeenCalledTimes(1);
      expect(onOpenDatePicker).toHaveBeenCalledWith(0, { top: 120, left: 50 });
    });

    it('triggers /datum completion, clears command text, and calls onOpenDatePicker callback', () => {
      const onOpenDatePicker = vi.fn();
      const commands = getSlashCommands({ onOpenDatePicker });
      const datumCmd = commands.find((c) => c.label === '/datum');

      let dispatchedChanges: any = null;
      const mockView = {
        state: EditorState.create({ doc: '/datum' }),
        dispatch: (tr: any) => {
          dispatchedChanges = tr.changes;
        },
        coordsAtPos: () => null, // fallback when coords are null
      } as unknown as EditorView;

      if (typeof datumCmd?.apply === 'function') {
        datumCmd.apply(mockView, datumCmd, 0, 6);
      }

      expect(dispatchedChanges).toEqual({ from: 0, to: 6, insert: '' });
      expect(onOpenDatePicker).toHaveBeenCalledTimes(1);
      expect(onOpenDatePicker).toHaveBeenCalledWith(0, null);
    });

    it('autocomplete source returns options for typing slash', () => {
      const source = createSlashCommandSource();
      const state = EditorState.create({ doc: '/dat' });
      const result = source({
        state,
        pos: 4,
        matchBefore: (regex: RegExp) => {
          const match = '/dat'.match(regex);
          if (!match) return null;
          return { from: 0, to: 4, text: match[0] };
        },
      } as any);

      expect(result).not.toBeNull();
      expect(result?.options.some((o) => o.label === '/date')).toBe(true);
      expect(result?.options.some((o) => o.label === '/datum')).toBe(true);
    });
  });
});

