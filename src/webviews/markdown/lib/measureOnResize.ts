/**
 * Keeps CodeMirror's height map in sync with widgets whose size changes after rendering
 * (images loading, diagrams rendering, width or theme changes). Without this, clicks and
 * vertical cursor movement below such a widget land on the wrong lines.
 */
interface MeasuringView {
  requestMeasure(): void;
}

const disposers = new WeakMap<Element, () => void>();

export function measureOnResize(dom: HTMLElement, view: MeasuringView): void {
  if (typeof ResizeObserver === 'undefined') return;
  let frame: number | undefined;
  const schedule =
    typeof requestAnimationFrame === 'function'
      ? (fn: () => void) => requestAnimationFrame(fn)
      : (fn: () => void) => setTimeout(fn, 0) as unknown as number;
  const observer = new ResizeObserver(() => {
    if (frame !== undefined) return;
    frame = schedule(() => {
      frame = undefined;
      view.requestMeasure();
    });
  });
  observer.observe(dom);
  disposers.set(dom, () => observer.disconnect());
}

/** Stops observing a widget element (call from `WidgetType.destroy`). */
export function stopMeasuring(dom: HTMLElement): void {
  disposers.get(dom)?.();
  disposers.delete(dom);
}
