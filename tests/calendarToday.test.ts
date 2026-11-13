import { describe, it, expect } from 'vitest';
import { followDayChange, followMonth, msUntilNextDay, todayIso } from '../src/services/calendarToday';

describe('todayIso', () => {
  it('uses the local date', () => {
    expect(todayIso(new Date(2026, 10, 12, 23, 59, 59))).toBe('2026-11-12');
    expect(todayIso(new Date(2026, 10, 13, 0, 0, 0))).toBe('2026-11-13');
    expect(todayIso(new Date(2027, 0, 5, 8, 0))).toBe('2027-01-05');
  });
});

describe('msUntilNextDay', () => {
  it('counts down to the next local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 10, 12, 23, 59, 30))).toBe(30_000);
  });

  it('is a full day at midnight', () => {
    expect(msUntilNextDay(new Date(2026, 10, 12, 0, 0, 0))).toBe(24 * 60 * 60 * 1000);
  });

  it('crosses month and year boundaries', () => {
    expect(msUntilNextDay(new Date(2026, 11, 31, 23, 0, 0))).toBe(60 * 60 * 1000);
  });
});

describe('followDayChange', () => {
  it('moves a selection that was the previous today', () => {
    expect(followDayChange('2026-11-12', '2026-11-12', '2026-11-13')).toBe('2026-11-13');
  });

  it('keeps a deliberately selected other day', () => {
    expect(followDayChange('2026-11-20', '2026-11-12', '2026-11-13')).toBe('2026-11-20');
  });

  it('selects today when nothing was selected', () => {
    expect(followDayChange(undefined, '2026-11-12', '2026-11-13')).toBe('2026-11-13');
  });
});

describe('followMonth', () => {
  it('keeps the month when today stays in it', () => {
    expect(followMonth({ year: 2026, month: 11 }, '2026-11-12', '2026-11-13')).toEqual({ year: 2026, month: 11 });
  });

  it('follows into the next month', () => {
    expect(followMonth({ year: 2026, month: 11 }, '2026-11-30', '2026-12-01')).toEqual({ year: 2026, month: 12 });
  });

  it('follows into the next year', () => {
    expect(followMonth({ year: 2026, month: 12 }, '2026-12-31', '2027-01-01')).toEqual({ year: 2027, month: 1 });
  });

  it('keeps another month the user navigated to', () => {
    expect(followMonth({ year: 2027, month: 1 }, '2026-11-30', '2026-12-01')).toEqual({ year: 2027, month: 1 });
  });
});
