import { describe, it, expect } from 'vitest';
import {
  formatTaskDate,
  getTaskDateState,
  isIsoDate,
  todayIso,
} from '../src/webviews/tasks/taskDates';

describe('Task Date Helpers', () => {
  it('formats dates of the current year as DD.MM.', () => {
    expect(formatTaskDate('2026-11-03', '2026-10-26')).toBe('03.11.');
  });

  it('adds a two-digit year for other years (year boundary)', () => {
    expect(formatTaskDate('2027-01-02', '2026-12-31')).toBe('02.01.27');
    expect(formatTaskDate('2025-12-31', '2026-01-01')).toBe('31.12.25');
  });

  it('returns invalid input unchanged', () => {
    expect(formatTaskDate('next week', '2026-10-26')).toBe('next week');
    expect(isIsoDate('2026-1-3')).toBe(false);
  });

  it('formats the local date as ISO', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('marks past due and scheduled dates of open tasks as overdue', () => {
    const state = getTaskDateState(
      { dueDate: '2026-10-25', scheduledDate: '2026-10-20', completed: false },
      '2026-10-26'
    );
    expect(state.dueOverdue).toBe(true);
    expect(state.scheduledOverdue).toBe(true);
  });

  it('does not mark today or future dates as overdue', () => {
    const state = getTaskDateState({ dueDate: '2026-10-26', scheduledDate: '2026-10-27' }, '2026-10-26');
    expect(state.dueOverdue).toBe(false);
    expect(state.scheduledOverdue).toBe(false);
  });

  it('never marks completed tasks as overdue', () => {
    const state = getTaskDateState(
      { dueDate: '2026-01-01', scheduledDate: '2026-01-01', completed: true },
      '2026-10-26'
    );
    expect(state.dueOverdue).toBe(false);
    expect(state.scheduledOverdue).toBe(false);
  });

  it('flags a scheduled date after the due date', () => {
    expect(
      getTaskDateState({ dueDate: '2026-11-03', scheduledDate: '2026-11-05' }, '2026-10-26').scheduledAfterDue
    ).toBe(true);
    expect(
      getTaskDateState({ dueDate: '2026-11-03', scheduledDate: '2026-10-30' }, '2026-10-26').scheduledAfterDue
    ).toBe(false);
    expect(getTaskDateState({ scheduledDate: '2026-11-05' }, '2026-10-26').scheduledAfterDue).toBe(false);
  });

  it('ignores invalid dates', () => {
    const state = getTaskDateState({ dueDate: 'bald', scheduledDate: 'x' }, '2026-10-26');
    expect(state).toEqual({ dueOverdue: false, scheduledOverdue: false, scheduledAfterDue: false });
  });
});
