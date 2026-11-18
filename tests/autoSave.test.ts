import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoSaveScheduler, normalizeAutoSaveConfig } from '../src/webviews/markdown/lib/autoSave';

describe('auto-save scheduler', () => {
  let save: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    save = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const create = (mode: 'off' | 'afterDelay' | 'onFocusChange', delay = 1000) => {
    const scheduler = createAutoSaveScheduler({ save });
    scheduler.configure({ mode, delay });
    return scheduler;
  };

  it('saves after the delay following an edit', () => {
    const s = create('afterDelay');
    s.onLocalEdit();
    vi.advanceTimersByTime(999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('restarts the timer on further edits and does not save while typing continuously', () => {
    const s = create('afterDelay');
    for (let i = 0; i < 10; i++) {
      s.onLocalEdit();
      vi.advanceTimersByTime(500);
    }
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves immediately on focus loss in afterDelay mode and cancels the pending timer', () => {
    const s = create('afterDelay');
    s.onLocalEdit();
    s.onFocusLost();
    expect(save).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not save on a timer in onFocusChange mode, only on focus loss', () => {
    const s = create('onFocusChange');
    s.onLocalEdit();
    vi.advanceTimersByTime(10000);
    expect(save).not.toHaveBeenCalled();
    s.onFocusLost();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('never saves in off mode', () => {
    const s = create('off');
    s.onLocalEdit();
    vi.advanceTimersByTime(10000);
    s.onFocusLost();
    expect(save).not.toHaveBeenCalled();
  });

  it('can be reconfigured at runtime', () => {
    const s = create('off');
    s.onLocalEdit();
    vi.advanceTimersByTime(2000);
    expect(save).not.toHaveBeenCalled();

    s.configure({ mode: 'afterDelay', delay: 1000 });
    s.onLocalEdit();
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);

    s.onLocalEdit();
    s.configure({ mode: 'off', delay: 1000 });
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('clamps the delay to at least 250 ms', () => {
    const s = create('afterDelay', 100);
    s.onLocalEdit();
    vi.advanceTimersByTime(249);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending timer on dispose', () => {
    const s = create('afterDelay');
    s.onLocalEdit();
    s.dispose();
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('defaults to afterDelay with 1000 ms before configure is called', () => {
    const s = createAutoSaveScheduler({ save });
    s.onLocalEdit();
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeAutoSaveConfig', () => {
  it('falls back to afterDelay for unknown modes and 1000 for invalid delays', () => {
    expect(normalizeAutoSaveConfig('sometimes', 'x')).toEqual({ mode: 'afterDelay', delay: 1000 });
  });

  it('keeps valid values and clamps small delays', () => {
    expect(normalizeAutoSaveConfig('onFocusChange', 3000)).toEqual({ mode: 'onFocusChange', delay: 3000 });
    expect(normalizeAutoSaveConfig('off', 10)).toEqual({ mode: 'off', delay: 250 });
  });
});
