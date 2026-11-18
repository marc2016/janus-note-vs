export type AutoSaveMode = 'off' | 'afterDelay' | 'onFocusChange';

export interface AutoSaveConfig {
  mode: AutoSaveMode;
  delay: number;
}

export const MIN_AUTO_SAVE_DELAY = 250;
export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = { mode: 'afterDelay', delay: 1000 };

/** Turns raw setting values into a valid config (unknown mode -> afterDelay, delay >= 250). */
export function normalizeAutoSaveConfig(mode: unknown, delay: unknown): AutoSaveConfig {
  const validMode: AutoSaveMode =
    mode === 'off' || mode === 'afterDelay' || mode === 'onFocusChange' ? mode : DEFAULT_AUTO_SAVE_CONFIG.mode;
  const numericDelay = typeof delay === 'number' && Number.isFinite(delay) ? delay : DEFAULT_AUTO_SAVE_CONFIG.delay;
  return { mode: validMode, delay: Math.max(MIN_AUTO_SAVE_DELAY, Math.round(numericDelay)) };
}

export interface AutoSaveSchedulerOptions<T = unknown> {
  /** Saves the note; expected to do nothing when the note has no unsaved changes. */
  save: () => void;
  setTimer?: (callback: () => void, ms: number) => T;
  clearTimer?: (handle: T) => void;
}

export interface AutoSaveScheduler {
  configure(config: AutoSaveConfig): void;
  /** Called for every local edit by the user. */
  onLocalEdit(): void;
  /** Called when focus leaves the editor or the editor tab is hidden or closed. */
  onFocusLost(): void;
  dispose(): void;
}

export function createAutoSaveScheduler<T = unknown>(options: AutoSaveSchedulerOptions<T>): AutoSaveScheduler {
  const setTimer = options.setTimer ?? ((cb: () => void, ms: number) => setTimeout(cb, ms) as unknown as T);
  const clearTimer = options.clearTimer ?? ((handle: T) => clearTimeout(handle as any));
  let config: AutoSaveConfig = { ...DEFAULT_AUTO_SAVE_CONFIG };
  let timer: T | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  return {
    configure(next) {
      config = normalizeAutoSaveConfig(next.mode, next.delay);
      if (config.mode !== 'afterDelay') cancel();
    },
    onLocalEdit() {
      if (config.mode !== 'afterDelay') return;
      cancel();
      timer = setTimer(() => {
        timer = null;
        options.save();
      }, config.delay);
    },
    onFocusLost() {
      if (config.mode === 'off') return;
      cancel();
      options.save();
    },
    dispose() {
      cancel();
    },
  };
}
